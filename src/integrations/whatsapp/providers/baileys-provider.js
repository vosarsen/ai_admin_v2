// src/integrations/whatsapp/providers/baileys-provider.js
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const qrcode = require('qrcode-terminal');
const logger = require('../../../utils/logger');
const EventEmitter = require('events');
const sessionStateManager = require('../../../services/whatsapp/session-state-manager');

class BaileysProvider extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Prevent memory leak warnings
    this.sessions = new Map(); // companyId -> socket instance
    this.stores = new Map(); // companyId -> store instance
    this.authStates = new Map(); // companyId -> auth state
    this.reconnectAttempts = new Map(); // companyId -> attempt count
    this.maxReconnectAttempts = 10; // Увеличиваем количество попыток
    this.reconnectDelay = 5000; // 5 seconds base delay
    this.sessionsPath = path.join(process.cwd(), 'sessions');
    this.messageHandlers = new Map(); // companyId -> handler function
    
    // Enhanced connection management
    this.connectionStates = new Map(); // companyId -> state
    this.lastDisconnectReasons = new Map(); // companyId -> reason
    this.keepAliveIntervals = new Map(); // companyId -> interval
    
    // Enhanced configuration
    this.config = {
      reconnectDelay: 5000,
      maxReconnectDelay: 60000, // Max 1 minute between attempts
      reconnectBackoffMultiplier: 1.5, // Exponential backoff
      keepAliveIntervalMs: 30000, // Send keep-alive every 30s
      connectionTimeoutMs: 60000, // Connection timeout
    };
  }

  async initialize() {
    // Create sessions directory if not exists
    try {
      await fsPromises.access(this.sessionsPath);
    } catch {
      await fsPromises.mkdir(this.sessionsPath, { recursive: true });
    }
    logger.info('🚀 Baileys provider initialized');
  }

  /**
   * Connect a company to WhatsApp
   * @param {string} companyId - Unique company identifier
   * @param {Object} config - Company-specific configuration
   */
  async connectSession(companyId, config = {}) {
    logger.info(`📱 Connecting WhatsApp session for company ${companyId}`);
    
    if (this.sessions.has(companyId)) {
      logger.warn(`Session for company ${companyId} already exists`);
      return this.sessions.get(companyId);
    }

    try {
      // Create auth folder for company
      const authFolder = path.join(this.sessionsPath, `company_${companyId}`);
      
      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(authFolder);
      this.authStates.set(companyId, { state, saveCreds });

      // Get latest Baileys version
      const { version } = await fetchLatestBaileysVersion();

      // Store functionality removed - not available in current Baileys version
      // Will be added back when makeInMemoryStore is available

      // Create socket connection
      const socket = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
        },
        browser: ['AI Admin Bot', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 10_000, // Send keepalive every 10 seconds
        qrTimeout: 60_000, // QR timeout 60 seconds
        connectTimeoutMs: 60_000, // Connection timeout 60 seconds
        defaultQueryTimeoutMs: 60_000, // Query timeout 60 seconds
        ...config
      });

      // Bind store to socket
      // Store binding removed - not available in current Baileys version

      // Store saving removed - not available in current Baileys version

      // Handle authentication
      socket.ev.on('creds.update', saveCreds);

      // Handle connection updates
      socket.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(companyId, update, socket);
      });

      // Handle messages
      socket.ev.on('messages.upsert', async (m) => {
        await this.handleMessages(companyId, m);
      });

      // Handle message updates (receipts, reactions, etc.)
      socket.ev.on('messages.update', async (updates) => {
        await this.handleMessageUpdates(companyId, updates);
      });

      // Store socket instance
      this.sessions.set(companyId, socket);
      this.reconnectAttempts.set(companyId, 0);

      logger.info(`✅ WhatsApp session connected for company ${companyId}`);
      return socket;

    } catch (error) {
      logger.error(`Failed to connect session for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Handle connection updates
   */
  async handleConnectionUpdate(companyId, update, socket) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info(`📱 QR Code generated for company ${companyId}`);
      // Display QR in terminal
      qrcode.generate(qr, { small: true });
      // Emit QR event for web interface
      this.emit('qr', { companyId, qr });
    }

    if (connection === 'close') {
      const disconnectReason = lastDisconnect?.error?.output?.statusCode;
      this.lastDisconnectReasons.set(companyId, disconnectReason);
      
      const shouldReconnect = (disconnectReason !== DisconnectReason.loggedOut);
      
      logger.warn(`Connection closed for company ${companyId}. Reason: ${disconnectReason}. Should reconnect: ${shouldReconnect}`);
      
      // Update connection state
      this.connectionStates.set(companyId, 'disconnected');
      
      // Save state to Redis
      await sessionStateManager.updateConnectionStatus(companyId, 'disconnected', {
        lastDisconnectReason: disconnectReason,
        shouldReconnect
      });
      
      // Stop keep-alive
      this.stopKeepAlive(companyId);
      
      if (shouldReconnect) {
        await this.handleReconnection(companyId);
      } else {
        // Logged out, clean up session
        logger.info(`Session logged out for company ${companyId}, cleaning up...`);
        await sessionStateManager.clearSessionState(companyId);
        await this.disconnectSession(companyId);
      }
    } else if (connection === 'open') {
      logger.info(`✅ Connection opened for company ${companyId}`);
      this.reconnectAttempts.set(companyId, 0);
      this.connectionStates.set(companyId, 'connected');
      
      // Save state to Redis
      await sessionStateManager.updateConnectionStatus(companyId, 'connected', {
        phoneNumber: socket.user?.id,
        reconnectAttempts: 0
      });
      
      // Start keep-alive mechanism
      this.startKeepAlive(companyId, socket);
      
      this.emit('ready', { companyId });
    } else if (connection === 'connecting') {
      logger.info(`🔄 Connecting for company ${companyId}...`);
      this.connectionStates.set(companyId, 'connecting');
      
      // Save state to Redis
      await sessionStateManager.updateConnectionStatus(companyId, 'connecting');
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  async handleReconnection(companyId) {
    // Check if already reconnecting
    if (this.connectionStates.get(companyId) === 'reconnecting') {
      logger.info(`Already reconnecting company ${companyId}`);
      return;
    }
    
    const attempts = this.reconnectAttempts.get(companyId) || 0;
    const lastReason = this.lastDisconnectReasons.get(companyId);
    
    // Don't reconnect if manually disconnected or logged out
    if (lastReason === DisconnectReason.loggedOut) {
      logger.info(`Session logged out for company ${companyId}, not reconnecting`);
      return;
    }
    
    if (attempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts reached for company ${companyId}`);
      this.emit('disconnected', { companyId, reason: 'max_attempts' });
      return;
    }

    // Calculate delay with exponential backoff
    const baseDelay = this.config.reconnectDelay;
    const delay = Math.min(
      baseDelay * Math.pow(this.config.reconnectBackoffMultiplier, attempts),
      this.config.maxReconnectDelay
    );
    
    logger.info(`🔄 Reconnecting company ${companyId} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
    
    this.connectionStates.set(companyId, 'reconnecting');
    this.reconnectAttempts.set(companyId, attempts + 1);
    
    setTimeout(async () => {
      try {
        // Remove old socket
        const oldSocket = this.sessions.get(companyId);
        if (oldSocket) {
          oldSocket.end();
          this.sessions.delete(companyId);
        }
        // Reconnect
        await this.connectSession(companyId);
      } catch (error) {
        logger.error(`Reconnection failed for company ${companyId}:`, error);
        // Try again with next attempt
        await this.handleReconnection(companyId);
      }
    }, delay);
  }

  /**
   * Handle incoming messages
   */
  async handleMessages(companyId, upsert) {
    const { messages, type } = upsert;
    
    // Only process new messages
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Skip if not a regular message
      if (!msg.message) continue;
      
      // Skip if from ourselves
      if (msg.key.fromMe) continue;

      // Extract clean phone number from remoteJid
      // remoteJid format: 79686484488@s.whatsapp.net or group id
      let phoneNumber = '';
      if (msg.key.remoteJid) {
        // Remove @s.whatsapp.net or @g.us suffix
        phoneNumber = msg.key.remoteJid.replace(/@[sg]\.(?:whatsapp\.net|us)/, '');
        
        // Skip if it's a group message (contains hyphen)
        if (phoneNumber.includes('-')) {
          logger.debug(`Skipping group message from ${msg.key.remoteJid}`);
          continue;
        }
      }
      
      // Skip if no valid phone number
      if (!phoneNumber || phoneNumber.length < 5) {
        logger.warn(`Skipping message with invalid phone: ${msg.key.remoteJid}`);
        continue;
      }

      const messageInfo = {
        companyId,
        messageId: msg.key.id,
        from: phoneNumber, // Clean phone number without @s.whatsapp.net
        pushName: msg.pushName,
        timestamp: msg.messageTimestamp,
        message: this.extractMessageContent(msg.message)
      };

      logger.info(`📨 New message for company ${companyId} from ${messageInfo.from}`);
      
      // Call registered handler if exists
      const handler = this.messageHandlers.get(companyId);
      if (handler) {
        await handler(messageInfo);
      }

      // Emit message event
      this.emit('message', messageInfo);
    }
  }

  /**
   * Extract message content from various message types
   */
  extractMessageContent(message) {
    if (message.conversation) {
      return { type: 'text', text: message.conversation };
    } else if (message.extendedTextMessage) {
      return { type: 'text', text: message.extendedTextMessage.text };
    } else if (message.imageMessage) {
      return { type: 'image', caption: message.imageMessage.caption };
    } else if (message.videoMessage) {
      return { type: 'video', caption: message.videoMessage.caption };
    } else if (message.audioMessage) {
      return { type: 'audio' };
    } else if (message.documentMessage) {
      return { type: 'document', fileName: message.documentMessage.fileName };
    } else if (message.locationMessage) {
      return { 
        type: 'location', 
        latitude: message.locationMessage.degreesLatitude,
        longitude: message.locationMessage.degreesLongitude
      };
    } else if (message.contactMessage) {
      return { type: 'contact', displayName: message.contactMessage.displayName };
    } else {
      return { type: 'unknown', raw: message };
    }
  }

  /**
   * Handle message updates (receipts, reactions)
   */
  async handleMessageUpdates(companyId, updates) {
    for (const update of updates) {
      if (update.update.status) {
        // Message delivery/read status
        const status = update.update.status;
        logger.debug(`Message ${update.key.id} status: ${status} for company ${companyId}`);
        this.emit('message-status', { companyId, messageId: update.key.id, status });
      }
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(companyId, to, text, options = {}) {
    const socket = this.sessions.get(companyId);
    if (!socket) {
      throw new Error(`No active session for company ${companyId}`);
    }

    // Check connection state instead of just socket.user
    const state = this.connectionStates.get(companyId);
    if (state !== 'connected') {
      logger.warn(`Socket not connected for company ${companyId}, state: ${state}`);
      
      // Wait for connection with proper timeout
      const maxWait = 10000;
      const startTime = Date.now();
      
      while (this.connectionStates.get(companyId) !== 'connected') {
        if (Date.now() - startTime > maxWait) {
          throw new Error(`Connection timeout for company ${companyId}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    try {
      // Format phone number
      const jid = this.formatPhoneToJid(to);
      
      // Send message with retry
      let retries = 3;
      let lastError;
      
      while (retries > 0) {
        try {
          const result = await socket.sendMessage(jid, { 
            text,
            ...options 
          });
          
          logger.info(`✅ Message sent to ${jid} for company ${companyId}`);
          return { success: true, messageId: result.key.id };
        } catch (error) {
          lastError = error;
          retries--;
          if (retries > 0 && error.message?.includes('Connection Closed')) {
            logger.warn(`Connection closed, retrying... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw error;
          }
        }
      }
      
      throw lastError;

    } catch (error) {
      logger.error(`Failed to send message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send media message
   */
  async sendMedia(companyId, to, mediaUrl, type, caption = '', options = {}) {
    const socket = this.sessions.get(companyId);
    if (!socket) {
      throw new Error(`No active session for company ${companyId}`);
    }

    try {
      const jid = this.formatPhoneToJid(to);
      
      const mediaMessage = {
        [type]: { url: mediaUrl },
        caption,
        ...options
      };

      const result = await socket.sendMessage(jid, mediaMessage);
      
      logger.info(`✅ Media sent to ${jid} for company ${companyId}`);
      return { success: true, messageId: result.key.id };

    } catch (error) {
      logger.error(`Failed to send media for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(companyId, to, duration = 3000) {
    const socket = this.sessions.get(companyId);
    if (!socket) return;

    try {
      const jid = this.formatPhoneToJid(to);
      await socket.sendPresenceUpdate('composing', jid);
      
      // Stop typing after duration
      setTimeout(async () => {
        await socket.sendPresenceUpdate('paused', jid);
      }, duration);

    } catch (error) {
      logger.warn(`Failed to send typing indicator for company ${companyId}:`, error);
    }
  }

  /**
   * Send reaction to a message
   */
  async sendReaction(companyId, to, messageId, emoji) {
    const socket = this.sessions.get(companyId);
    if (!socket) {
      throw new Error(`No active session for company ${companyId}`);
    }

    try {
      const jid = this.formatPhoneToJid(to);
      
      await socket.sendMessage(jid, {
        react: {
          text: emoji,
          key: {
            remoteJid: jid,
            id: messageId
          }
        }
      });

      logger.info(`✅ Reaction sent for company ${companyId}`);
      return { success: true };

    } catch (error) {
      logger.error(`Failed to send reaction for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Register message handler for a company
   */
  registerMessageHandler(companyId, handler) {
    this.messageHandlers.set(companyId, handler);
    logger.info(`Message handler registered for company ${companyId}`);
  }

  /**
   * Get session status
   */
  getSessionStatus(companyId) {
    const socket = this.sessions.get(companyId);
    if (!socket) {
      return { connected: false, status: 'disconnected' };
    }

    return {
      connected: socket.user ? true : false,
      status: socket.user ? 'connected' : 'connecting',
      user: socket.user
    };
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    const sessions = [];
    for (const [companyId, socket] of this.sessions) {
      sessions.push({
        companyId,
        status: this.getSessionStatus(companyId)
      });
    }
    return sessions;
  }

  /**
   * Disconnect a session
   */
  async disconnectSession(companyId) {
    const socket = this.sessions.get(companyId);
    if (socket) {
      socket.end();
      this.sessions.delete(companyId);
      this.stores.delete(companyId);
      this.authStates.delete(companyId);
      this.messageHandlers.delete(companyId);
      
      // Clean up enhanced connection management
      this.connectionStates.delete(companyId);
      this.lastDisconnectReasons.delete(companyId);
      this.reconnectAttempts.delete(companyId);
      this.stopKeepAlive(companyId);
      
      logger.info(`Session disconnected for company ${companyId}`);
    }
  }

  /**
   * Disconnect all sessions
   */
  async disconnectAll() {
    for (const companyId of this.sessions.keys()) {
      await this.disconnectSession(companyId);
    }
    logger.info('All sessions disconnected');
  }

  /**
   * Delete session data (logout)
   */
  async deleteSession(companyId) {
    // Disconnect first
    await this.disconnectSession(companyId);
    
    // Delete auth folder
    const authFolder = path.join(this.sessionsPath, `company_${companyId}`);
    try {
      await fsPromises.rmdir(authFolder, { recursive: true });
      logger.info(`Session data deleted for company ${companyId}`);
    } catch (error) {
      logger.error(`Failed to delete session data for company ${companyId}:`, error);
    }
  }

  /**
   * Start keep-alive mechanism for a session
   */
  async startKeepAlive(companyId, socket) {
    if (!socket) {
      socket = this.sessions.get(companyId);
    }
    if (!socket) return;
    
    // Clear existing interval
    if (this.keepAliveIntervals.has(companyId)) {
      clearInterval(this.keepAliveIntervals.get(companyId));
    }
    
    const interval = setInterval(async () => {
      try {
        const state = this.connectionStates.get(companyId);
        if (state === 'connected' && socket.user) {
          // Send presence update as keep-alive
          await socket.sendPresenceUpdate('available');
          logger.debug(`💚 Keep-alive sent for company ${companyId}`);
        }
      } catch (error) {
        logger.warn(`⚠️ Keep-alive failed for company ${companyId}:`, error.message);
        // If keep-alive fails multiple times, try to reconnect
        if (error.message?.includes('Connection Closed')) {
          logger.warn(`Connection seems dead for company ${companyId}, initiating reconnection...`);
          this.stopKeepAlive(companyId);
          await this.handleReconnection(companyId);
        }
      }
    }, this.config.keepAliveIntervalMs);
    
    this.keepAliveIntervals.set(companyId, interval);
    logger.info(`💚 Keep-alive started for company ${companyId}`);
  }

  /**
   * Stop keep-alive mechanism for a session
   */
  stopKeepAlive(companyId) {
    if (this.keepAliveIntervals.has(companyId)) {
      clearInterval(this.keepAliveIntervals.get(companyId));
      this.keepAliveIntervals.delete(companyId);
      logger.info(`🛑 Keep-alive stopped for company ${companyId}`);
    }
  }

  /**
   * Format phone number to WhatsApp JID
   */
  formatPhoneToJid(phone) {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming Russia for now)
    const withCountry = cleaned.startsWith('7') ? cleaned : `7${cleaned}`;
    
    // Add WhatsApp suffix
    return `${withCountry}@s.whatsapp.net`;
  }

  /**
   * Check if company has active session
   */
  hasSession(companyId) {
    return this.sessions.has(companyId);
  }

  /**
   * Get QR code for authentication
   */
  async getQRCode(companyId) {
    // Force disconnect existing session to get new QR
    if (this.hasSession(companyId)) {
      const session = this.sessions.get(companyId);
      if (session) {
        try {
          await session.logout();
        } catch (err) {
          logger.warn(`Failed to logout session ${companyId}:`, err.message);
        }
        session.end();
      }
      this.sessions.delete(companyId);
    }

    // Clear old auth using consistent path
    const authPath = path.join(this.sessionsPath, `company_${companyId}`);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }

    // This will be populated when QR event is emitted
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('qr', qrHandler);
        reject(new Error('QR code generation timeout'));
      }, 30000);

      const qrHandler = (data) => {
        if (data.companyId === companyId) {
          clearTimeout(timeout);
          this.removeListener('qr', qrHandler);
          resolve(data.qr);
        }
      };

      this.on('qr', qrHandler);

      // Connect to get new QR
      this.connectSession(companyId).catch((err) => {
        clearTimeout(timeout);
        this.removeListener('qr', qrHandler);
        reject(err);
      });
    });
  }
}

// Export singleton instance
module.exports = new BaileysProvider();