// src/api/routes/yclients-marketplace.js
// YClients Marketplace Integration - ПРАВИЛЬНАЯ РЕАЛИЗАЦИЯ согласно документации
// https://docs.yclients.com/marketplace

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { supabase } = require('../../database/supabase');
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');
const { YclientsClient } = require('../../integrations/yclients/client');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');

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
    const { salon_id, user_id, user_name, user_phone, user_email } = req.query;

    logger.info('📍 Registration redirect from YClients Marketplace:', {
      salon_id,
      user_id,
      user_name,
      user_phone,
      user_email
    });

    // Проверка обязательного параметра
    if (!salon_id) {
      logger.error('❌ salon_id отсутствует в запросе');
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
    const { data: company, error: dbError } = await supabase
      .from('companies')
      .upsert({
        yclients_id: parseInt(salon_id),
        name: salonInfo?.title || `Салон ${salon_id}`,
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
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'yclients_id',
        returning: 'representation'
      })
      .select()
      .single();

    if (dbError) {
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
      name: company.name
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
    await supabase
      .from('marketplace_events')
      .insert({
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

    logger.info('📱 QR code request for company:', { company_id, salon_id });

    // Генерируем session ID для WhatsApp
    const sessionId = `company_${salon_id}`;

    // Проверяем существующий QR-код
    let qr = await sessionPool.getQR(sessionId);

    if (!qr) {
      logger.info('🔄 Initializing new WhatsApp session...');

      // Инициализируем новую сессию
      await sessionPool.createSession(sessionId, {
        company_id,
        salon_id
      });

      // Ждем генерации QR (максимум 10 секунд)
      let attempts = 0;
      while (!qr && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        qr = await sessionPool.getQR(sessionId);
        attempts++;
      }

      if (!qr) {
        throw new Error('QR code generation timeout');
      }
    }

    logger.info('✅ QR code generated successfully');
    res.json({
      success: true,
      qr,
      session_id: sessionId,
      expires_in: 20 // QR код действителен 20 секунд
    });

  } catch (error) {
    logger.error('❌ QR generation error:', error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

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
// 5. ACTIVATE INTEGRATION - Активация интеграции в YClients
// URL: POST /marketplace/activate
// Body: { token: <jwt_token> }
// ============================
router.post('/marketplace/activate', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      logger.error('❌ Token missing in activation request');
      return res.status(400).json({ error: 'Token required' });
    }

    // Верифицируем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    const { salon_id, company_id } = decoded;

    logger.info('🚀 Starting integration activation:', { salon_id, company_id });

    // Проверяем, что прошло не больше часа с начала регистрации
    const { data: events, error: eventError } = await supabase
      .from('marketplace_events')
      .select('*')
      .eq('salon_id', salon_id)
      .eq('event_type', 'registration_started')
      .order('created_at', { ascending: false })
      .limit(1);

    if (eventError || !events || events.length === 0) {
      logger.error('❌ Registration event not found');
      return res.status(400).json({ error: 'Registration not found' });
    }

    const registrationTime = new Date(events[0].created_at);
    const currentTime = new Date();
    const timeDiff = (currentTime - registrationTime) / 1000 / 60; // в минутах

    if (timeDiff > 60) {
      logger.error('❌ Registration expired:', { timeDiff });
      return res.status(400).json({
        error: 'Registration expired. Please restart from YClients marketplace.',
        expired_minutes_ago: Math.floor(timeDiff - 60)
      });
    }

    // Генерируем уникальный API ключ для компании
    const apiKey = crypto.randomBytes(32).toString('hex');

    // Сохраняем API ключ в БД ПЕРЕД отправкой в YClients
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        api_key: apiKey,
        whatsapp_connected: true,
        integration_status: 'activating',
        updated_at: new Date().toISOString()
      })
      .eq('id', company_id);

    if (updateError) {
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
    await supabase
      .from('companies')
      .update({
        integration_status: 'active',
        whatsapp_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', company_id);

    // Логируем событие активации
    await supabase
      .from('marketplace_events')
      .insert({
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
    logger.error('❌ Activation error:', error);

    // Откатываем статус в случае ошибки
    if (error.decoded && error.decoded.company_id) {
      await supabase
        .from('companies')
        .update({
          integration_status: 'activation_failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', error.decoded.company_id);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================
// 6. WEBHOOK CALLBACK - Прием webhook событий от YClients
// URL: POST /webhook/yclients
// ============================
router.post('/webhook/yclients', async (req, res) => {
  try {
    const { event_type, salon_id, data } = req.body;

    logger.info('📨 YClients webhook received:', {
      event_type,
      salon_id,
      data_keys: data ? Object.keys(data) : []
    });

    // Быстро отвечаем YClients (они ожидают 200 OK)
    res.status(200).json({ success: true, received: true });

    // Обрабатываем событие асинхронно
    setImmediate(async () => {
      try {
        await handleWebhookEvent(event_type, salon_id, data);
      } catch (error) {
        logger.error('❌ Webhook processing error:', error);
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
router.get('/marketplace/health', (req, res) => {
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
      supabase: !!supabase,
      session_pool: !!sessionPool
    },
    services: {
      api_running: true,
      database_connected: !!supabase,
      whatsapp_pool_ready: !!sessionPool
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

  res.json(healthStatus);
});

// ============================
// HELPER FUNCTIONS
// ============================

/**
 * Обработка webhook событий от YClients
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

    case 'payment':
      await handlePayment(salonId, data);
      break;

    case 'record_created':
    case 'record_updated':
    case 'record_deleted':
      // Эти события обрабатываются в webhook-processor
      logger.info(`📋 Record event: ${eventType} for salon ${salonId}`);
      break;

    default:
      logger.warn(`⚠️ Unknown webhook event type: ${eventType}`);
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
  await supabase
    .from('companies')
    .update({
      integration_status: 'uninstalled',
      whatsapp_connected: false,
      updated_at: new Date().toISOString()
    })
    .eq('yclients_id', parseInt(salonId));

  logger.info('✅ Company marked as uninstalled');
}

/**
 * Обработка заморозки приложения
 */
async function handleFreeze(salonId) {
  logger.info(`❄️ Handling freeze for salon ${salonId}`);

  await supabase
    .from('companies')
    .update({
      integration_status: 'frozen',
      updated_at: new Date().toISOString()
    })
    .eq('yclients_id', parseInt(salonId));

  logger.info('✅ Company marked as frozen');
}

/**
 * Обработка платежа
 */
async function handlePayment(salonId, data) {
  logger.info(`💰 Payment received for salon ${salonId}:`, data);

  await supabase
    .from('companies')
    .update({
      integration_status: 'active',
      last_payment_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('yclients_id', parseInt(salonId));

  logger.info('✅ Payment processed');
}

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
