// src/integrations/whatsapp/baileys-manager.js
// Менеджер для управления множественными Baileys сессиями (multi-tenant)

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const QRCode = require('qrcode');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../../utils/logger');

class BaileysManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // companyId -> { sock, saveCreds, qr, status }
    this.sessionsPath = path.join(process.cwd(), 'sessions');
    this.initializeManager();
  }

  async initializeManager() {
    // Создаем директорию для сессий если не существует
    try {
      await fs.access(this.sessionsPath);
    } catch {
      await fs.mkdir(this.sessionsPath, { recursive: true });
      logger.info('📁 Создана директория для сессий WhatsApp');
    }
  }

  /**
   * Генерирует QR-код для компании
   */
  async generateQRForCompany(companyId) {
    logger.info(`🔄 Генерация QR-кода для компании ${companyId}`);

    // Если сессия уже существует и подключена
    const existingSession = this.sessions.get(companyId);
    if (existingSession && existingSession.status === 'connected') {
      logger.info(`✅ Компания ${companyId} уже подключена к WhatsApp`);
      return null; // Не нужен QR
    }

    // Если есть активная генерация QR
    if (existingSession && existingSession.qr) {
      logger.info(`📱 Возвращаем существующий QR для компании ${companyId}`);
      return existingSession.qr;
    }

    // Создаем новую сессию
    return await this.createNewSession(companyId);
  }

  /**
   * Создает новую WhatsApp сессию
   */
  async createNewSession(companyId) {
    try {
      const authFolder = path.join(this.sessionsPath, `company_${companyId}`);
      
      // Загружаем состояние авторизации
      const { state, saveCreds } = await useMultiFileAuthState(authFolder);
      
      // Создаем socket соединение
      const sock = makeWASocket({
        auth: state,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['AI Admin', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true
      });

      // Сохраняем сессию
      const sessionData = {
        sock,
        saveCreds,
        qr: null,
        status: 'connecting',
        companyId,
        createdAt: Date.now()
      };
      this.sessions.set(companyId, sessionData);

      // Обработчики событий
      this.setupEventHandlers(companyId, sock, saveCreds);

      // Ждем QR-код
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          sock.ev.off('connection.update', qrHandler);
          reject(new Error('Timeout waiting for QR code'));
        }, 30000); // 30 секунд таймаут

        const qrHandler = async (update) => {
          if (update.qr) {
            clearTimeout(timeout);
            sock.ev.off('connection.update', qrHandler); // Удаляем listener

            // Генерируем QR-код как base64 изображение
            const qrDataURL = await QRCode.toDataURL(update.qr, {
              width: 300,
              margin: 1,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });

            // Сохраняем QR в сессии
            sessionData.qr = qrDataURL;
            sessionData.status = 'qr_generated';

            // Эмитим событие для WebSocket
            this.emit(`qr-${companyId}`, qrDataURL);

            logger.info(`✅ QR-код сгенерирован для компании ${companyId}`);
            resolve(qrDataURL);
          }
        };

        sock.ev.on('connection.update', qrHandler); // Используем on вместо once
      });

    } catch (error) {
      logger.error(`Ошибка создания сессии для компании ${companyId}:`, error);
      this.sessions.delete(companyId);
      throw error;
    }
  }

  /**
   * Настраивает обработчики событий для сессии
   */
  setupEventHandlers(companyId, sock, saveCreds) {
    // Обновление учетных данных
    sock.ev.on('creds.update', saveCreds);

    // Обновление соединения
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const session = this.sessions.get(companyId);

      if (qr) {
        // Новый QR-код
        const qrDataURL = await QRCode.toDataURL(qr, {
          width: 300,
          margin: 1
        });

        if (session) {
          session.qr = qrDataURL;
          session.status = 'qr_generated';
        }

        this.emit(`qr-${companyId}`, qrDataURL);
        logger.info(`🔄 Обновлен QR-код для компании ${companyId}`);
      }

      if (connection === 'close') {
        const shouldReconnect = 
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        logger.warn(`❌ Соединение закрыто для компании ${companyId}`, {
          reason: lastDisconnect?.error,
          shouldReconnect
        });

        if (session) {
          session.status = 'disconnected';
        }

        if (shouldReconnect) {
          logger.info(`🔄 Попытка переподключения для компании ${companyId}`);
          setTimeout(() => this.createNewSession(companyId), 5000);
        } else {
          // Пользователь вышел из системы - очищаем сессию
          const sessionToRemove = this.sessions.get(companyId);
          if (sessionToRemove) {
            // Очищаем все listeners
            sessionToRemove.sock.ev.removeAllListeners();
            // Закрываем socket если открыт
            if (sessionToRemove.sock.ws && sessionToRemove.sock.ws.readyState === 1) {
              sessionToRemove.sock.ws.close();
            }
          }
          this.sessions.delete(companyId);
          this.emit(`logged-out-${companyId}`);
        }
      }

      if (connection === 'open') {
        logger.info(`✅ WhatsApp подключен для компании ${companyId}`, {
          user: sock.user
        });

        if (session) {
          session.status = 'connected';
          session.qr = null; // QR больше не нужен
          session.phone = sock.user?.id?.split('@')[0];
          session.name = sock.user?.name;
        }

        // Эмитим событие успешного подключения
        this.emit(`connected-${companyId}`, {
          phone: sock.user?.id?.split('@')[0],
          name: sock.user?.name,
          companyId
        });

        // Отправляем тестовое сообщение себе
        this.sendTestMessage(sock, companyId);
      }
    });

    // Обработка входящих сообщений
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        // Игнорируем свои сообщения
        if (msg.key.fromMe) continue;

        logger.info(`📨 Новое сообщение для компании ${companyId}`, {
          from: msg.key.remoteJid,
          text: msg.message?.conversation || msg.message?.extendedTextMessage?.text
        });

        // Эмитим событие для обработки сообщения
        this.emit('message', {
          companyId,
          message: msg
        });
      }
    });
  }

  /**
   * Отправляет тестовое сообщение после подключения
   */
  async sendTestMessage(sock, companyId) {
    try {
      const testNumber = sock.user?.id;
      if (!testNumber) return;

      await sock.sendMessage(testNumber, {
        text: '✅ AI Admin успешно подключен!\n\nВаш WhatsApp бот готов к работе. Теперь клиенты могут писать на этот номер для записи в салон.'
      });

      logger.info(`📤 Тестовое сообщение отправлено для компании ${companyId}`);
    } catch (error) {
      logger.error('Ошибка отправки тестового сообщения:', error);
    }
  }

  /**
   * Отправляет сообщение через WhatsApp
   */
  async sendMessage(companyId, phoneNumber, message) {
    const session = this.sessions.get(companyId);
    
    if (!session || session.status !== 'connected') {
      throw new Error(`WhatsApp не подключен для компании ${companyId}`);
    }

    // Форматируем номер телефона
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    try {
      await session.sock.sendMessage(formattedNumber, {
        text: message
      });

      logger.info(`✅ Сообщение отправлено`, {
        company_id: companyId,
        to: formattedNumber
      });

      return true;
    } catch (error) {
      logger.error('Ошибка отправки сообщения:', error);
      throw error;
    }
  }

  /**
   * Форматирует номер телефона для WhatsApp
   */
  formatPhoneNumber(phone) {
    // Убираем все нецифровые символы
    let cleaned = phone.replace(/\D/g, '');
    
    // Если начинается с 8, заменяем на 7
    if (cleaned.startsWith('8')) {
      cleaned = '7' + cleaned.slice(1);
    }
    
    // Добавляем @s.whatsapp.net
    return `${cleaned}@s.whatsapp.net`;
  }

  /**
   * Получает статус сессии
   */
  getSessionStatus(companyId) {
    const session = this.sessions.get(companyId);
    
    if (!session) {
      return { status: 'not_initialized' };
    }

    return {
      status: session.status,
      phone: session.phone,
      name: session.name,
      hasQR: !!session.qr,
      createdAt: session.createdAt
    };
  }

  /**
   * Отключает сессию
   */
  async disconnectSession(companyId) {
    const session = this.sessions.get(companyId);

    if (!session) {
      return false;
    }

    try {
      // Очищаем все listeners
      session.sock.ev.removeAllListeners();

      // Пытаемся выйти из системы
      if (session.sock.logout) {
        await session.sock.logout();
      }

      // Закрываем WebSocket если открыт
      if (session.sock.ws && session.sock.ws.readyState === 1) {
        session.sock.ws.close();
      }

      // Удаляем сессию из Map
      this.sessions.delete(companyId);

      logger.info(`🔌 Сессия отключена для компании ${companyId}`);
      return true;
    } catch (error) {
      logger.error('Ошибка отключения сессии:', error);
      // Все равно удаляем сессию
      this.sessions.delete(companyId);
      return false;
    }
  }

  /**
   * Получает список всех активных сессий
   */
  getActiveSessions() {
    const sessions = [];
    
    for (const [companyId, session] of this.sessions) {
      sessions.push({
        companyId,
        status: session.status,
        phone: session.phone,
        name: session.name,
        createdAt: session.createdAt
      });
    }

    return sessions;
  }
}

module.exports = BaileysManager;