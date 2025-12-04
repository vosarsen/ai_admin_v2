// src/api/websocket/marketplace-socket.js
// WebSocket обработчик для маркетплейса

const logger = require('../../utils/logger');
const jwt = require('jsonwebtoken');
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');

class MarketplaceSocket {
  constructor(io) {
    this.io = io;
    this.sessionPool = getSessionPool();
    this.connections = new Map(); // companyId -> socket
    this.rateLimiter = new Map(); // IP -> { count, lastReset }
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
          'https://yclients.com',
          'https://n962302.yclients.com'
        ];
        const origin = socket.handshake.headers.origin;

        if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
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

        // Извлекаем companyId из токена (безопасно)
        companyId = decoded.company_id;

        if (!companyId) {
          throw new Error('Токен не содержит company_id');
        }

        // Сохраняем соединение
        socket.companyId = companyId;
        this.connections.set(companyId, socket);

        // Присоединяем к комнате компании
        socket.join(`company-${companyId}`);

        logger.info('✅ WebSocket авторизован', {
          companyId,
          socketId: socket.id
        });

        // Начинаем процесс подключения WhatsApp
        this.startWhatsAppConnection(socket, companyId);

        // Обработчик отключения
        socket.on('disconnect', async () => {
          logger.info('WebSocket отключен', {
            companyId,
            socketId: socket.id
          });

          // Очистка соединения из Map
          this.connections.delete(companyId);

          // Очистка Baileys сессии если она не подключена
          try {
            const status = this.sessionPool.getSessionStatus(companyId);
            if (status.status !== 'connected' && status.status !== 'not_initialized') {
              await this.sessionPool.disconnectSession(companyId);
              logger.info('Неподключенная Baileys сессия удалена', { companyId });
            }
          } catch (error) {
            logger.error('Ошибка при очистке сессии:', error);
          }

          // Удаление всех event listeners
          socket.removeAllListeners();
        });

        // Обработчик запроса нового QR-кода
        socket.on('request-qr', () => {
          logger.info('Запрос нового QR-кода', { companyId });
          this.sendQRCode(socket, companyId);
        });

      } catch (error) {
        logger.error('Ошибка валидации токена:', error);
        socket.emit('error', { message: 'Неверный токен' });
        socket.disconnect();
      }
    });
  }

  async startWhatsAppConnection(socket, companyId) {
    try {
      logger.info('🚀 Начинаем подключение WhatsApp', { companyId });

      // Создаем обработчики событий с правильными именами
      const handleQR = (data) => {
        if (data.companyId === companyId) {
          logger.info('📱 Получен QR-код', { companyId });
          socket.emit('qr-update', {
            qr: data.qr,
            expiresIn: 20
          });
        }
      };

      const handleConnected = async (data) => {
        if (data.companyId === companyId) {
          logger.info('✅ WhatsApp подключен!', {
            companyId,
            phone: data.phoneNumber
          });

          // Отправляем событие успешного подключения
          socket.emit('whatsapp-connected', {
            success: true,
            phone: data.phoneNumber,
            companyId,
            message: 'WhatsApp успешно подключен!'
          });

          // Очистка listeners
          this.sessionPool.off('qr', handleQR);
          this.sessionPool.off('connected', handleConnected);
          this.sessionPool.off('logout', handleLogout);

          // Запускаем автоматический онбординг
          this.startOnboarding(companyId, data.phoneNumber);
        }
      };

      const handleLogout = (data) => {
        if (data.companyId === companyId) {
          logger.warn('WhatsApp отключен пользователем', { companyId });
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
        if (data.companyId === companyId) {
          logger.info('📱 Получен pairing code', { companyId, code: data.code });
          socket.emit('pairing-code', {
            code: data.code,
            phoneNumber: data.phoneNumber,
            expiresIn: 60
          });
        }
      };

      // Подписываемся на глобальные события Session Pool
      this.sessionPool.on('qr', handleQR);
      this.sessionPool.on('connected', handleConnected);
      this.sessionPool.on('logout', handleLogout);
      this.sessionPool.on('pairing-code', handlePairingCode);

      // Создаем сессию
      await this.sessionPool.createSession(companyId);

      // Отправляем QR если уже есть
      const qr = this.sessionPool.getQR(companyId);
      if (qr) {
        socket.emit('qr-update', { qr, expiresIn: 20 });
      }

      // Проверяем pairing code
      const pairingCode = this.sessionPool.qrCodes.get(`pairing-${companyId}`);
      if (pairingCode) {
        socket.emit('pairing-code', {
          code: pairingCode,
          expiresIn: 60
        });
      }

      // Обработчик запроса pairing code от клиента
      socket.on('request-pairing-code', async (data) => {
        try {
          const { phoneNumber } = data;
          logger.info('📱 Запрос pairing code', { companyId, phoneNumber });

          // Создаем сессию с pairing code
          await this.sessionPool.createSession(companyId, {
            usePairingCode: true,
            phoneNumber: phoneNumber
          });
        } catch (error) {
          logger.error('Ошибка запроса pairing code:', error);
          socket.emit('error', {
            message: 'Не удалось получить код. Попробуйте еще раз.'
          });
        }
      });

      // Очистка при отключении сокета
      socket.on('disconnect', () => {
        this.sessionPool.off('qr', handleQR);
        this.sessionPool.off('connected', handleConnected);
        this.sessionPool.off('logout', handleLogout);
        this.sessionPool.off('pairing-code', handlePairingCode);
      });

    } catch (error) {
      logger.error('Ошибка инициализации WhatsApp:', error);
      socket.emit('error', {
        message: 'Не удалось инициализировать подключение WhatsApp'
      });
    }
  }

  async sendQRCode(socket, companyId) {
    try {
      const status = this.sessionPool.getSessionStatus(companyId);

      if (status.status === 'not_initialized') {
        // Создаем новую сессию
        await this.startWhatsAppConnection(socket, companyId);
      } else if (status.status === 'connected') {
        socket.emit('whatsapp-connected', {
          success: true,
          phone: status.phone,
          companyId,
          message: 'WhatsApp уже подключен!'
        });
      } else {
        // Генерируем новый QR
        // Создаем сессию и получаем QR
      await this.sessionPool.createSession(companyId);
      const qr = this.sessionPool.qrCodes.get(companyId);
        if (qr) {
          socket.emit('qr-update', {
            qr,
            expiresIn: 20
          });
        }
      }
    } catch (error) {
      logger.error('Ошибка отправки QR-кода:', error);
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
}

module.exports = MarketplaceSocket;