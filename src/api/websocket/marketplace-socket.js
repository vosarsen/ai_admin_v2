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

    // Создаем namespace для маркетплейса
    this.namespace = io.of('/marketplace');
    this.setupHandlers();
  }

  setupHandlers() {
    this.namespace.on('connection', (socket) => {
      logger.info('🔌 Новое WebSocket соединение для маркетплейса', {
        socketId: socket.id,
        query: socket.handshake.query
      });

      // Проверяем токен
      const { token, companyId } = socket.handshake.query;

      if (!token || !companyId) {
        logger.error('WebSocket: отсутствует токен или companyId');
        socket.emit('error', { message: 'Требуется авторизация' });
        socket.disconnect();
        return;
      }

      // Валидируем токен
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');

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
        socket.on('disconnect', () => {
          logger.info('WebSocket отключен', {
            companyId,
            socketId: socket.id
          });
          this.connections.delete(companyId);
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
      const session = await this.baileysManager.createSession(companyId);

      // Слушаем события от Baileys
      session.on('qr', (qr) => {
        logger.info('📱 Получен QR-код', { companyId });
        socket.emit('qr-update', {
          qr,
          expiresIn: 20
        });
      });

      session.on('connected', async (data) => {
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

      session.on('error', (error) => {
        logger.error('Ошибка Baileys:', error);
        socket.emit('error', {
          message: error.message || 'Ошибка подключения WhatsApp'
        });
      });

      // Запускаем подключение
      await session.initialize();

    } catch (error) {
      logger.error('Ошибка инициализации WhatsApp:', error);
      socket.emit('error', {
        message: 'Не удалось инициализировать подключение WhatsApp'
      });
    }
  }

  async sendQRCode(socket, companyId) {
    try {
      const session = await this.baileysManager.getSession(companyId);

      if (!session) {
        // Создаем новую сессию
        await this.startWhatsAppConnection(socket, companyId);
      } else {
        // Запрашиваем новый QR
        await session.requestNewQR();
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
      const { createClient } = require('../../database/supabase');
      const supabase = createClient();

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
      const SyncManager = require('../../sync/sync-manager');
      const syncManager = SyncManager.getSyncManager();

      await syncManager.syncCompanyData(companyId);

      // Отправляем приветственное сообщение
      setTimeout(async () => {
        try {
          const session = await this.baileysManager.getSession(companyId);
          if (session) {
            await session.sendMessage(whatsappPhone, {
              text: `🎉 Поздравляем! AI Admin успешно подключен!\n\n` +
                    `Я готов помогать вашим клиентам:\n` +
                    `✅ Записывать на услуги\n` +
                    `✅ Отвечать на вопросы\n` +
                    `✅ Напоминать о визитах\n\n` +
                    `Для теста отправьте мне сообщение:\n` +
                    `"Хочу записаться на стрижку"\n\n` +
                    `📱 Ваш номер для клиентов: ${whatsappPhone}\n` +
                    `💡 Инструкция: https://ai-admin.app/guide`
            });
          }
        } catch (error) {
          logger.error('Ошибка отправки приветственного сообщения:', error);
        }
      }, 3000);

    } catch (error) {
      logger.error('Ошибка онбординга:', error);
    }
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