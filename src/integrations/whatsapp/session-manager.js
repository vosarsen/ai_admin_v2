// src/integrations/whatsapp/session-manager.js
const baileysProvider = require('./providers/baileys-provider');
const { supabase } = require('../../database/supabase');
const logger = require('../../utils/logger');
const EventEmitter = require('events');

class WhatsAppSessionManager extends EventEmitter {
  constructor() {
    super();
    this.provider = baileysProvider;
    this.activeSessions = new Map(); // companyId -> sessionInfo
    this.initializationQueue = new Set(); // Companies being initialized
    this.healthCheckInterval = null;
  }

  /**
   * Initialize session manager
   */
  async initialize() {
    await this.provider.initialize();
    
    // Set up event listeners
    this.provider.on('ready', (data) => this.handleSessionReady(data));
    this.provider.on('disconnected', (data) => this.handleSessionDisconnected(data));
    this.provider.on('message', (data) => this.handleMessage(data));
    this.provider.on('qr', (data) => this.emit('qr', data));

    // Load existing sessions from database
    await this.loadExistingSessions();
    
    // Start health check
    this.startHealthCheck();
    
    logger.info('✅ WhatsApp Session Manager initialized');
  }

  /**
   * Load existing company sessions from database
   */
  async loadExistingSessions() {
    try {
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, phone, whatsapp_enabled, whatsapp_config')
        .eq('whatsapp_enabled', true);

      if (error) throw error;

      logger.info(`Loading ${companies?.length || 0} existing WhatsApp sessions`);

      for (const company of companies || []) {
        if (company.whatsapp_enabled) {
          await this.initializeCompanySession(company.id, company.whatsapp_config);
        }
      }
    } catch (error) {
      logger.error('Failed to load existing sessions:', error);
    }
  }

  /**
   * Initialize WhatsApp session for a company
   */
  async initializeCompanySession(companyId, config = {}) {
    // Prevent duplicate initialization
    if (this.initializationQueue.has(companyId)) {
      logger.warn(`Session for company ${companyId} is already being initialized`);
      return;
    }

    if (this.activeSessions.has(companyId)) {
      logger.info(`Session for company ${companyId} already active`);
      return this.activeSessions.get(companyId);
    }

    this.initializationQueue.add(companyId);

    try {
      logger.info(`🔄 Initializing WhatsApp session for company ${companyId}`);
      
      // Connect session
      await this.provider.connectSession(companyId, config);
      
      // Register message handler
      this.provider.registerMessageHandler(companyId, async (message) => {
        await this.processIncomingMessage(companyId, message);
      });

      // Store session info
      const sessionInfo = {
        companyId,
        connectedAt: new Date(),
        config,
        status: 'connecting'
      };
      
      this.activeSessions.set(companyId, sessionInfo);
      
      // Update database
      await this.updateSessionStatus(companyId, 'connecting');
      
      logger.info(`✅ Session initialized for company ${companyId}`);
      
      return sessionInfo;

    } catch (error) {
      logger.error(`Failed to initialize session for company ${companyId}:`, error);
      throw error;
    } finally {
      this.initializationQueue.delete(companyId);
    }
  }

  /**
   * Process incoming message
   */
  async processIncomingMessage(companyId, message) {
    try {
      logger.info(`📨 Processing message for company ${companyId} from ${message.from}`);
      
      // Extract phone number from JID
      const phone = message.from.replace('@s.whatsapp.net', '').replace('@g.us', '');
      
      // Format message for webhook
      const webhookData = {
        companyId,
        phone,
        message: message.message,
        messageId: message.messageId,
        pushName: message.pushName,
        timestamp: message.timestamp
      };

      // Emit for webhook processing
      this.emit('webhook-message', webhookData);
      
      // Store in database
      await this.storeMessage(companyId, webhookData);

    } catch (error) {
      logger.error(`Failed to process message for company ${companyId}:`, error);
    }
  }

  /**
   * Store message in database
   */
  async storeMessage(companyId, messageData) {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          company_id: companyId,
          phone: messageData.phone,
          message: messageData.message,
          message_id: messageData.messageId,
          direction: 'incoming',
          status: 'received',
          created_at: new Date(messageData.timestamp * 1000)
        });

      if (error) throw error;

    } catch (error) {
      logger.error(`Failed to store message for company ${companyId}:`, error);
    }
  }

  /**
   * Send message through appropriate session
   */
  async sendMessage(companyId, phone, message, options = {}) {
    const session = this.activeSessions.get(companyId);
    
    if (!session || session.status !== 'connected') {
      throw new Error(`No active session for company ${companyId}`);
    }

    try {
      // Send typing indicator
      await this.provider.sendTyping(companyId, phone);
      
      // Send message
      const result = await this.provider.sendMessage(companyId, phone, message, options);
      
      // Store outgoing message
      // TODO: Fix supabase import issue
      // await supabase
      //   .from('messages')
      //   .insert({
      //     company_id: companyId,
      //     phone,
      //     message,
      //     message_id: result.messageId,
      //     direction: 'outgoing',
      //     status: 'sent',
      //     created_at: new Date()
      //   });

      return result;

    } catch (error) {
      logger.error(`Failed to send message for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Send media message
   */
  async sendMedia(companyId, phone, mediaUrl, type, caption = '') {
    const session = this.activeSessions.get(companyId);
    
    if (!session || session.status !== 'connected') {
      throw new Error(`No active session for company ${companyId}`);
    }

    try {
      const result = await this.provider.sendMedia(companyId, phone, mediaUrl, type, caption);
      
      // Store outgoing media
      // TODO: Fix supabase import issue
      // await supabase
      //   .from('messages')
      //   .insert({
      //     company_id: companyId,
      //     phone,
      //     message: caption || `[${type}]`,
      //     message_id: result.messageId,
      //     media_url: mediaUrl,
      //     media_type: type,
      //     direction: 'outgoing',
      //     status: 'sent',
      //     created_at: new Date()
      //   });

      return result;

    } catch (error) {
      logger.error(`Failed to send media for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Handle session ready event
   */
  handleSessionReady({ companyId }) {
    const session = this.activeSessions.get(companyId);
    if (session) {
      session.status = 'connected';
      session.connectedAt = new Date();
    }
    
    this.updateSessionStatus(companyId, 'connected');
    logger.info(`✅ Session ready for company ${companyId}`);
    this.emit('session-ready', { companyId });
  }

  /**
   * Handle session disconnected event
   */
  handleSessionDisconnected({ companyId, reason }) {
    const session = this.activeSessions.get(companyId);
    if (session) {
      session.status = 'disconnected';
      session.disconnectedAt = new Date();
      session.disconnectReason = reason;
    }
    
    this.updateSessionStatus(companyId, 'disconnected');
    logger.warn(`❌ Session disconnected for company ${companyId}: ${reason}`);
    this.emit('session-disconnected', { companyId, reason });
  }

  /**
   * Handle incoming message event
   */
  handleMessage(messageData) {
    // Already processed in processIncomingMessage
    this.emit('message', messageData);
  }

  /**
   * Update session status in database
   */
  async updateSessionStatus(companyId, status) {
    try {
      // TODO: Fix supabase import issue
      // await supabase
      //   .from('companies')
      //   .update({ 
      //     whatsapp_status: status,
      //     whatsapp_last_connected: status === 'connected' ? new Date() : undefined
      //   })
      //   .eq('id', companyId);
    } catch (error) {
      logger.error(`Failed to update session status for company ${companyId}:`, error);
    }
  }

  /**
   * Get session status for a company
   */
  getSessionStatus(companyId) {
    const session = this.activeSessions.get(companyId);
    const providerStatus = this.provider.getSessionStatus(companyId);
    
    return {
      ...session,
      ...providerStatus
    };
  }

  /**
   * Get all sessions status
   */
  getAllSessionsStatus() {
    const sessions = [];
    for (const [companyId, session] of this.activeSessions) {
      sessions.push({
        ...session,
        ...this.provider.getSessionStatus(companyId)
      });
    }
    return sessions;
  }

  /**
   * Disconnect session for a company
   */
  async disconnectSession(companyId) {
    await this.provider.disconnectSession(companyId);
    this.activeSessions.delete(companyId);
    await this.updateSessionStatus(companyId, 'disconnected');
  }

  /**
   * Delete session (logout)
   */
  async deleteSession(companyId) {
    await this.provider.deleteSession(companyId);
    this.activeSessions.delete(companyId);
    
    // Update database
    // TODO: Fix supabase import issue
    // await supabase
    //   .from('companies')
    //   .update({ 
    //     whatsapp_enabled: false,
    //     whatsapp_status: 'disconnected',
    //     whatsapp_config: null
    //   })
    //   .eq('id', companyId);
  }

  /**
   * Get QR code for company authentication
   */
  async getQRCode(companyId) {
    // Initialize session if not exists
    if (!this.activeSessions.has(companyId)) {
      await this.initializeCompanySession(companyId);
    }
    
    return await this.provider.getQRCode(companyId);
  }

  /**
   * Start health check for all sessions
   */
  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      for (const [companyId, session] of this.activeSessions) {
        const status = this.provider.getSessionStatus(companyId);
        
        if (session.status !== status.status) {
          session.status = status.status;
          await this.updateSessionStatus(companyId, status.status);
        }
        
        // Try to reconnect if disconnected
        if (status.status === 'disconnected' && session.autoReconnect !== false) {
          logger.info(`Attempting to reconnect company ${companyId}`);
          try {
            await this.provider.connectSession(companyId, session.config);
          } catch (error) {
            logger.error(`Failed to reconnect company ${companyId}:`, error);
          }
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Stop health check
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Shutdown all sessions
   */
  async shutdown() {
    logger.info('Shutting down WhatsApp Session Manager...');
    
    this.stopHealthCheck();
    await this.provider.disconnectAll();
    this.activeSessions.clear();
    
    logger.info('WhatsApp Session Manager shut down');
  }
}

// Export singleton instance
module.exports = new WhatsAppSessionManager();