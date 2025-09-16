// src/api/websocket/marketplace-socket.js
// WebSocket обработчик для маркетплейса

const logger = require('../../utils/logger');
const jwt = require('jsonwebtoken');
const BaileysManager = require('../../integrations/whatsapp/baileys-manager');

class MarketplaceSocket {
  constructor(io) {
    this.io = io;
    this.baileysManager = new BaileysManager();
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

      // Получаем токен из headers или query (для обратной совместимости)
      const authHeader = socket.handshake.headers.authorization;
      let token = null;
      let companyId = socket.handshake.query.companyId;

      // Приоритет отдаем токену из headers
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (socket.handshake.query.token) {
        // Fallback на query параметр (будет удален в будущем)
        token = socket.handshake.query.token;
        logger.warn('Токен передан через query параметры - небезопасно! Используйте Authorization header.');
      }

      // Проверяем наличие токена после извлечения
      if (!token || !companyId) {
        logger.error('WebSocket: отсутствует токен или companyId');
        socket.emit('error', { message: 'Требуется авторизация' });
        socket.disconnect();
        return;
      }

      // Валидируем токен
      try {
        // Проверяем наличие JWT_SECRET
        if (!process.env.JWT_SECRET) {
          logger.error('JWT_SECRET не установлен в переменных окружения');
          socket.emit('error', { message: 'Ошибка конфигурации сервера' });
          socket.disconnect();
          return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.company_id !== parseInt(companyId)) {
          throw new Error('Неверный токен для компании');
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
            const status = this.baileysManager.getSessionStatus(companyId);
            if (status.status !== 'connected' && status.status !== 'not_initialized') {
              await this.baileysManager.disconnectSession(companyId);
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

      // Инициализируем сессию Baileys
      const qr = await this.baileysManager.generateQRForCompany(companyId);

      // Если QR уже есть, отправляем его
      if (qr) {
        socket.emit('qr-update', {
          qr,
          expiresIn: 20
        });
      }

      // Слушаем события от Baileys через EventEmitter
      this.baileysManager.on(`qr-${companyId}`, (qrDataURL) => {
        logger.info('📱 Получен QR-код', { companyId });
        socket.emit('qr-update', {
          qr: qrDataURL,
          expiresIn: 20
        });
      });

      this.baileysManager.on(`connected-${companyId}`, async (data) => {
        logger.info('✅ WhatsApp подключен!', {
          companyId,
          phone: data.phone
        });

        // Отправляем событие успешного подключения
        socket.emit('whatsapp-connected', {
          success: true,
          phone: data.phone,
          companyId,
          message: 'WhatsApp успешно подключен!'
        });

        // Запускаем автоматический онбординг
        this.startOnboarding(companyId, data.phone);
      });

      this.baileysManager.on(`logged-out-${companyId}`, () => {
        logger.warn('WhatsApp отключен пользователем', { companyId });
        socket.emit('error', {
          message: 'WhatsApp отключен. Требуется повторное подключение.'
        });
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
      const status = this.baileysManager.getSessionStatus(companyId);

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
        const qr = await this.baileysManager.generateQRForCompany(companyId);
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
      const { supabase } = require('../../database/supabase');

      await supabase
        .from('companies')
        .update({
          whatsapp_connected: true,
          whatsapp_phone: whatsappPhone,
          integration_status: 'active',
          connected_at: new Date().toISOString()
        })
        .eq('id', companyId);

      // Запускаем синхронизацию данных из YClients
      const { getSyncManager } = require('../../sync/sync-manager');
      const syncManager = getSyncManager();

      await syncManager.syncCompanyData(companyId);

      // Отправляем приветственное сообщение
      setTimeout(async () => {
        try {
          await this.baileysManager.sendMessage(
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