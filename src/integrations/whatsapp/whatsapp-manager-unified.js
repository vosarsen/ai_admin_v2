/**
 * WhatsApp Manager - Unified Architecture
 * Direct integration with session-pool, removing intermediate layers
 *
 * Architecture: API → WhatsApp Manager → Session Pool
 * (2 layers instead of 4)
 */

const { getSessionPool } = require('./session-pool');
const whatsappConfig = require('../../config/whatsapp');
const logger = require('../../utils/logger');
const {
  WhatsAppError,
  ConnectionError,
  MessageSendError,
  ValidationError,
  ConfigurationError,
  ErrorHandler
} = require('../../utils/whatsapp-errors');
const WhatsAppMetrics = require('../../utils/whatsapp-metrics');
const WhatsAppValidator = require('../../utils/whatsapp-validator');

class WhatsAppManagerUnified {
  constructor() {
    this.sessionPool = null;
    this.isInitialized = false;
    this.config = whatsappConfig;
    this.metrics = new WhatsAppMetrics();
    this.validator = WhatsAppValidator;

    // Multi-tenant mode configuration
    this.defaultCompanyId = this.config.isMultiTenant() ?
      null :
      this.config.defaults.singleTenantCompanyId;

    // Singleton pattern
    if (WhatsAppManagerUnified.instance) {
      return WhatsAppManagerUnified.instance;
    }
    WhatsAppManagerUnified.instance = this;
  }

  /**
   * Initialize WhatsApp system
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    logger.info('🚀 Initializing Unified WhatsApp Manager');

    try {
      // Get session pool singleton
      this.sessionPool = getSessionPool();

      if (!this.sessionPool) {
        throw new ConfigurationError('Failed to get session pool instance');
      }

      // Initialize default company if configured
      // Skip if BAILEYS_STANDALONE=true (separate baileys-service is running)
      if (process.env.BAILEYS_STANDALONE === 'true') {
        logger.info('⚠️ Skipping default company initialization (BAILEYS_STANDALONE mode)');
      } else if (this.defaultCompanyId && !this.config.isMultiTenant()) {
        try {
          await this.sessionPool.getOrCreateSession(this.defaultCompanyId);
          logger.info(`✅ Default company ${this.defaultCompanyId} initialized`);
        } catch (error) {
          logger.warn(`Failed to initialize default company: ${error.message}`);
          // Don't throw - allow system to work without default company
        }
      }

      // Start metrics collection
      this.setupMetricsCollection();

      this.isInitialized = true;
      logger.info('✅ Unified WhatsApp Manager initialized');
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      ErrorHandler.log(standardError, logger);
      throw new ConfigurationError(
        `Failed to initialize WhatsApp Manager: ${standardError.message}`,
        'initialization'
      );
    }
  }

  /**
   * Setup metrics collection from session pool events
   */
  setupMetricsCollection() {
    if (!this.sessionPool) return;

    this.sessionPool.on('message', ({ companyId }) => {
      this.metrics.recordMessage(companyId, 'received');
    });

    this.sessionPool.on('connected', ({ companyId }) => {
      this.metrics.recordConnection(companyId, 'connected');
    });

    this.sessionPool.on('logout', ({ companyId }) => {
      this.metrics.recordConnection(companyId, 'disconnected');
    });

    this.sessionPool.on('error', ({ companyId, error }) => {
      this.metrics.recordError(companyId, error);
    });
  }

  /**
   * Ensure initialization before operations
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Get or determine company ID
   */
  getCompanyId(options = {}) {
    const companyId = options.companyId || this.defaultCompanyId;

    if (!companyId) {
      throw new ValidationError('Company ID is required in multi-tenant mode');
    }

    return companyId;
  }

  // ============= Core Messaging Functions =============

  /**
   * Send text message
   */
  async sendMessage(phone, message, options = {}) {
    await this.ensureInitialized();

    try {
      // Validate inputs
      const validation = this.validator.validateMessage(phone, message);
      if (!validation.valid) {
        throw new ValidationError(validation.error);
      }

      const companyId = this.getCompanyId(options);
      const cleanPhone = this.validator.sanitizePhone(phone);

      // Send via session pool
      const result = await this.sessionPool.sendMessage(
        companyId,
        cleanPhone,
        message,
        options
      );

      // Record metrics
      this.metrics.recordMessage(companyId, 'sent');

      return {
        success: true,
        messageId: result.messageId,
        timestamp: Date.now()
      };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      this.metrics.recordError(options.companyId, standardError);
      throw new MessageSendError(
        standardError.message,
        phone,
        { originalError: error }
      );
    }
  }

  /**
   * Send reaction to message
   */
  async sendReaction(phone, emoji, messageId, options = {}) {
    await this.ensureInitialized();

    try {
      const companyId = this.getCompanyId(options);
      const cleanPhone = this.validator.sanitizePhone(phone);

      await this.sessionPool.sendReaction(companyId, cleanPhone, emoji, messageId);

      return { success: true };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      this.metrics.recordError(options.companyId, standardError);
      throw standardError;
    }
  }

  /**
   * Send media message
   */
  async sendMedia(phone, mediaUrl, caption = '', options = {}) {
    await this.ensureInitialized();

    try {
      const validation = this.validator.validateMediaUrl(mediaUrl);
      if (!validation.valid) {
        throw new ValidationError(validation.error);
      }

      const companyId = this.getCompanyId(options);
      const cleanPhone = this.validator.sanitizePhone(phone);

      const result = await this.sessionPool.sendMessage(
        companyId,
        cleanPhone,
        caption,
        { ...options, media: mediaUrl }
      );

      this.metrics.recordMessage(companyId, 'sent', 'media');

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      this.metrics.recordError(options.companyId, standardError);
      throw standardError;
    }
  }

  /**
   * Send buttons message (deprecated in newer WhatsApp)
   */
  async sendButtons(phone, message, buttons, options = {}) {
    await this.ensureInitialized();

    try {
      const companyId = this.getCompanyId(options);
      const cleanPhone = this.validator.sanitizePhone(phone);

      // Convert to regular message with numbered options
      const buttonText = buttons
        .map((btn, i) => `${i + 1}. ${btn.text}`)
        .join('\n');

      const fullMessage = `${message}\n\n${buttonText}`;

      const result = await this.sessionPool.sendMessage(
        companyId,
        cleanPhone,
        fullMessage,
        options
      );

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      this.metrics.recordError(options.companyId, standardError);
      throw standardError;
    }
  }

  // ============= Session Management =============

  /**
   * Get session status
   */
  async getStatus(companyId = null) {
    await this.ensureInitialized();

    try {
      const targetCompanyId = companyId || this.defaultCompanyId;

      if (!targetCompanyId) {
        // Return overall system status
        return {
          initialized: this.isInitialized,
          sessions: this.sessionPool.getActiveSessions(),
          metrics: this.metrics.getGlobalMetrics()
        };
      }

      const status = this.sessionPool.getSessionStatus(targetCompanyId);
      return status;
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      throw standardError;
    }
  }

  /**
   * Connect WhatsApp session
   */
  async connect(companyId, options = {}) {
    await this.ensureInitialized();

    try {
      const validation = this.validator.validateCompanyId(companyId);
      if (!validation.valid) {
        throw new ValidationError(validation.error);
      }

      const session = await this.sessionPool.getOrCreateSession(companyId, options);

      return {
        success: true,
        companyId,
        status: 'connecting'
      };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      throw new ConnectionError(
        `Failed to connect WhatsApp: ${standardError.message}`,
        companyId
      );
    }
  }

  /**
   * Disconnect WhatsApp session
   */
  async disconnect(companyId) {
    await this.ensureInitialized();

    try {
      await this.sessionPool.removeSession(companyId);

      return {
        success: true,
        companyId,
        status: 'disconnected'
      };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      throw standardError;
    }
  }

  /**
   * Get QR code for connection
   */
  async getQRCode(companyId) {
    await this.ensureInitialized();

    try {
      const qrData = this.sessionPool.getQRCode(companyId);

      if (!qrData) {
        throw new SessionError('No QR code available', companyId);
      }

      return qrData;
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      throw standardError;
    }
  }

  /**
   * Request pairing code
   */
  async requestPairingCode(companyId, phoneNumber) {
    await this.ensureInitialized();

    try {
      const validation = this.validator.validatePhone(phoneNumber);
      if (!validation.valid) {
        throw new ValidationError(validation.error);
      }

      const code = await this.sessionPool.requestPairingCode(
        companyId,
        validation.sanitized
      );

      if (!code) {
        throw new SessionError('Failed to generate pairing code', companyId);
      }

      return {
        success: true,
        code,
        expiresIn: 60
      };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      throw standardError;
    }
  }

  // ============= Health & Metrics =============

  /**
   * Health check
   */
  async healthCheck(companyId = null) {
    await this.ensureInitialized();

    try {
      if (companyId) {
        return await this.sessionPool.healthCheck(companyId);
      }

      // Overall system health
      const sessions = this.sessionPool.getActiveSessions();
      const metrics = this.sessionPool.getMetrics();

      return {
        healthy: metrics.errors < 10,
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.connected).length,
        errors: metrics.errors,
        uptime: Date.now() - (metrics.startTime || Date.now())
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Get metrics
   */
  getMetrics(companyId = null) {
    if (companyId) {
      return this.metrics.getCompanyMetrics(companyId);
    }

    return {
      global: this.metrics.getGlobalMetrics(),
      performance: this.metrics.getPerformanceMetrics(),
      companies: this.config.isMultiTenant() ?
        this.metrics.getAllCompanyMetrics() : null
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    logger.info('Shutting down WhatsApp Manager...');

    if (this.sessionPool) {
      await this.sessionPool.shutdown();
    }

    this.isInitialized = false;
    logger.info('WhatsApp Manager shutdown complete');
  }
}

// Export singleton instance
module.exports = new WhatsAppManagerUnified();