// src/api/websocket/marketplace-ws.js
// WebSocket сервер для marketplace интеграции

const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../../utils/logger');
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');

class MarketplaceWebSocket {
  constructor(server) {
    this.io = socketIO(server, {
      cors: {
        origin: '*', // В production укажите конкретные домены
        methods: ['GET', 'POST']
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling']
    });

    this.sessionPool = getSessionPool();
    this.clientSessions = new Map(); // socket.id -> session info
    this.init();
  }

  init() {
    // Namespace для marketplace
    this.marketplaceNamespace = this.io.of('/marketplace');

    // Middleware для авторизации
    this.marketplaceNamespace.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Верифицируем токен
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'your-secret-key-change-in-production'
        );

        socket.companyData = decoded;
        logger.info('WebSocket client authenticated:', {
          socketId: socket.id,
          salonId: decoded.salon_id
        });

        next();
      } catch (error) {
        logger.error('WebSocket auth error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Обработка подключений
    this.marketplaceNamespace.on('connection', (socket) => {
      logger.info('WebSocket client connected:', socket.id);

      const { company_id, salon_id } = socket.companyData;
      const sessionId = `company_${salon_id}`;

      // Сохраняем информацию о клиенте
      this.clientSessions.set(socket.id, {
        sessionId,
        companyId: company_id,
        salonId: salon_id,
        socket
      });

      // Подписываемся на события WhatsApp сессии
      this.subscribeToSession(socket, sessionId);

      // Обработка запросов
      socket.on('request-qr', () => this.handleQRRequest(socket, sessionId));
      socket.on('check-status', () => this.handleStatusCheck(socket, sessionId));

      // Отключение
      socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected:', socket.id);
        this.clientSessions.delete(socket.id);
      });

      // Ошибки
      socket.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });

    logger.info('MarketplaceWebSocket initialized');
  }

  // Подписка на события WhatsApp сессии
  subscribeToSession(socket, sessionId) {
    const session = this.sessionPool.getSession(sessionId);

    if (!session) {
      // Инициализируем новую сессию
      this.initializeSession(socket, sessionId);
      return;
    }

    // Подписываемся на события существующей сессии
    this.attachSessionListeners(socket, session);
  }

  // Инициализация новой WhatsApp сессии
  async initializeSession(socket, sessionId) {
    try {
      logger.info(`Initializing WhatsApp session: ${sessionId}`);

      const session = await this.sessionPool.createSession(sessionId);

      if (!session) {
        socket.emit('error', { message: 'Failed to create session' });
        return;
      }

      this.attachSessionListeners(socket, session);

      // Запрашиваем первый QR
      setTimeout(() => {
        this.handleQRRequest(socket, sessionId);
      }, 1000);

    } catch (error) {
      logger.error('Session initialization error:', error);
      socket.emit('error', { message: 'Session initialization failed' });
    }
  }

  // Привязка слушателей событий к сессии
  attachSessionListeners(socket, session) {
    // QR-код сгенерирован
    session.on('qr', (qr) => {
      logger.info('QR generated for session');
      socket.emit('qr', { qr, timestamp: Date.now() });
    });

    // Статус подключения изменился
    session.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;

      logger.info('Connection update:', connection);
      socket.emit('status', { status: connection });

      if (connection === 'open') {
        socket.emit('connected', {
          success: true,
          message: 'WhatsApp connected successfully'
        });
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        if (!shouldReconnect) {
          socket.emit('error', { message: 'Session expired. Please scan QR again.' });
        }
      }
    });

    // Получены учетные данные
    session.on('creds.update', (creds) => {
      logger.info('Credentials updated for session');
      // Сохраняем учетные данные (обрабатывается в session-pool)
    });
  }

  // Обработка запроса QR-кода
  async handleQRRequest(socket, sessionId) {
    try {
      const session = this.sessionPool.getSession(sessionId);

      if (!session) {
        await this.initializeSession(socket, sessionId);
        return;
      }

      // Если сессия уже подключена
      const status = this.sessionPool.getSessionStatus(sessionId);
      if (status === 'connected') {
        socket.emit('connected', {
          success: true,
          message: 'Already connected'
        });
        return;
      }

      // Запрашиваем новый QR
      const qr = await this.sessionPool.getQR(sessionId);
      if (qr) {
        socket.emit('qr', { qr, timestamp: Date.now() });
      } else {
        socket.emit('status', { status: 'waiting' });
      }

    } catch (error) {
      logger.error('QR request error:', error);
      socket.emit('error', { message: 'Failed to generate QR' });
    }
  }

  // Проверка статуса подключения
  handleStatusCheck(socket, sessionId) {
    try {
      const status = this.sessionPool.getSessionStatus(sessionId);
      socket.emit('status', {
        status,
        connected: status === 'connected',
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Status check error:', error);
      socket.emit('error', { message: 'Status check failed' });
    }
  }

  // Отправка сообщения конкретному клиенту
  sendToClient(salonId, event, data) {
    const sessionId = `company_${salonId}`;

    for (const [socketId, info] of this.clientSessions) {
      if (info.sessionId === sessionId) {
        info.socket.emit(event, data);
      }
    }
  }

  // Broadcast всем клиентам салона
  broadcastToSalon(salonId, event, data) {
    const sessionId = `company_${salonId}`;

    this.marketplaceNamespace.to(sessionId).emit(event, data);
  }

  // Получение статистики подключений
  getStats() {
    return {
      totalConnections: this.clientSessions.size,
      connections: Array.from(this.clientSessions.entries()).map(([id, info]) => ({
        socketId: id,
        salonId: info.salonId,
        sessionId: info.sessionId
      }))
    };
  }
}

module.exports = MarketplaceWebSocket;