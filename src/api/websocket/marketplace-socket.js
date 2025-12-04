// src/api/websocket/marketplace-socket.js
// WebSocket обработчик для маркетплейса

const logger = require('../../utils/logger');
const jwt = require('jsonwebtoken');
const Sentry = require('@sentry/node');
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');
const { normalizePhoneE164, validateCountryCode, maskPhone } = require('../../integrations/whatsapp/phone-utils');

class MarketplaceSocket {
  constructor(io) {
    this.io = io;
    this.sessionPool = getSessionPool();
    this.connections = new Map(); // sessionId -> socket
    this.rateLimiter = new Map(); // IP -> { count, lastReset }
    this.pairingCodeRequests = new Map(); // sessionId -> Promise (mutex for pairing code)
    this.pairingCodeInProgress = new Map(); // sessionId -> { phone, startTime } (prevents reconnection during pairing)
    this.RATE_LIMIT_MAX = 5; // Максимум 5 подключений
    this.RATE_LIMIT_WINDOW = 60000; // За 60 секунд

    // Создаем namespace для маркетплейса
    this.namespace = io.of('/marketplace');
    this.setupHandlers();

    // Запускаем периодическую очистку rate limiter
    this.startCleanupTimer();
  }

  setupHandlers() {
    this.namespace.on('connection', (socket) => {
      logger.info('🔌 Новое WebSocket соединение для маркетплейса', {
        socketId: socket.id,
        query: socket.handshake.query
      });

      // Rate limiting по IP
      const clientIp = socket.handshake.address;
      if (!this.checkRateLimit(clientIp)) {
        logger.warn('Rate limit превышен для IP:', clientIp);
        socket.emit('error', { message: 'Слишком много подключений, попробуйте позже' });
        socket.disconnect();
        return;
      }

      // Проверка origin (только в production)
      if (process.env.NODE_ENV === 'production') {
        const allowedOrigins = [
          'https://adminai.tech',
          'https://ai-admin.app',
          'https://yclients.com'
        ];
        const origin = socket.handshake.headers.origin;

        // Dynamic validation for YClients salon subdomains (e.g., https://n997441.yclients.com)
        const isYclientsSubdomain = origin && /^https:\/\/n\d+\.yclients\.com$/.test(origin);

        if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed)) && !isYclientsSubdomain) {
          logger.warn('Недопустимый origin:', origin);
          socket.emit('error', { message: 'Недопустимый источник запроса' });
          socket.disconnect();
          return;
        }
      }

      // Получаем токен из headers или auth (Socket.IO v4)
      const authHeader = socket.handshake.headers.authorization;
      const authToken = socket.handshake.auth?.token;
      let token = null;

      // Приоритет отдаем токену из headers, затем из auth
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (authToken) {
        token = authToken;
      } else if (socket.handshake.query.token) {
        // Fallback на query параметр (для обратной совместимости)
        token = socket.handshake.query.token;
        logger.warn('Токен передан через query параметры - небезопасно! Используйте Authorization header или auth.');
      }

      // Проверяем наличие токена
      if (!token) {
        logger.error('WebSocket: отсутствует токен авторизации');
        socket.emit('error', { message: 'Требуется авторизация' });
        socket.disconnect();
        return;
      }

      // Валидируем токен и извлекаем companyId
      let companyId;
      try {
        // Проверяем наличие JWT_SECRET
        if (!process.env.JWT_SECRET) {
          logger.error('JWT_SECRET не установлен в переменных окружения');
          socket.emit('error', { message: 'Ошибка конфигурации сервера' });
          socket.disconnect();
          return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Извлекаем данные из токена (безопасно)
        companyId = decoded.company_id;  // Internal DB ID
        const salonId = decoded.salon_id;  // YClients salon ID

        if (!companyId || !salonId) {
          throw new Error('Токен не содержит company_id или salon_id');
        }

        // CRITICAL: Session ID должен совпадать с REST API (company_${salon_id})
        const sessionId = `company_${salonId}`;

        // Сохраняем соединение
        socket.companyId = companyId;
        socket.salonId = salonId;
        socket.sessionId = sessionId;  // Для использования в session pool
        this.connections.set(sessionId, socket);  // Используем sessionId как ключ

        // Присоединяем к комнате компании
        socket.join(`company-${salonId}`);

        logger.info('✅ WebSocket авторизован', {
          companyId,
          salonId,
          sessionId,
          socketId: socket.id
        });

        // Начинаем процесс подключения WhatsApp (используем sessionId!)
        this.startWhatsAppConnection(socket, sessionId);

        // Обработчик отключения
        socket.on('disconnect', async () => {
          logger.info('WebSocket отключен', {
            companyId,
            salonId,
            sessionId,
            socketId: socket.id
          });

          // Очистка соединения из Map
          this.connections.delete(sessionId);

          // Очистка Baileys сессии если она не подключена
          try {
            const status = this.sessionPool.getSessionStatus(sessionId);
            if (status.status !== 'connected' && status.status !== 'not_initialized') {
              await this.sessionPool.disconnectSession(sessionId);
              logger.info('Неподключенная Baileys сессия удалена', { sessionId });
            }
          } catch (error) {
            logger.error('Ошибка при очистке сессии:', error);
          }

          // Удаление всех event listeners
          socket.removeAllListeners();
        });

        // Обработчик запроса нового QR-кода
        socket.on('request-qr', () => {
          logger.info('Запрос нового QR-кода', { sessionId });
          this.sendQRCode(socket, sessionId);
        });

      } catch (error) {
        logger.error('Ошибка валидации токена:', error);
        Sentry.captureException(error, {
          tags: { component: 'marketplace-websocket', operation: 'tokenValidation' },
          extra: { socketId: socket.id }
        });
        socket.emit('error', { message: 'Неверный токен' });
        socket.disconnect();
      }
    });
  }

  async startWhatsAppConnection(socket, sessionId) {
    // sessionId format: "company_{salon_id}" (e.g., "company_997441")
    // This matches the REST API format in yclients-marketplace.js:558
    const internalCompanyId = socket.companyId;  // Internal DB ID for database updates

    try {
      logger.info('🚀 Начинаем подключение WhatsApp', { sessionId, internalCompanyId });

      // Создаем обработчики событий с правильными именами
      const handleQR = (data) => {
        if (data.companyId === sessionId) {
          logger.info('📱 Получен QR-код', { sessionId });
          socket.emit('qr-update', {
            qr: data.qr,
            expiresIn: 20
          });
        }
      };

      const handleConnected = async (data) => {
        // DEBUG: Log all connected events to diagnose WebSocket issues
        logger.info('🔍 DEBUG: handleConnected received event', {
          eventCompanyId: data.companyId,
          expectedSessionId: sessionId,
          match: data.companyId === sessionId,
          phoneNumber: data.phoneNumber,
          socketId: socket.id,
          socketConnected: socket.connected
        });

        if (data.companyId === sessionId) {
          logger.info('✅ WhatsApp подключен!', {
            sessionId,
            phone: data.phoneNumber
          });

          // Отправляем событие успешного подключения
          logger.info('🔍 DEBUG: Emitting whatsapp-connected to client', {
            sessionId,
            socketId: socket.id,
            socketConnected: socket.connected
          });

          socket.emit('whatsapp-connected', {
            success: true,
            phone: data.phoneNumber,
            sessionId,
            message: 'WhatsApp успешно подключен!'
          });

          logger.info('🔍 DEBUG: whatsapp-connected emitted successfully');

          // Очистка listeners
          this.sessionPool.off('qr', handleQR);
          this.sessionPool.off('connected', handleConnected);
          this.sessionPool.off('logout', handleLogout);

          // Запускаем автоматический онбординг (передаем internal ID для БД)
          this.startOnboarding(internalCompanyId, data.phoneNumber);
        }
      };

      const handleLogout = (data) => {
        if (data.companyId === sessionId) {
          logger.warn('WhatsApp отключен пользователем', { sessionId });
          socket.emit('error', {
            message: 'WhatsApp отключен. Требуется повторное подключение.'
          });
          this.sessionPool.off('qr', handleQR);
          this.sessionPool.off('connected', handleConnected);
          this.sessionPool.off('logout', handleLogout);
        }
      };

      // Обработчик pairing code
      const handlePairingCode = (data) => {
        if (data.companyId === sessionId) {
          logger.info('📱 Получен pairing code', { sessionId, code: data.code });
          socket.emit('pairing-code', {
            code: data.code,
            phoneNumber: data.phoneNumber,
            expiresIn: 50 // 50 seconds (10s grace period before actual 60s WhatsApp expiry)
          });
        }
      };

      // Обработчик ошибок pairing code (от Baileys)
      const handlePairingCodeError = (data) => {
        if (data.companyId === sessionId) {
          logger.warn('❌ Pairing code error from Baileys', { sessionId, error: data.error });
          socket.emit('pairing-code-error', {
            message: data.error || 'Не удалось получить код. Попробуйте QR-код.',
            code: 'BAILEYS_ERROR'
          });
        }
      };

      // Подписываемся на глобальные события Session Pool
      this.sessionPool.on('qr', handleQR);
      this.sessionPool.on('connected', handleConnected);
      this.sessionPool.on('logout', handleLogout);
      this.sessionPool.on('pairing-code', handlePairingCode);
      this.sessionPool.on('pairing-code-error', handlePairingCodeError);

      // Создаем сессию (используем sessionId = "company_{salon_id}")
      await this.sessionPool.createSession(sessionId);

      // Отправляем QR если уже есть
      const qr = this.sessionPool.getQR(sessionId);
      if (qr) {
        socket.emit('qr-update', { qr, expiresIn: 20 });
      }

      // Проверяем pairing code
      const pairingCode = this.sessionPool.qrCodes.get(`pairing-${sessionId}`);
      if (pairingCode) {
        socket.emit('pairing-code', {
          code: pairingCode,
          expiresIn: 50 // 50 seconds (10s grace period before actual 60s WhatsApp expiry)
        });
      }

      // Обработчик запроса pairing code от клиента
      socket.on('request-pairing-code', async (data) => {
        const { phoneNumber } = data;

        // 1. Phone validation BEFORE processing
        if (!phoneNumber || typeof phoneNumber !== 'string') {
          socket.emit('pairing-code-error', {
            message: 'Номер телефона не указан',
            code: 'PHONE_REQUIRED'
          });
          return;
        }

        // Normalize and validate phone number using shared utilities
        let cleanedPhone;
        try {
          cleanedPhone = normalizePhoneE164(phoneNumber);
        } catch (phoneError) {
          socket.emit('pairing-code-error', {
            message: phoneError.message || 'Неверный формат номера (10-15 цифр)',
            code: 'INVALID_PHONE_FORMAT'
          });
          return;
        }

        // Validate country code (optional enhancement)
        const countryValidation = validateCountryCode(cleanedPhone);
        if (!countryValidation.valid) {
          logger.warn('Invalid country code in phone number', {
            sessionId,
            phone: maskPhone(cleanedPhone),
            message: countryValidation.message
          });
          // Note: Don't reject - just log warning. User might have valid number from unknown country.
        }

        // 2. Mutex - prevent concurrent requests
        if (this.pairingCodeRequests.has(sessionId)) {
          socket.emit('pairing-code-error', {
            message: 'Запрос уже в обработке. Подождите...',
            code: 'REQUEST_IN_PROGRESS'
          });
          return;
        }

        // 3. Execute with mutex protection
        const requestPromise = (async () => {
          try {
            logger.info('📱 Запрос pairing code', { sessionId, phoneNumber: cleanedPhone });

            // Set pairing-in-progress flag to prevent reconnection race condition
            // This flag tells session-pool not to auto-reconnect during pairing flow
            this.pairingCodeInProgress.set(sessionId, {
              phone: cleanedPhone,
              startTime: Date.now()
            });

            // CRITICAL FIX: Disconnect existing session first to ensure clean state
            // This allows phone mismatch detection to work when user requests pairing
            // code with a different phone number than stored in credentials.
            // Without this, createSession() would return cached/in-progress session
            // which doesn't have the new phoneNumber option.
            try {
              await this.sessionPool.disconnectSession(sessionId);
              logger.info('🔌 Disconnected existing session before pairing code request', { sessionId });
            } catch (disconnectError) {
              // Session might not exist yet - that's OK
              logger.debug('No existing session to disconnect', { sessionId, error: disconnectError.message });
            }

            await this.sessionPool.createSession(sessionId, {
              usePairingCode: true,
              phoneNumber: cleanedPhone
            });
          } catch (error) {
            logger.error('Ошибка запроса pairing code:', error);
            Sentry.captureException(error, {
              tags: { component: 'marketplace-websocket', operation: 'pairingCode' },
              extra: { sessionId, phoneNumber: cleanedPhone }
            });
            socket.emit('pairing-code-error', {
              message: 'Не удалось получить код. Попробуйте QR-код.',
              code: 'PAIRING_CODE_FAILED'
            });
          } finally {
            // Always release mutex
            this.pairingCodeRequests.delete(sessionId);
            // Release pairing-in-progress flag after 10 seconds (pairing code validity)
            setTimeout(() => {
              this.pairingCodeInProgress.delete(sessionId);
            }, 10000);
          }
        })();

        this.pairingCodeRequests.set(sessionId, requestPromise);
        await requestPromise;
      });

      // Очистка при отключении сокета
      socket.on('disconnect', () => {
        this.sessionPool.off('qr', handleQR);
        this.sessionPool.off('connected', handleConnected);
        this.sessionPool.off('logout', handleLogout);
        this.sessionPool.off('pairing-code', handlePairingCode);
        this.sessionPool.off('pairing-code-error', handlePairingCodeError);
        // Clear any pending pairing code requests
        this.pairingCodeRequests.delete(sessionId);
        this.pairingCodeInProgress.delete(sessionId);
      });

    } catch (error) {
      logger.error('Ошибка инициализации WhatsApp:', error);
      Sentry.captureException(error, {
        tags: { component: 'marketplace-websocket', operation: 'whatsappInit' },
        extra: { sessionId, internalCompanyId }
      });
      socket.emit('error', {
        message: 'Не удалось инициализировать подключение WhatsApp'
      });
    }
  }

  async sendQRCode(socket, sessionId) {
    try {
      // getSessionStatus returns OBJECT, not string! (Issue #8 fix)
      const statusObj = this.sessionPool.getSessionStatus(sessionId);

      if (statusObj.status === 'not_initialized') {
        // Создаем новую сессию
        await this.startWhatsAppConnection(socket, sessionId);
      } else if (statusObj.connected) {  // Use boolean property, not string comparison
        socket.emit('whatsapp-connected', {
          success: true,
          phone: statusObj.phoneNumber,  // Use correct property name
          sessionId,
          message: 'WhatsApp уже подключен!'
        });
      } else {
        // Генерируем новый QR
        await this.sessionPool.createSession(sessionId);
        const qr = this.sessionPool.qrCodes.get(sessionId);
        if (qr) {
          socket.emit('qr-update', {
            qr,
            expiresIn: 20
          });
        }
      }
    } catch (error) {
      logger.error('Ошибка отправки QR-кода:', error);
      Sentry.captureException(error, {
        tags: { component: 'marketplace-websocket', operation: 'sendQR' },
        extra: { sessionId }
      });
      socket.emit('error', {
        message: 'Не удалось получить QR-код'
      });
    }
  }

  async startOnboarding(companyId, whatsappPhone) {
    try {
      logger.info('🎯 Запускаем автоматический онбординг', {
        companyId,
        whatsappPhone
      });

      // Обновляем статус в БД
      // Migrated from Supabase to PostgreSQL (2025-11-26)
      const postgres = require('../../database/postgres');

      await postgres.query(
        `UPDATE companies SET
          whatsapp_connected = true,
          whatsapp_phone = $1,
          integration_status = 'active',
          connected_at = $2
        WHERE id = $3`,
        [whatsappPhone, new Date().toISOString(), companyId]
      );

      // Запускаем синхронизацию данных из YClients
      const { getSyncManager } = require('../../sync/sync-manager');
      const syncManager = getSyncManager();

      await syncManager.syncAll(companyId);

      // Отправляем приветственное сообщение
      setTimeout(async () => {
        try {
          await this.sessionPool.sendMessage(
            companyId,
            whatsappPhone,
            `🎉 Поздравляем! AI Admin успешно подключен!\n\n` +
            `Я готов помогать вашим клиентам:\n` +
            `✅ Записывать на услуги\n` +
            `✅ Отвечать на вопросы\n` +
            `✅ Напоминать о визитах\n\n` +
            `Для теста отправьте мне сообщение:\n` +
            `"Хочу записаться на стрижку"\n\n` +
            `📱 Ваш номер для клиентов: ${whatsappPhone}\n` +
            `💡 Инструкция: https://ai-admin.app/guide`
          );
        } catch (error) {
          logger.error('Ошибка отправки приветственного сообщения:', error);
        }
      }, 3000);

    } catch (error) {
      logger.error('Ошибка онбординга:', error);
    }
  }

  // Метод проверки rate limit
  checkRateLimit(ip) {
    const now = Date.now();
    const limit = this.rateLimiter.get(ip);

    if (!limit) {
      // Первое подключение с этого IP
      this.rateLimiter.set(ip, { count: 1, lastReset: now });
      return true;
    }

    // Проверяем, нужно ли сбросить счетчик
    if (now - limit.lastReset > this.RATE_LIMIT_WINDOW) {
      limit.count = 1;
      limit.lastReset = now;
      return true;
    }

    // Проверяем лимит
    if (limit.count >= this.RATE_LIMIT_MAX) {
      return false;
    }

    limit.count++;
    return true;
  }

  // Периодическая очистка rate limiter (каждые 5 минут)
  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [ip, limit] of this.rateLimiter.entries()) {
        if (now - limit.lastReset > this.RATE_LIMIT_WINDOW * 2) {
          this.rateLimiter.delete(ip);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        logger.debug(`Очищено ${cleaned} записей из rate limiter`);
      }
    }, 300000); // 5 минут
  }

  // Метод для отправки событий конкретной компании
  sendToCompany(companyId, event, data) {
    const socket = this.connections.get(companyId);
    if (socket) {
      socket.emit(event, data);
    } else {
      // Отправляем всем в комнате (на случай множественных подключений)
      this.namespace.to(`company-${companyId}`).emit(event, data);
    }
  }

  /**
   * Broadcast WhatsApp connected event from Redis pub/sub
   * This method receives events from baileys-service via Redis (cross-process IPC)
   * @param {Object} data - Event data from baileys-service
   * @param {string} data.companyId - Session ID (e.g., "company_962302")
   * @param {string} data.phoneNumber - Connected phone number
   */
  broadcastConnected(data) {
    const { companyId, phoneNumber } = data;
    const socket = this.connections.get(companyId);

    if (socket) {
      logger.info('📤 Broadcasting whatsapp-connected via Redis', {
        companyId,
        socketId: socket.id,
        phoneNumber
      });

      socket.emit('whatsapp-connected', {
        success: true,
        phone: phoneNumber,
        sessionId: companyId,
        message: 'WhatsApp успешно подключен!'
      });
    } else {
      logger.warn('No socket found for company, broadcasting to room', { companyId });
      // Fallback: broadcast to room
      const salonId = companyId.replace('company_', '');
      this.namespace.to(`company-${salonId}`).emit('whatsapp-connected', {
        success: true,
        phone: phoneNumber,
        sessionId: companyId,
        message: 'WhatsApp успешно подключен!'
      });
    }
  }

  /**
   * Check if pairing code request is in progress for a session
   * Used by session-pool to prevent auto-reconnection during pairing flow
   * @param {string} sessionId - Session ID (e.g., "company_997441")
   * @returns {boolean} - True if pairing code request is in progress
   */
  isPairingCodeInProgress(sessionId) {
    const pairingInfo = this.pairingCodeInProgress.get(sessionId);
    if (!pairingInfo) return false;

    // Check if pairing request is still fresh (within 60 seconds)
    const elapsed = Date.now() - pairingInfo.startTime;
    if (elapsed > 60000) {
      this.pairingCodeInProgress.delete(sessionId);
      return false;
    }

    return true;
  }
}

// Singleton instance for access from session-pool
let marketplaceSocketInstance = null;

/**
 * Get marketplace socket instance (for checking pairing status from session-pool)
 * @returns {MarketplaceSocket|null}
 */
function getMarketplaceSocket() {
  return marketplaceSocketInstance;
}

/**
 * Set marketplace socket instance (called during initialization)
 * @param {MarketplaceSocket} instance
 */
function setMarketplaceSocket(instance) {
  marketplaceSocketInstance = instance;
}

module.exports = MarketplaceSocket;
module.exports.getMarketplaceSocket = getMarketplaceSocket;
module.exports.setMarketplaceSocket = setMarketplaceSocket;