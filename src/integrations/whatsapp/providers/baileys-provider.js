// src/integrations/whatsapp/providers/baileys-provider.js
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, makeInMemoryStore } = require('@whiskeysockets/baileys');
const P = require('pino');
const path = require('path');
const fs = require('fs').promises;
const qrcode = require('qrcode-terminal');
const logger = require('../../../utils/logger');
const EventEmitter = require('events');

class BaileysProvider extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // companyId -> socket instance
    this.stores = new Map(); // companyId -> store instance
    this.authStates = new Map(); // companyId -> auth state
    this.reconnectAttempts = new Map(); // companyId -> attempt count
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
    this.sessionsPath = path.join(process.cwd(), 'sessions');
    this.messageHandlers = new Map(); // companyId -> handler function
  }

  async initialize() {
    // Create sessions directory if not exists
    try {
      await fs.access(this.sessionsPath);
    } catch {
      await fs.mkdir(this.sessionsPath, { recursive: true });
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

      // Create store for message history
      const store = makeInMemoryStore({ 
        logger: P({ level: 'silent' }) 
      });
      this.stores.set(companyId, store);

      // Read store state if exists
      const storeFile = path.join(authFolder, 'store.json');
      try {
        const storeData = await fs.readFile(storeFile, 'utf-8');
        store.readFromFile(storeFile);
      } catch {
        // Store file doesn't exist yet
      }

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
        ...config
      });

      // Bind store to socket
      store.bind(socket.ev);

      // Save store periodically
      setInterval(async () => {
        const storeFile = path.join(authFolder, 'store.json');
        await fs.writeFile(storeFile, JSON.stringify(store, null, 2));
      }, 30000); // Every 30 seconds

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
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      
      logger.warn(`Connection closed for company ${companyId}. Should reconnect: ${shouldReconnect}`);
      
      if (shouldReconnect) {
        await this.handleReconnection(companyId);
      } else {
        // Logged out, clean up session
        await this.disconnectSession(companyId);
      }
    } else if (connection === 'open') {
      logger.info(`✅ Connection opened for company ${companyId}`);
      this.reconnectAttempts.set(companyId, 0);
      this.emit('ready', { companyId });
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  async handleReconnection(companyId) {
    const attempts = this.reconnectAttempts.get(companyId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts reached for company ${companyId}`);
      this.emit('disconnected', { companyId, reason: 'max_attempts' });
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, attempts);
    logger.info(`Reconnecting company ${companyId} in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);
    
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

      const messageInfo = {
        companyId,
        messageId: msg.key.id,
        from: msg.key.remoteJid,
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

    try {
      // Format phone number
      const jid = this.formatPhoneToJid(to);
      
      // Send message
      const result = await socket.sendMessage(jid, { 
        text,
        ...options 
      });

      logger.info(`✅ Message sent to ${jid} for company ${companyId}`);
      return { success: true, messageId: result.key.id };

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
      await fs.rmdir(authFolder, { recursive: true });
      logger.info(`Session data deleted for company ${companyId}`);
    } catch (error) {
      logger.error(`Failed to delete session data for company ${companyId}:`, error);
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
    // This will be populated when QR event is emitted
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('QR code generation timeout'));
      }, 30000);

      this.once('qr', (data) => {
        if (data.companyId === companyId) {
          clearTimeout(timeout);
          resolve(data.qr);
        }
      });

      // Try to connect if not already
      if (!this.hasSession(companyId)) {
        this.connectSession(companyId).catch(reject);
      }
    });
  }
}

// Export singleton instance
module.exports = new BaileysProvider();