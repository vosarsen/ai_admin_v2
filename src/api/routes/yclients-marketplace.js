// src/api/routes/yclients-marketplace.js
// YClients Marketplace Integration - ПРАВИЛЬНАЯ РЕАЛИЗАЦИЯ согласно документации
// https://docs.yclients.com/marketplace
// Migrated from Supabase to PostgreSQL repositories (2025-11-26)

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const Sentry = require('@sentry/node');
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');
const { YclientsClient } = require('../../integrations/yclients/client');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const postgres = require('../../database/postgres');
const { CompanyRepository, MarketplaceEventsRepository } = require('../../repositories');
const { getCircuitBreaker } = require('../../utils/circuit-breaker');
const { logAdminAction, getAuditLogs } = require('../../utils/admin-audit');
const { createRedisClient } = require('../../utils/redis-factory');

// Redis client for webhook idempotency (lazy initialization)
let webhookRedisClient = null;
const WEBHOOK_IDEMPOTENCY_TTL = 3600; // 1 hour in seconds

/**
 * Get or create Redis client for webhook idempotency
 */
async function getWebhookRedisClient() {
  if (!webhookRedisClient) {
    try {
      webhookRedisClient = await createRedisClient();
    } catch (error) {
      logger.error('Failed to create Redis client for webhook idempotency:', error);
      return null;
    }
  }
  return webhookRedisClient;
}

/**
 * Generate deterministic webhook ID for idempotency
 * Does NOT include timestamp - same content = same ID
 */
function generateWebhookId(eventType, salonId, data) {
  // Deterministic: same event content = same hash
  const content = `webhook:${eventType}:${salonId}:${JSON.stringify(data || {})}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Check if webhook was already processed (idempotency)
 * @returns {boolean} true if duplicate, false if new
 */
async function isWebhookDuplicate(webhookId) {
  const redis = await getWebhookRedisClient();
  if (!redis) {
    // If Redis unavailable, allow processing (fail-open)
    return false;
  }

  try {
    // SET NX = set only if not exists, returns null if key exists
    const result = await redis.set(
      `webhook:idempotency:${webhookId}`,
      '1',
      'EX',
      WEBHOOK_IDEMPOTENCY_TTL,
      'NX'
    );
    return result === null; // null means key existed = duplicate
  } catch (error) {
    logger.error('Redis idempotency check failed:', error);
    return false; // Fail-open
  }
}

/**
 * Remove webhook idempotency key (allow retry after failure)
 */
async function removeWebhookIdempotencyKey(webhookId) {
  const redis = await getWebhookRedisClient();
  if (!redis) return;

  try {
    await redis.del(`webhook:idempotency:${webhookId}`);
  } catch (error) {
    logger.error('Failed to remove webhook idempotency key:', error);
  }
}

// Circuit breaker for QR generation to prevent cascading failures
const qrCircuitBreaker = getCircuitBreaker('qr-generation', {
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 60000,      // 60s cooldown
  timeout: 30000,           // 30s operation timeout
  successThreshold: 2       // 2 successes to close
});

// ============================
// HELPER: Validate salonId parameter
// ============================
function validateSalonId(salonId) {
  const id = parseInt(salonId, 10);
  if (isNaN(id) || id <= 0) {
    return null;
  }
  return id;
}

// ============================
// HELPER: Safe error response (hide stack traces)
// ============================
function safeErrorResponse(res, error, statusCode = 500) {
  const message = process.env.NODE_ENV === 'production'
    ? 'An error occurred'
    : error.message;

  return res.status(statusCode).json({
    error: message,
    code: error.code || 'INTERNAL_ERROR'
  });
}

// ============================
// ADMIN RATE LIMITER (in-memory, simple)
// 100 requests per minute per IP
// ============================
const adminRateLimitStore = new Map();
const ADMIN_RATE_LIMIT = 100; // requests per minute
const ADMIN_RATE_WINDOW = 60 * 1000; // 1 minute in ms

function adminRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const key = `admin:${ip}`;

  // Get or create rate limit entry
  let entry = adminRateLimitStore.get(key);
  if (!entry || now - entry.windowStart > ADMIN_RATE_WINDOW) {
    // New window
    entry = { count: 0, windowStart: now };
  }

  entry.count++;
  adminRateLimitStore.set(key, entry);

  // Clean up old entries periodically (every 100 requests)
  if (adminRateLimitStore.size > 100) {
    for (const [k, v] of adminRateLimitStore.entries()) {
      if (now - v.windowStart > ADMIN_RATE_WINDOW * 2) {
        adminRateLimitStore.delete(k);
      }
    }
  }

  // Check limit
  if (entry.count > ADMIN_RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.windowStart + ADMIN_RATE_WINDOW - now) / 1000);
    logger.warn('Admin rate limit exceeded', { ip, count: entry.count, limit: ADMIN_RATE_LIMIT });

    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter
    });
  }

  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': ADMIN_RATE_LIMIT,
    'X-RateLimit-Remaining': Math.max(0, ADMIN_RATE_LIMIT - entry.count),
    'X-RateLimit-Reset': Math.ceil((entry.windowStart + ADMIN_RATE_WINDOW) / 1000)
  });

  next();
}

// Initialize repositories
const companyRepository = new CompanyRepository(postgres);
const marketplaceEventsRepository = new MarketplaceEventsRepository(postgres);

// Инициализация
const sessionPool = getSessionPool();
const yclientsClient = new YclientsClient();

// Валидация критических переменных окружения
const PARTNER_TOKEN = process.env.YCLIENTS_PARTNER_TOKEN;
const APP_ID = process.env.YCLIENTS_APP_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.BASE_URL || 'https://ai-admin.app';

if (!PARTNER_TOKEN || !APP_ID || !JWT_SECRET) {
  logger.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют обязательные переменные окружения!');
  logger.error('Необходимо установить: YCLIENTS_PARTNER_TOKEN, YCLIENTS_APP_ID, JWT_SECRET');
}

// ============================
// 1. REGISTRATION REDIRECT - Точка входа из маркетплейса
// URL: /auth/yclients/redirect?salon_id=XXX
// ============================
router.get('/auth/yclients/redirect', async (req, res) => {
  try {
    // КРИТИЧНО: Проверка PARTNER_TOKEN перед любыми операциями
    if (!PARTNER_TOKEN || PARTNER_TOKEN === 'test_token_waiting_for_real') {
      logger.error('❌ PARTNER_TOKEN not configured properly');
      return res.status(503).send(renderErrorPage(
        'Конфигурация не завершена',
        'Интеграция еще не настроена администратором. Пожалуйста, свяжитесь с технической поддержкой AI Admin.',
        'https://yclients.com/marketplace'
      ));
    }

    // YClients sends data in two formats:
    // 1. salon_ids[0], salon_ids[1], etc. - array of salon IDs
    // 2. user_data - base64 encoded JSON with user info
    // 3. user_data_sign - signature for verification

    // Parse salon_id from salon_ids array or direct salon_id param
    let salon_id = req.query.salon_id;
    if (!salon_id && req.query['salon_ids[0]']) {
      salon_id = req.query['salon_ids[0]'];
    }
    // Also try parsing from Express array format
    if (!salon_id && req.query.salon_ids && Array.isArray(req.query.salon_ids)) {
      salon_id = req.query.salon_ids[0];
    }

    // Parse user_data from base64 encoded JSON
    let user_id, user_name, user_phone, user_email, salon_name;
    const { user_data, user_data_sign } = req.query;

    // Import validators for input sanitization
    const { sanitizeString, validateEmail, normalizePhone, validateId } = require('../../utils/validators');

    if (user_data) {
      // SECURITY: Log signature for debugging (algorithm TBD with YClients)
      // TODO: Enable HMAC verification once we confirm the algorithm with YClients support
      if (user_data_sign) {
        // Log for debugging - we need to determine the correct HMAC algorithm
        const testSignatures = {
          sha256_partner: crypto.createHmac('sha256', PARTNER_TOKEN).update(user_data).digest('hex'),
          sha256_app_id: crypto.createHmac('sha256', APP_ID).update(user_data).digest('hex'),
          md5_partner: crypto.createHash('md5').update(user_data + PARTNER_TOKEN).digest('hex'),
        };

        logger.info('🔐 HMAC signature debug (to determine algorithm):', {
          received: user_data_sign,
          sha256_partner_prefix: testSignatures.sha256_partner.substring(0, 16),
          sha256_app_id_prefix: testSignatures.sha256_app_id.substring(0, 16),
          md5_partner_prefix: testSignatures.md5_partner.substring(0, 16),
          match_sha256_partner: testSignatures.sha256_partner === user_data_sign,
          match_sha256_app_id: testSignatures.sha256_app_id === user_data_sign,
          match_md5_partner: testSignatures.md5_partner === user_data_sign,
        });

        // For now, just log and continue - enable strict verification after confirming algorithm
        logger.info('⚠️ HMAC verification DISABLED during moderation - proceeding with registration');
      } else {
        logger.warn('⚠️ user_data provided without signature', { salon_id });
      }

      // Now safe to parse user_data
      try {
        const decodedData = JSON.parse(Buffer.from(user_data, 'base64').toString('utf-8'));

        // SECURITY: Sanitize all input data
        user_id = validateId(decodedData.id);
        user_name = sanitizeString(decodedData.name, 255);
        user_phone = decodedData.phone ? normalizePhone(decodedData.phone) : null;
        user_email = decodedData.email && validateEmail(decodedData.email) ? decodedData.email : null;
        salon_name = sanitizeString(decodedData.salon_name, 255);

        logger.info('📋 Decoded and sanitized user_data:', {
          user_id,
          user_name,
          user_email,
          salon_name,
          is_approved: decodedData.is_approved
        });
      } catch (parseError) {
        logger.warn('⚠️ Failed to parse user_data:', parseError.message);
        Sentry.captureException(parseError, {
          tags: { component: 'marketplace', operation: 'parseUserData' },
          extra: { salon_id }
        });
      }
    }

    // Fallback to direct query params if user_data not provided (with sanitization)
    if (!user_id) user_id = validateId(req.query.user_id);
    if (!user_name) user_name = sanitizeString(req.query.user_name, 255);
    if (!user_phone) user_phone = req.query.user_phone ? normalizePhone(req.query.user_phone) : null;
    if (!user_email) user_email = req.query.user_email && validateEmail(req.query.user_email) ? req.query.user_email : null;

    logger.info('📍 Registration redirect from YClients Marketplace:', {
      salon_id,
      salon_name,
      user_id,
      user_name,
      user_phone,
      user_email,
      has_user_data: !!user_data,
      has_signature: !!user_data_sign
    });

    // Проверка обязательного параметра
    if (!salon_id) {
      logger.error('❌ salon_id отсутствует в запросе', {
        query_keys: Object.keys(req.query)
      });
      return res.status(400).send(renderErrorPage(
        'Ошибка подключения',
        'Не получен ID салона от YClients',
        'https://yclients.com/marketplace'
      ));
    }

    // Получаем информацию о салоне из YClients API
    let salonInfo = null;
    try {
      salonInfo = await yclientsClient.getCompanyInfo(salon_id);
      logger.info('✅ Информация о салоне получена:', {
        title: salonInfo.title,
        phone: salonInfo.phone
      });
    } catch (error) {
      logger.warn('⚠️ Не удалось получить информацию о салоне, продолжаем с базовыми данными', error.message);
    }

    // Создаем или обновляем запись в БД
    let company;
    try {
      company = await companyRepository.upsertByYclientsId({
        yclients_id: parseInt(salon_id),
        title: salonInfo?.title || salon_name || `Салон ${salon_id}`,
        phone: salonInfo?.phone || user_phone || '',
        email: salonInfo?.email || user_email || '',
        address: salonInfo?.address || '',
        timezone: salonInfo?.timezone || 'Europe/Moscow',
        integration_status: 'pending_whatsapp', // Ожидаем подключения WhatsApp
        marketplace_user_id: user_id,
        marketplace_user_name: user_name,
        marketplace_user_phone: user_phone,
        marketplace_user_email: user_email,
        whatsapp_connected: false,
        connected_at: new Date().toISOString()
      });
    } catch (dbError) {
      logger.error('❌ Ошибка сохранения в БД:', dbError);
      return res.status(500).send(renderErrorPage(
        'Ошибка сохранения данных',
        'Не удалось сохранить информацию о компании',
        'https://yclients.com/marketplace'
      ));
    }

    logger.info('✅ Компания создана/обновлена в БД:', {
      company_id: company.id,
      yclients_id: salon_id,
      title: company.title
    });

    // Генерируем JWT токен для безопасной передачи данных (срок действия 1 час)
    const token = jwt.sign(
      {
        company_id: company.id,
        salon_id: parseInt(salon_id),
        type: 'marketplace_registration',
        user_data: { user_id, user_name, user_phone, user_email }
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Сохраняем событие регистрации
    await marketplaceEventsRepository.insert({
      company_id: company.id,
      salon_id: parseInt(salon_id),
      event_type: 'registration_started',
      event_data: {
        user_id,
        user_name,
        user_phone,
        user_email,
        timestamp: new Date().toISOString()
      }
    });

    // Перенаправляем на страницу онбординга с QR-кодом
    const onboardingUrl = `${BASE_URL}/marketplace/onboarding?token=${token}`;
    logger.info('🔄 Redirecting to onboarding:', onboardingUrl);
    res.redirect(onboardingUrl);

  } catch (error) {
    logger.error('❌ Registration redirect error:', error);
    res.status(500).send(renderErrorPage(
      'Произошла ошибка',
      error.message,
      'https://yclients.com/marketplace'
    ));
  }
});

// ============================
// 2. ONBOARDING PAGE - Страница с QR-кодом
// URL: /marketplace/onboarding?token=XXX
// ============================
router.get('/marketplace/onboarding', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      logger.error('❌ Token отсутствует в запросе');
      return res.status(400).send(renderErrorPage(
        'Ошибка',
        'Отсутствует токен авторизации',
        'https://yclients.com/marketplace'
      ));
    }

    // Проверяем токен
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      logger.info('✅ Token validated for company:', decoded.company_id);
    } catch (error) {
      logger.error('❌ Invalid token:', error.message);
      return res.status(401).send(renderErrorPage(
        'Недействительный токен',
        'Токен истек или недействителен. Пожалуйста, начните процесс подключения заново.',
        'https://yclients.com/marketplace'
      ));
    }

    // Отправляем HTML страницу с QR-кодом
    res.sendFile(path.join(__dirname, '../../../public/marketplace/onboarding.html'));

  } catch (error) {
    logger.error('❌ Onboarding page error:', error);
    res.status(500).send(renderErrorPage(
      'Ошибка загрузки страницы',
      error.message,
      'https://yclients.com/marketplace'
    ));
  }
});

// ============================
// 3. QR CODE API - Генерация QR-кода для WhatsApp
// URL: POST /marketplace/api/qr
// Headers: Authorization: Bearer <token>
// Protected by circuit breaker to prevent cascading failures
// ============================
router.post('/marketplace/api/qr', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('❌ Authorization header missing or invalid');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { company_id, salon_id } = decoded;

    logger.info('📱 QR code request for company:', {
      company_id,
      salon_id,
      circuit_breaker_state: qrCircuitBreaker.getState().state
    });

    // Генерируем session ID для WhatsApp
    const sessionId = `company_${salon_id}`;

    // Check if QR already exists (outside circuit breaker - fast path)
    let qr = await sessionPool.getQR(sessionId);

    if (qr) {
      logger.info('✅ QR code already available (cached)');
      return res.json({
        success: true,
        qr,
        session_id: sessionId,
        expires_in: 20
      });
    }

    // QR generation protected by circuit breaker
    const result = await qrCircuitBreaker.execute(async () => {
      logger.info('🔄 Initializing new WhatsApp session...');

      // Initialize new session with error handling
      await sessionPool.createSession(sessionId, {
        company_id,
        salon_id
      });

      // Wait for QR generation with exponential backoff (reduced attempts)
      let attempts = 0;
      const maxAttempts = 5; // Reduced from 10 (circuit breaker adds protection)

      while (attempts < maxAttempts) {
        // Exponential backoff: 1s, 1.5s, 2.25s, ... max 5s
        const delay = Math.min(1000 * Math.pow(1.5, attempts), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        qr = await sessionPool.getQR(sessionId);

        if (qr) {
          return { qr, session_id: sessionId };
        }

        attempts++;

        if (attempts % 2 === 0) {
          logger.info(`⏳ Waiting for QR generation... (${attempts}/${maxAttempts})`);
        }
      }

      throw new Error(`QR code generation timeout after ${maxAttempts} attempts`);
    });

    logger.info('✅ QR code generated successfully');
    res.json({
      success: true,
      qr: result.qr,
      session_id: result.session_id,
      expires_in: 20 // QR код действителен 20 секунд
    });

  } catch (error) {
    logger.error('❌ QR generation error:', error);

    // Handle JWT errors first
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Handle circuit breaker OPEN state
    if (error.code === 'CIRCUIT_OPEN') {
      logger.warn('🔴 Circuit breaker OPEN for QR generation', {
        lastError: error.lastError?.message
      });
      Sentry.captureMessage('QR generation circuit breaker OPEN', {
        level: 'warning',
        tags: { component: 'marketplace', operation: 'qrGeneration' },
        extra: {
          state: qrCircuitBreaker.getState(),
          lastError: error.lastError?.message
        }
      });

      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'QR generation service is experiencing issues. Please try again in a few minutes.',
        code: 'SERVICE_UNAVAILABLE',
        retry_after: 60
      });
    }

    // Log to Sentry for other errors
    Sentry.captureException(error, {
      tags: { component: 'marketplace', operation: 'qrGeneration' },
      extra: {
        circuit_breaker_state: qrCircuitBreaker.getState()
      }
    });

    res.status(500).json({ error: 'QR generation failed: ' + error.message });
  }
});

// ============================
// 4. STATUS CHECK - Проверка статуса WhatsApp подключения
// URL: GET /marketplace/api/status/:sessionId
// Headers: Authorization: Bearer <token>
// ============================
router.get('/marketplace/api/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET); // Проверяем токен

    // Получаем статус сессии
    const status = await sessionPool.getSessionStatus(sessionId);
    const connected = status === 'connected' || status === 'open';

    logger.info('📊 Session status check:', { sessionId, status, connected });

    res.json({
      success: true,
      status,
      connected,
      session_id: sessionId
    });

  } catch (error) {
    logger.error('❌ Status check error:', error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.status(500).json({ error: 'Status check failed: ' + error.message });
  }
});

// ============================
// Feature flag for transaction-based activation
const USE_TRANSACTION_ACTIVATION = process.env.USE_TRANSACTION_ACTIVATION === 'true';

// 5. ACTIVATE INTEGRATION - Активация интеграции в YClients
// URL: POST /marketplace/activate
// Body: { token: <jwt_token> }
// ============================
router.post('/marketplace/activate', async (req, res) => {
  // Declare at function scope for catch block access
  let salon_id, company_id;

  try {
    const { token } = req.body;

    if (!token) {
      logger.error('❌ Token missing in activation request');
      return res.status(400).json({ error: 'Token required' });
    }

    // Верифицируем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    salon_id = decoded.salon_id;
    company_id = decoded.company_id;

    logger.info('🚀 Starting integration activation:', {
      salon_id,
      company_id,
      use_transaction: USE_TRANSACTION_ACTIVATION
    });

    // Проверяем, что прошло не больше часа с начала регистрации
    const latestEvent = await marketplaceEventsRepository.findLatestByType(salon_id, 'registration_started');

    if (!latestEvent) {
      logger.error('❌ Registration event not found');
      return res.status(400).json({ error: 'Registration not found' });
    }

    const registrationTime = new Date(latestEvent.created_at);
    const currentTime = new Date();
    const timeDiff = (currentTime - registrationTime) / 1000 / 60; // в минутах

    if (timeDiff > 60) {
      logger.error('❌ Registration expired:', { timeDiff });
      return res.status(400).json({
        error: 'Registration expired. Please restart from YClients marketplace.',
        expired_minutes_ago: Math.floor(timeDiff - 60)
      });
    }

    // ========================================
    // TRANSACTION-BASED ACTIVATION (NEW)
    // ========================================
    if (USE_TRANSACTION_ACTIVATION) {
      let yclientsData;
      const apiKey = crypto.randomBytes(32).toString('hex');

      // All DB operations in a transaction with advisory lock
      await companyRepository.withTransaction(async (txClient) => {
        // 1. Acquire advisory lock by salon_id to prevent concurrent activations
        const lockResult = await txClient.query(
          'SELECT pg_try_advisory_xact_lock($1)',
          [parseInt(salon_id)]
        );

        if (!lockResult.rows[0].pg_try_advisory_xact_lock) {
          logger.warn('⚠️ Concurrent activation attempt blocked', { salon_id, company_id });
          Sentry.captureMessage('Concurrent activation blocked by advisory lock', {
            level: 'warning',
            tags: { component: 'marketplace', operation: 'activate' },
            extra: { salon_id, company_id }
          });
          const lockError = new Error('Activation already in progress');
          lockError.code = 'CONCURRENT_ACTIVATION';
          throw lockError;
        }

        logger.info('🔒 Advisory lock acquired', { salon_id });

        // 2. Save API key with status='activating' (inside transaction)
        await txClient.query(
          `UPDATE companies SET api_key = $1, whatsapp_connected = true, integration_status = $2, updated_at = NOW()
           WHERE id = $3`,
          [apiKey, 'activating', company_id]
        );

        logger.info('💾 API key saved to database (transaction)');

        // 3. Call YClients API (inside transaction - if fails, everything rolls back)
        const callbackData = {
          salon_id: parseInt(salon_id),
          application_id: parseInt(APP_ID),
          api_key: apiKey,
          webhook_urls: [`${BASE_URL}/webhook/yclients`]
        };

        logger.info('📤 Sending callback to YClients:', {
          salon_id: callbackData.salon_id,
          application_id: callbackData.application_id,
          webhook_url: callbackData.webhook_urls[0]
        });

        const yclientsResponse = await fetch(
          'https://api.yclients.com/marketplace/partner/callback/redirect',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PARTNER_TOKEN}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.yclients.v2+json'
            },
            body: JSON.stringify(callbackData)
          }
        );

        if (!yclientsResponse.ok) {
          const errorText = await yclientsResponse.text();
          logger.error('❌ YClients activation failed:', {
            status: yclientsResponse.status,
            statusText: yclientsResponse.statusText,
            error: errorText
          });
          throw new Error(`YClients activation failed: ${yclientsResponse.status} ${errorText}`);
        }

        yclientsData = await yclientsResponse.json();
        logger.info('✅ YClients activation response:', yclientsData);

        // 4. Update status to 'active' (inside transaction)
        await txClient.query(
          `UPDATE companies SET integration_status = $1, whatsapp_connected_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          ['active', company_id]
        );

        logger.info('✅ Transaction committed successfully');
      });

      // Event logging OUTSIDE transaction (non-critical)
      try {
        await marketplaceEventsRepository.insert({
          company_id: company_id,
          salon_id: parseInt(salon_id),
          event_type: 'integration_activated',
          event_data: {
            yclients_response: yclientsData,
            timestamp: new Date().toISOString(),
            activation_mode: 'transaction'
          }
        });
      } catch (eventError) {
        logger.error('❌ Failed to log activation event (non-critical):', eventError);
        Sentry.captureException(eventError, {
          level: 'warning',
          tags: { component: 'marketplace', operation: 'event_logging' },
          extra: { salon_id, company_id }
        });
        // Don't fail - activation was successful
      }

      logger.info(`🎉 Integration activated successfully for salon ${salon_id} (transaction mode)`);

      return res.json({
        success: true,
        message: 'Integration activated successfully',
        company_id,
        salon_id,
        yclients_response: yclientsData
      });
    }

    // ========================================
    // LEGACY ACTIVATION (OLD - fallback)
    // ========================================

    // Генерируем уникальный API ключ для компании
    const apiKey = crypto.randomBytes(32).toString('hex');

    // Сохраняем API ключ в БД ПЕРЕД отправкой в YClients
    try {
      await companyRepository.update(company_id, {
        api_key: apiKey,
        whatsapp_connected: true,
        integration_status: 'activating'
      });
    } catch (updateError) {
      logger.error('❌ Failed to update company with API key:', updateError);
      throw new Error('Database update failed');
    }

    logger.info('💾 API key saved to database');

    // Формируем данные для callback в YClients
    const callbackData = {
      salon_id: parseInt(salon_id),
      application_id: parseInt(APP_ID),
      api_key: apiKey,
      webhook_urls: [
        `${BASE_URL}/webhook/yclients` // Правильный webhook endpoint
      ]
    };

    logger.info('📤 Sending callback to YClients:', {
      salon_id: callbackData.salon_id,
      application_id: callbackData.application_id,
      webhook_url: callbackData.webhook_urls[0]
    });

    // Отправляем callback в YClients для активации интеграции
    const yclientsResponse = await fetch(
      'https://api.yclients.com/marketplace/partner/callback/redirect',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PARTNER_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.yclients.v2+json'
        },
        body: JSON.stringify(callbackData)
      }
    );

    if (!yclientsResponse.ok) {
      const errorText = await yclientsResponse.text();
      logger.error('❌ YClients activation failed:', {
        status: yclientsResponse.status,
        statusText: yclientsResponse.statusText,
        error: errorText
      });
      throw new Error(`YClients activation failed: ${yclientsResponse.status} ${errorText}`);
    }

    const yclientsData = await yclientsResponse.json();
    logger.info('✅ YClients activation response:', yclientsData);

    // Обновляем статус интеграции на "active"
    await companyRepository.update(company_id, {
      integration_status: 'active',
      whatsapp_connected_at: new Date().toISOString()
    });

    // Логируем событие активации
    await marketplaceEventsRepository.insert({
      company_id: company_id,
      salon_id: parseInt(salon_id),
      event_type: 'integration_activated',
      event_data: {
        yclients_response: yclientsData,
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`🎉 Integration activated successfully for salon ${salon_id}`);

    res.json({
      success: true,
      message: 'Integration activated successfully',
      company_id,
      salon_id,
      yclients_response: yclientsData
    });

  } catch (error) {
    // Handle concurrent activation error (409 Conflict)
    if (error.code === 'CONCURRENT_ACTIVATION') {
      return res.status(409).json({
        error: 'Activation already in progress',
        code: 'CONCURRENT_ACTIVATION',
        retry_after: 5
      });
    }

    logger.error('❌ Activation error:', error);
    Sentry.captureException(error, {
      tags: { component: 'marketplace', operation: 'activate' },
      extra: { salon_id, company_id, use_transaction: USE_TRANSACTION_ACTIVATION }
    });

    // For transaction mode, rollback is automatic - just log the failure event
    if (USE_TRANSACTION_ACTIVATION) {
      try {
        await marketplaceEventsRepository.insert({
          company_id: company_id || null,
          salon_id: salon_id ? parseInt(salon_id) : null,
          event_type: 'activation_failed',
          event_data: {
            error: error.message,
            timestamp: new Date().toISOString(),
            activation_mode: 'transaction'
          }
        });
      } catch (eventError) {
        logger.error('❌ Failed to log failure event:', eventError);
      }

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    // Legacy mode: Manual rollback
    if (company_id) {
      try {
        await companyRepository.update(company_id, {
          api_key: null, // Clear leaked API key!
          integration_status: 'activation_failed'
        });

        // Log failed activation event
        await marketplaceEventsRepository.insert({
          company_id,
          salon_id: parseInt(salon_id),
          event_type: 'activation_failed',
          event_data: {
            error: error.message,
            timestamp: new Date().toISOString()
          }
        });

        logger.info('✅ Database rolled back after activation failure');
      } catch (rollbackError) {
        logger.error('❌ CRITICAL: Failed to rollback after activation error:', rollbackError);
        Sentry.captureException(rollbackError, {
          level: 'fatal',
          tags: { component: 'marketplace', operation: 'rollback' },
          extra: { salon_id, company_id, originalError: error.message }
        });
      }
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================
// 6. UNIVERSAL WEBHOOK COLLECTOR - Общий сборщик всех уведомлений
// URL: POST /webhook/yclients/collector
// Логирует ВСЕ входящие события для мониторинга
// ============================
router.post('/webhook/yclients/collector', async (req, res) => {
  try {
    const receivedAt = new Date().toISOString();

    logger.info('📥 [COLLECTOR] Webhook received:', {
      body_keys: Object.keys(req.body),
      content_type: req.headers['content-type'],
      ip: req.ip
    });

    // Сохраняем ВСЁ что пришло в базу данных
    const eventRecord = await marketplaceEventsRepository.insert({
      salon_id: req.body.salon_id ? parseInt(req.body.salon_id) : null,
      event_type: 'collector_' + (req.body.event_type || req.body.event || 'raw'),
      event_data: {
        raw_body: req.body,
        raw_headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
          'x-forwarded-for': req.headers['x-forwarded-for'],
          'x-real-ip': req.headers['x-real-ip']
        },
        ip: req.ip,
        received_at: receivedAt
      }
    });

    logger.info('✅ [COLLECTOR] Event saved:', { event_id: eventRecord?.id });

    res.status(200).json({
      success: true,
      message: 'Event received and logged',
      event_id: eventRecord?.id,
      received_at: receivedAt
    });

  } catch (error) {
    logger.error('❌ [COLLECTOR] Error:', error);
    Sentry.captureException(error, {
      tags: { component: 'webhook_collector' }
    });
    res.status(200).json({ success: false, error: error.message });
  }
});

// GET endpoint для просмотра собранных событий
router.get('/webhook/yclients/collector/events', adminRateLimiter, adminAuth, async (req, res) => {
  try {
    const { limit = 50, salon_id, event_type } = req.query;

    let sql = `
      SELECT id, salon_id, event_type, event_data, created_at
      FROM marketplace_events
      WHERE event_type LIKE 'collector_%'
    `;
    const params = [];
    let paramIndex = 1;

    if (salon_id) {
      sql += ` AND salon_id = $${paramIndex}`;
      params.push(parseInt(salon_id));
      paramIndex++;
    }

    if (event_type) {
      sql += ` AND event_type LIKE $${paramIndex}`;
      params.push(`%${event_type}%`);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await postgres.query(sql, params);

    res.json({
      success: true,
      count: result.rows.length,
      events: result.rows
    });

  } catch (error) {
    logger.error('❌ [COLLECTOR] Failed to get events:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================
// 7. WEBHOOK CALLBACK - Прием webhook событий от YClients (основной обработчик)
// URL: POST /webhook/yclients
// Phase 4: Added partner_token validation
// Phase 5: Added idempotency (deterministic hash, Redis check)
// ============================
router.post('/webhook/yclients', async (req, res) => {
  try {
    const { event_type, event, salon_id, application_id, partner_token, data } = req.body;

    // Use event_type or event (API may send either)
    const eventType = event_type || event;

    // Generate deterministic webhook ID for idempotency
    const webhookId = generateWebhookId(eventType, salon_id, data);

    logger.info('📨 YClients webhook received:', {
      event_type: eventType,
      salon_id,
      application_id,
      webhook_id: webhookId,
      has_partner_token: !!partner_token,
      data_keys: data ? Object.keys(data) : []
    });

    // Phase 4: Validate partner_token for security (REQUIRED!)
    // YClients sends partner_token in webhook body for verification
    if (!partner_token) {
      logger.error('❌ Webhook missing partner_token', {
        salon_id,
        event_type: eventType,
        webhook_id: webhookId,
        ip: req.ip
      });
      Sentry.captureMessage('YClients webhook without partner_token', {
        level: 'warning',
        tags: { component: 'webhook', security: true },
        extra: { salon_id, eventType, webhookId, ip: req.ip }
      });
      // Return 200 OK to prevent retry flooding, but don't process
      return res.status(200).json({ success: false, error: 'Missing partner_token' });
    }

    if (partner_token !== PARTNER_TOKEN) {
      logger.error('❌ Webhook validation failed: Invalid partner_token', {
        salon_id,
        event_type: eventType,
        webhook_id: webhookId,
        received_token_prefix: partner_token.substring(0, 8) + '...'
      });
      Sentry.captureMessage('YClients webhook with invalid partner_token', {
        level: 'warning',
        tags: { component: 'webhook', security: true },
        extra: { salon_id, eventType, webhookId }
      });
      // Return 200 OK to prevent retry flooding, but don't process
      return res.status(200).json({ success: false, error: 'Invalid partner_token' });
    }

    // Validate application_id if provided
    if (application_id && parseInt(application_id) !== parseInt(APP_ID)) {
      logger.warn('⚠️ Webhook for different application:', {
        received_app_id: application_id,
        our_app_id: APP_ID,
        webhook_id: webhookId
      });
      // Still return 200 OK but skip processing
      return res.status(200).json({ success: true, skipped: 'different_application' });
    }

    // Phase 5: Idempotency check - skip if already processed
    const isDuplicate = await isWebhookDuplicate(webhookId);
    if (isDuplicate) {
      logger.info('🔄 Skipping duplicate webhook:', {
        event_type: eventType,
        salon_id,
        webhook_id: webhookId
      });
      // Return 200 OK - YClients should not retry
      return res.status(200).json({
        success: true,
        skipped: 'duplicate',
        webhook_id: webhookId
      });
    }

    // Быстро отвечаем YClients (они ожидают 200 OK)
    res.status(200).json({
      success: true,
      received: true,
      webhook_id: webhookId
    });

    // Обрабатываем событие асинхронно
    setImmediate(async () => {
      try {
        await handleWebhookEvent(eventType, salon_id, data);
        logger.debug('✅ Webhook processed successfully:', { webhookId });
      } catch (error) {
        logger.error('❌ Webhook processing error:', {
          error: error.message,
          webhookId,
          eventType,
          salon_id
        });
        // Remove idempotency key to allow retry
        await removeWebhookIdempotencyKey(webhookId);
        logger.info('🔄 Idempotency key removed - retry allowed:', { webhookId });
      }
    });

  } catch (error) {
    logger.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================
// 7. HEALTH CHECK - Проверка готовности системы
// URL: GET /marketplace/health
// ============================
router.get('/marketplace/health', async (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      partner_token: !!PARTNER_TOKEN,
      app_id: !!APP_ID,
      jwt_secret: !!JWT_SECRET,
      base_url: BASE_URL,
      node_version: process.version
    },
    dependencies: {
      express: !!express,
      jsonwebtoken: !!jwt,
      postgres: !!postgres,
      session_pool: !!sessionPool
    },
    services: {
      api_running: true,
      database_connected: !!postgres,
      whatsapp_pool_ready: !!sessionPool
    },
    circuitBreakers: {
      qrGeneration: qrCircuitBreaker.getState()
    },
    featureFlags: {
      USE_TRANSACTION_ACTIVATION
    }
  };

  // Проверяем критические компоненты
  const criticalChecks = [PARTNER_TOKEN, APP_ID, JWT_SECRET];

  if (!criticalChecks.every(check => check)) {
    healthStatus.status = 'error';
    healthStatus.message = 'Missing critical environment variables';
    healthStatus.missing = [];
    if (!PARTNER_TOKEN) healthStatus.missing.push('YCLIENTS_PARTNER_TOKEN');
    if (!APP_ID) healthStatus.missing.push('YCLIENTS_APP_ID');
    if (!JWT_SECRET) healthStatus.missing.push('JWT_SECRET');

    return res.status(503).json(healthStatus);
  }

  // Database connectivity check with timeout
  try {
    const start = Date.now();
    await postgres.query('SELECT 1');
    healthStatus.services.database_latency_ms = Date.now() - start;
    healthStatus.services.database_connected = true;
  } catch (dbError) {
    healthStatus.services.database_connected = false;
    healthStatus.services.database_error = dbError.message;
    healthStatus.status = 'degraded';
  }

  // Warn if circuit breaker is OPEN
  if (healthStatus.circuitBreakers.qrGeneration.state === 'open') {
    healthStatus.status = 'degraded';
    healthStatus.warnings = healthStatus.warnings || [];
    healthStatus.warnings.push('QR generation circuit breaker is OPEN');
  }

  const httpStatus = healthStatus.status === 'ok' ? 200 :
                     healthStatus.status === 'degraded' ? 200 : 503;
  res.status(httpStatus).json(healthStatus);
});

// ============================
// HELPER FUNCTIONS
// ============================

/**
 * Обработка webhook событий от YClients
 * Phase 4: Updated - only 'uninstall' and 'freeze' events exist for marketplace
 * NOTE: 'payment' webhook does NOT exist - payment is OUTBOUND (we notify YClients)
 */
async function handleWebhookEvent(eventType, salonId, data) {
  logger.info(`🔄 Processing webhook event: ${eventType} for salon ${salonId}`);

  switch (eventType) {
    case 'uninstall':
      await handleUninstall(salonId);
      break;

    case 'freeze':
      await handleFreeze(salonId);
      break;

    case 'record_created':
    case 'record_updated':
    case 'record_deleted':
      // Эти события обрабатываются в webhook-processor
      logger.info(`📋 Record event: ${eventType} for salon ${salonId}`);
      break;

    default:
      // Log unknown events for monitoring but don't throw
      // This helps us discover if YClients adds new event types
      logger.info(`📌 Unknown/new webhook event type: ${eventType}`, {
        salonId,
        eventType,
        dataKeys: data ? Object.keys(data) : []
      });

      // Log to marketplace_events for tracking
      try {
        await marketplaceEventsRepository.insert({
          salon_id: parseInt(salonId) || null,
          event_type: `webhook_unknown_${eventType}`,
          event_data: { original_event: eventType, data }
        });
      } catch (logError) {
        logger.warn('Failed to log unknown webhook event:', logError.message);
      }
  }
}

/**
 * Обработка удаления приложения
 */
async function handleUninstall(salonId) {
  logger.info(`🗑️ Handling uninstall for salon ${salonId}`);

  // Останавливаем WhatsApp сессию
  const sessionId = `company_${salonId}`;
  try {
    await sessionPool.removeSession(sessionId);
    logger.info('✅ WhatsApp session removed');
  } catch (error) {
    logger.error('❌ Failed to remove WhatsApp session:', error);
  }

  // Обновляем статус в БД
  await companyRepository.updateByYclientsId(parseInt(salonId), {
    integration_status: 'uninstalled',
    whatsapp_connected: false
  });

  logger.info('✅ Company marked as uninstalled');
}

/**
 * Обработка заморозки приложения
 */
async function handleFreeze(salonId) {
  logger.info(`❄️ Handling freeze for salon ${salonId}`);

  await companyRepository.updateByYclientsId(parseInt(salonId), {
    integration_status: 'frozen'
  });

  logger.info('✅ Company marked as frozen');
}

// NOTE: handlePayment() removed in Phase 4
// Payment is OUTBOUND (we notify YClients via notifyYclientsAboutPayment)
// There is NO incoming payment webhook from YClients

// ============================
// ADMIN API ROUTES - Phase 3: Marketplace Administration
// These routes require admin authentication
// ============================

// Import MarketplaceService for admin operations
const MarketplaceService = require('../../services/marketplace/marketplace-service');
let marketplaceServiceInstance = null;

/**
 * Get or create MarketplaceService singleton
 */
async function getMarketplaceService() {
  if (!marketplaceServiceInstance) {
    marketplaceServiceInstance = new MarketplaceService();
    await marketplaceServiceInstance.init();
  }
  return marketplaceServiceInstance;
}

/**
 * Admin authentication middleware with RBAC
 * Supports JWT tokens and API keys with role-based access control
 */
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // No credentials provided
  if (!authHeader && !apiKey) {
    logger.warn('Admin auth: No credentials provided', { ip: req.ip, path: req.path });
    return res.status(401).json({ error: 'Authorization required' });
  }

  // Method 1: JWT token authentication
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      // RBAC: Check for admin role in JWT payload
      const allowedRoles = ['admin', 'superadmin', 'marketplace_admin'];
      if (decoded.role && !allowedRoles.includes(decoded.role)) {
        logger.warn('Admin auth: Insufficient role', {
          ip: req.ip,
          path: req.path,
          userId: decoded.id || decoded.sub,
          role: decoded.role
        });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions. Admin role required.'
        });
      }

      req.adminUser = {
        type: 'jwt',
        id: decoded.id || decoded.sub,
        role: decoded.role || 'admin',
        email: decoded.email
      };

      // Audit log for admin actions
      logger.info('Admin auth: JWT authenticated', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.adminUser.id,
        role: req.adminUser.role
      });

      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', message: 'Please refresh your token' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token', message: 'Token signature is invalid' });
      }
      logger.error('Admin auth: JWT verification failed', { error: error.message });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Method 2: API key authentication (timing-safe comparison)
  if (apiKey) {
    const expectedKey = process.env.ADMIN_API_KEY;
    if (!expectedKey) {
      logger.error('Admin auth: ADMIN_API_KEY not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Timing-safe comparison to prevent timing attacks
    const apiKeyBuffer = Buffer.from(apiKey);
    const expectedKeyBuffer = Buffer.from(expectedKey);

    // Length check first (constant time for same-length comparison)
    if (apiKeyBuffer.length !== expectedKeyBuffer.length) {
      logger.warn('Admin auth: Invalid API key (length mismatch)', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!crypto.timingSafeEqual(apiKeyBuffer, expectedKeyBuffer)) {
      logger.warn('Admin auth: Invalid API key', { ip: req.ip, path: req.path });
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.adminUser = {
      type: 'api_key',
      role: 'admin'
    };

    // Audit log for API key access
    logger.info('Admin auth: API key authenticated', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    return next();
  }

  return res.status(401).json({ error: 'Invalid authorization' });
}

// ============================
// 8. ADMIN: GET CONNECTED SALONS
// GET /marketplace/admin/salons
// ============================
router.get('/marketplace/admin/salons', adminRateLimiter, adminAuth, async (req, res) => {
  try {
    const { page = 1, count = 100 } = req.query;

    logger.info('Admin: Getting connected salons', { page, count });

    const service = await getMarketplaceService();
    const result = await service.getActiveConnections(parseInt(page), parseInt(count));

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to get salons:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================
// 9. ADMIN: GET SALON STATUS
// GET /marketplace/admin/salon/:salonId/status
// ============================
router.get('/marketplace/admin/salon/:salonId/status', adminRateLimiter, adminAuth, async (req, res) => {
  try {
    const validSalonId = validateSalonId(req.params.salonId);
    if (!validSalonId) {
      return res.status(400).json({ error: 'Invalid salon_id', code: 'INVALID_SALON_ID' });
    }

    logger.info('Admin: Getting salon status', { salonId: validSalonId });

    const service = await getMarketplaceService();
    const result = await service.checkIntegrationHealth(validSalonId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to get salon status:', error);
    Sentry.captureException(error, { tags: { route: 'admin_salon_status' } });
    safeErrorResponse(res, error);
  }
});

// ============================
// 10. ADMIN: DISCONNECT SALON
// POST /marketplace/admin/salon/:salonId/disconnect
// ============================
router.post('/marketplace/admin/salon/:salonId/disconnect', adminRateLimiter, adminAuth, async (req, res) => {
  const validSalonId = validateSalonId(req.params.salonId);
  try {
    if (!validSalonId) {
      return res.status(400).json({ error: 'Invalid salon_id', code: 'INVALID_SALON_ID' });
    }
    const { reason } = req.body;

    logger.warn('Admin: Disconnecting salon', { salonId: validSalonId, reason, admin: req.adminUser });

    const service = await getMarketplaceService();
    const result = await service.disconnectSalon(validSalonId, reason || 'Admin requested');

    if (result.success) {
      // Audit log: successful disconnect
      await logAdminAction(postgres, req, {
        action: 'disconnect_salon',
        resourceType: 'salon',
        resourceId: validSalonId,
        responseStatus: 200
      });
      res.json({ success: true, message: 'Salon disconnected successfully' });
    } else {
      // Audit log: failed disconnect
      await logAdminAction(postgres, req, {
        action: 'disconnect_salon',
        resourceType: 'salon',
        resourceId: validSalonId,
        responseStatus: 500,
        errorMessage: result.error
      });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to disconnect salon:', error);
    Sentry.captureException(error, { tags: { route: 'admin_disconnect_salon' } });
    // Audit log: exception
    await logAdminAction(postgres, req, {
      action: 'disconnect_salon',
      resourceType: 'salon',
      resourceId: validSalonId,
      responseStatus: 500,
      errorMessage: error.message
    });
    safeErrorResponse(res, error);
  }
});

// ============================
// 11. ADMIN: GET PAYMENT LINK
// GET /marketplace/admin/salon/:salonId/payment-link
// ============================
router.get('/marketplace/admin/salon/:salonId/payment-link', adminRateLimiter, adminAuth, async (req, res) => {
  try {
    const validSalonId = validateSalonId(req.params.salonId);
    if (!validSalonId) {
      return res.status(400).json({ error: 'Invalid salon_id', code: 'INVALID_SALON_ID' });
    }
    const { discount } = req.query;

    logger.info('Admin: Generating payment link', { salonId: validSalonId, discount });

    const service = await getMarketplaceService();
    const result = await service.generatePaymentLink(
      validSalonId,
      discount ? parseFloat(discount) : null
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to generate payment link:', error);
    Sentry.captureException(error, { tags: { route: 'admin_payment_link' } });
    safeErrorResponse(res, error);
  }
});

// ============================
// 12. ADMIN: NOTIFY PAYMENT
// POST /marketplace/admin/payment/notify
// ============================
router.post('/marketplace/admin/payment/notify', adminRateLimiter, adminAuth, async (req, res) => {
  const { salon_id, payment_sum, currency_iso, payment_date, period_from, period_to } = req.body;
  try {
    if (!salon_id || !payment_sum || !payment_date || !period_from || !period_to) {
      return res.status(400).json({
        error: 'Missing required fields: salon_id, payment_sum, payment_date, period_from, period_to'
      });
    }

    logger.info('Admin: Notifying payment', { salon_id, payment_sum });

    const service = await getMarketplaceService();
    const result = await service.notifyYclientsAboutPayment(parseInt(salon_id), {
      payment_sum,
      currency_iso: currency_iso || 'RUB',
      payment_date,
      period_from,
      period_to
    });

    if (result.success) {
      // Audit log: successful payment notification
      await logAdminAction(postgres, req, {
        action: 'notify_payment',
        resourceType: 'payment',
        resourceId: result.data?.id || salon_id,
        responseStatus: 200
      });
      res.json({
        success: true,
        payment_id: result.data?.id,
        message: 'Payment notification sent successfully'
      });
    } else {
      // Audit log: failed payment notification
      await logAdminAction(postgres, req, {
        action: 'notify_payment',
        resourceType: 'payment',
        resourceId: salon_id,
        responseStatus: 500,
        errorMessage: result.error
      });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to notify payment:', error);
    Sentry.captureException(error, { tags: { route: 'admin_notify_payment' } });
    // Audit log: exception
    await logAdminAction(postgres, req, {
      action: 'notify_payment',
      resourceType: 'payment',
      resourceId: salon_id,
      responseStatus: 500,
      errorMessage: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

// ============================
// 13. ADMIN: NOTIFY REFUND
// POST /marketplace/admin/payment/:id/refund
// ============================
router.post('/marketplace/admin/payment/:id/refund', adminRateLimiter, adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { reason } = req.body;

    logger.info('Admin: Notifying refund', { paymentId: id, reason });

    const service = await getMarketplaceService();
    const result = await service.notifyYclientsAboutRefund(parseInt(id), reason || '');

    if (result.success) {
      // Audit log: successful refund notification
      await logAdminAction(postgres, req, {
        action: 'notify_refund',
        resourceType: 'payment',
        resourceId: id,
        responseStatus: 200
      });
      res.json({ success: true, message: 'Refund notification sent successfully' });
    } else {
      // Audit log: failed refund notification
      await logAdminAction(postgres, req, {
        action: 'notify_refund',
        resourceType: 'payment',
        resourceId: id,
        responseStatus: 500,
        errorMessage: result.error
      });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to notify refund:', error);
    // Audit log: exception
    await logAdminAction(postgres, req, {
      action: 'notify_refund',
      resourceType: 'payment',
      resourceId: id,
      responseStatus: 500,
      errorMessage: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

// ============================
// 14. ADMIN: GET TARIFFS
// GET /marketplace/admin/tariffs
// ============================
router.get('/marketplace/admin/tariffs', adminRateLimiter, adminAuth, async (req, res) => {
  try {
    logger.info('Admin: Getting tariffs');

    const service = await getMarketplaceService();
    const result = await service.getTariffs();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to get tariffs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================
// 15. ADMIN: ADD DISCOUNTS
// POST /marketplace/admin/discounts
// ============================
router.post('/marketplace/admin/discounts', adminRateLimiter, adminAuth, async (req, res) => {
  try {
    const { salon_ids, discount_percent } = req.body;

    if (!Array.isArray(salon_ids) || salon_ids.length === 0) {
      return res.status(400).json({ error: 'salon_ids must be a non-empty array' });
    }

    if (typeof discount_percent !== 'number' || discount_percent <= 0 || discount_percent > 100) {
      return res.status(400).json({ error: 'discount_percent must be a number between 0 and 100' });
    }

    logger.info('Admin: Adding discounts', { salonCount: salon_ids.length, discount_percent });

    const service = await getMarketplaceService();
    const result = await service.addDiscount(salon_ids.map(id => parseInt(id)), discount_percent);

    if (result.success) {
      res.json({ success: true, message: 'Discounts added successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to add discounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================
// 16. ADMIN: UPDATE CHANNEL
// POST /marketplace/admin/salon/:salonId/channels
// ============================
router.post('/marketplace/admin/salon/:salonId/channels', adminRateLimiter, adminAuth, async (req, res) => {
  const validSalonId = validateSalonId(req.params.salonId);
  const { channel, enabled } = req.body;
  try {
    if (!validSalonId) {
      return res.status(400).json({ error: 'Invalid salon_id', code: 'INVALID_SALON_ID' });
    }

    if (!channel || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'channel and enabled (boolean) are required' });
    }

    logger.info('Admin: Updating channel', { salonId: validSalonId, channel, enabled });

    const service = await getMarketplaceService();
    const result = await service.updateNotificationChannel(validSalonId, channel, enabled);

    if (result.success) {
      // Audit log: successful channel update
      await logAdminAction(postgres, req, {
        action: enabled ? 'enable_channel' : 'disable_channel',
        resourceType: 'salon',
        resourceId: validSalonId,
        responseStatus: 200
      });
      res.json({ success: true, message: `Channel ${channel} ${enabled ? 'enabled' : 'disabled'}` });
    } else {
      // Audit log: failed channel update
      await logAdminAction(postgres, req, {
        action: enabled ? 'enable_channel' : 'disable_channel',
        resourceType: 'salon',
        resourceId: validSalonId,
        responseStatus: 500,
        errorMessage: result.error
      });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to update channel:', error);
    Sentry.captureException(error, { tags: { route: 'admin_update_channel' } });
    // Audit log: exception
    await logAdminAction(postgres, req, {
      action: enabled ? 'enable_channel' : 'disable_channel',
      resourceType: 'salon',
      resourceId: validSalonId,
      responseStatus: 500,
      errorMessage: error.message
    });
    safeErrorResponse(res, error);
  }
});

// ============================
// 17. ADMIN: SET SMS NAMES
// POST /marketplace/admin/salon/:salonId/sms-names
// ============================
router.post('/marketplace/admin/salon/:salonId/sms-names', adminRateLimiter, adminAuth, async (req, res) => {
  try {
    const validSalonId = validateSalonId(req.params.salonId);
    if (!validSalonId) {
      return res.status(400).json({ error: 'Invalid salon_id', code: 'INVALID_SALON_ID' });
    }
    const { short_names } = req.body;

    if (!Array.isArray(short_names)) {
      return res.status(400).json({ error: 'short_names must be an array of strings' });
    }

    logger.info('Admin: Setting SMS short names', { salonId: validSalonId, short_names });

    const service = await getMarketplaceService();
    const result = await service.setSmsShortNames(validSalonId, short_names);

    if (result.success) {
      res.json({ success: true, message: 'SMS short names updated successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Admin: Failed to set SMS names:', error);
    Sentry.captureException(error, { tags: { route: 'admin_sms_names' } });
    safeErrorResponse(res, error);
  }
});

// ============================
// 18. ADMIN: GET AUDIT LOG
// GET /marketplace/admin/audit-log
// Requires superadmin role
// ============================
router.get('/marketplace/admin/audit-log', adminRateLimiter, adminAuth, async (req, res) => {
  try {
    // Only superadmin can view audit logs
    if (req.adminUser?.role !== 'superadmin') {
      logger.warn('Audit log access denied - not superadmin', { admin: req.adminUser });
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only superadmin can view audit logs'
      });
    }

    const {
      admin_id: adminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      date_from: dateFrom,
      date_to: dateTo,
      limit = 50,
      offset = 0
    } = req.query;

    logger.info('Admin: Getting audit logs', {
      adminId,
      action,
      resourceType,
      resourceId,
      limit,
      offset
    });

    const result = await getAuditLogs(postgres, {
      adminId,
      action,
      resourceType,
      resourceId,
      dateFrom,
      dateTo,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Admin: Failed to get audit logs:', error);
    Sentry.captureException(error, { tags: { route: 'admin_audit_log' } });
    safeErrorResponse(res, error);
  }
});

// ============================
// HELPER FUNCTIONS
// ============================

/**
 * Рендер страницы с ошибкой
 */
function renderErrorPage(title, message, returnUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          text-align: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 500px;
        }
        .error-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          color: #e74c3c;
          font-size: 24px;
          margin-bottom: 10px;
        }
        p {
          color: #666;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .button {
          background: #3498db;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          display: inline-block;
          transition: background 0.3s;
        }
        .button:hover {
          background: #2980b9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">⚠️</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${returnUrl}" class="button">Вернуться в маркетплейс</a>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;
