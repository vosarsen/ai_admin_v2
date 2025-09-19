// src/integrations/whatsapp/session-manager.js
const baileysProvider = require('./providers/baileys-provider');
const healthMonitor = require('../../services/whatsapp/health-monitor');
const pairingCodeManager = require('../../services/whatsapp/pairing-code-manager');
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
    
    // Initialize health monitor with provider
    healthMonitor.initialize(this.provider);
    
    // Set up event listeners
    this.provider.on('ready', (data) => this.handleSessionReady(data));
    this.provider.on('disconnected', (data) => this.handleSessionDisconnected(data));
    this.provider.on('message', (data) => this.handleMessage(data));
    this.provider.on('qr', (data) => this.handleQRGenerated(data));
    this.provider.on('pairing-code', (data) => this.handlePairingCode(data));
    this.provider.on('qr-limit-reached', (data) => this.handleQRLimitReached(data));

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
        .select('id, company_id, phone, whatsapp_enabled, whatsapp_config')
        .eq('whatsapp_enabled', true);

      if (error) throw error;

      logger.info(`Loading ${companies?.length || 0} existing WhatsApp sessions`);

      for (const company of companies || []) {
        if (company.whatsapp_enabled) {
          // Use company_id (962302) instead of id (15) for WhatsApp sessions
          const companyIdToUse = company.company_id || company.id;
          await this.initializeCompanySession(companyIdToUse, company.whatsapp_config || {});
        }
      }
    } catch (error) {
      logger.error('Failed to load existing sessions:', error);
    }
  }

  /**
   * Initialize WhatsApp session for a company
   * @param {string} companyId - Company ID
   * @param {Object} config - Configuration options
   * @param {boolean} config.usePairingCode - Use pairing code instead of QR
   * @param {string} config.phoneNumber - Phone number for pairing code
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

      // Check if should use pairing code
      const shouldUsePairing = config.usePairingCode || await pairingCodeManager.shouldUsePairingCode(companyId);

      if (shouldUsePairing && !config.phoneNumber) {
        // Get phone number from company settings
        const { data: company } = await supabase
          .from('companies')
          .select('whatsapp_phone')
          .eq('company_id', companyId)
          .single();

        config.phoneNumber = company?.whatsapp_phone;
      }

      // Update config with pairing preference
      const connectionConfig = {
        ...config,
        usePairingCode: shouldUsePairing
      };

      // Connect session
      await this.provider.connectSession(companyId, connectionConfig);
      
      // Register message handler
      this.provider.registerMessageHandler(companyId, async (message) => {
        await this.processIncomingMessage(companyId, message);
      });

      // Store session info
      const sessionInfo = {
        companyId,
        connectedAt: new Date(),
        config: connectionConfig,
        status: 'connecting',
        method: shouldUsePairing ? 'pairing_code' : 'qr'
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
      
      // Store in database - temporarily disabled due to Supabase errors
      // await this.storeMessage(companyId, webhookData);

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
      try {
        await supabase
          .from('messages')
          .insert({
            company_id: companyId,
            phone,
            message,
            message_id: result.messageId,
            direction: 'outgoing',
            status: 'sent',
            created_at: new Date()
          });
      } catch (dbError) {
        logger.warn(`Failed to store message in database: ${dbError.message}`);
        // Don't throw - message was sent successfully
      }

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
      try {
        await supabase
          .from('messages')
          .insert({
            company_id: companyId,
            phone,
            message: caption || `[${type}]`,
            message_id: result.messageId,
            media_url: mediaUrl,
            media_type: type,
            direction: 'outgoing',
            status: 'sent',
            created_at: new Date()
          });
      } catch (dbError) {
        logger.warn(`Failed to store media message in database: ${dbError.message}`);
        // Don't throw - media was sent successfully
      }

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
    
    // Start health monitoring for this session
    healthMonitor.startMonitoring(companyId);
    
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
    
    // Stop health monitoring for this session
    healthMonitor.stopMonitoring(companyId);
    
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
      await supabase
        .from('companies')
        .update({
          whatsapp_status: status,
          whatsapp_last_connected: status === 'connected' ? new Date() : undefined
        })
        .eq('company_id', companyId);
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
    try {
      await supabase
        .from('companies')
        .update({
          whatsapp_enabled: false,
          whatsapp_status: 'disconnected',
          whatsapp_config: null
        })
        .eq('company_id', companyId);
    } catch (dbError) {
      logger.warn(`Failed to update company status in database: ${dbError.message}`);
    }
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
   * Handle QR code generated event
   */
  async handleQRGenerated({ companyId, qr }) {
    logger.info(`📱 QR code generated for company ${companyId}`);

    // Track QR generation in Redis
    const { redisClient } = require('../../services/redis/redis-factory');
    const qrCount = await redisClient.incr(`whatsapp:qr_count:${companyId}`);
    await redisClient.expire(`whatsapp:qr_count:${companyId}`, 3600); // 1 hour expiry

    // Log to database
    await supabase
      .from('whatsapp_events')
      .insert({
        company_id: companyId,
        event_type: 'qr_generated',
        details: { attempt: qrCount }
      });

    // Emit for web interface
    this.emit('qr', { companyId, qr, attempts: qrCount });
  }

  /**
   * Handle pairing code generated event
   */
  async handlePairingCode({ companyId, code, phoneNumber }) {
    logger.info(`🔢 Pairing code generated for company ${companyId}: ${code}`);

    // Store the code
    await pairingCodeManager.storePairingCode(companyId, code);

    // Log to database
    await supabase
      .from('whatsapp_events')
      .insert({
        company_id: companyId,
        event_type: 'pairing_generated',
        details: { phoneNumber, code }
      });

    // Emit for web interface
    this.emit('pairing-code', { companyId, code, phoneNumber });
  }

  /**
   * Handle QR limit reached event
   */
  async handleQRLimitReached({ companyId, attempts }) {
    logger.warn(`⚠️ QR limit reached for company ${companyId} (${attempts} attempts)`);

    // Get company phone for pairing code
    const { data: company } = await supabase
      .from('companies')
      .select('whatsapp_phone, notification_email')
      .eq('company_id', companyId)
      .single();

    if (company?.whatsapp_phone) {
      logger.info(`Switching to pairing code for company ${companyId}`);

      // Reinitialize with pairing code
      await this.initializeCompanySession(companyId, {
        usePairingCode: true,
        phoneNumber: company.whatsapp_phone
      });
    } else {
      logger.error(`No phone number configured for company ${companyId}, cannot use pairing code`);

      // Notify admin
      this.emit('connection-failed', {
        companyId,
        reason: 'qr_limit_no_phone',
        message: 'QR limit reached but no phone number configured for pairing code'
      });
    }
  }

  /**
   * Request pairing code for company
   */
  async requestPairingCode(companyId, phoneNumber) {
    // Check if can generate code
    const canGenerate = pairingCodeManager.canGenerateCode(companyId);
    if (canGenerate !== true) {
      throw new Error(`Rate limit: ${canGenerate.reason}. Wait ${canGenerate.minutesLeft} minutes.`);
    }

    // Generate pairing code request
    await pairingCodeManager.generatePairingCode(companyId, phoneNumber);

    // Initialize session with pairing code
    await this.initializeCompanySession(companyId, {
      usePairingCode: true,
      phoneNumber
    });

    // Wait for code to be generated
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the generated code
    const codeInfo = await pairingCodeManager.getPendingCode(companyId);

    return codeInfo;
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