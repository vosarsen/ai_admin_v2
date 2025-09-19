/**
 * WhatsApp Manager - Simplified Architecture
 * Combines client factory and baileys client functionality
 *
 * Architecture: WhatsApp Manager → Session Manager → Provider
 * (3 layers instead of 4)
 */

const sessionManager = require('./session-manager');
const config = require('../../config');
const logger = require('../../utils/logger');
const {
  WhatsAppError,
  ConnectionError,
  SessionError,
  MessageSendError,
  ValidationError,
  ConfigurationError,
  ErrorHandler
} = require('../../utils/whatsapp-errors');

class WhatsAppManager {
  constructor() {
    this.sessionManager = sessionManager;
    this.isInitialized = false;
    this.defaultCompanyId = config.yclients?.companyId || process.env.YCLIENTS_COMPANY_ID || '962302';

    // Provider configuration
    this.provider = config.whatsapp?.provider || 'baileys';

    // Singleton instance
    if (WhatsAppManager.instance) {
      return WhatsAppManager.instance;
    }
    WhatsAppManager.instance = this;
  }

  /**
   * Initialize WhatsApp system
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    logger.info(`🚀 Initializing WhatsApp Manager with ${this.provider} provider`);

    try {
      // Initialize session manager
      await this.sessionManager.initialize();

      // Initialize default company if configured
      if (this.defaultCompanyId) {
        try {
          await this.sessionManager.initializeCompanySession(this.defaultCompanyId);
          logger.info(`✅ Default company ${this.defaultCompanyId} initialized`);
        } catch (error) {
          const standardError = ErrorHandler.standardize(error);
          logger.warn(`Failed to initialize default company: ${standardError.message}`);
          // Don't throw - allow system to work without default company
        }
      }

      this.isInitialized = true;
      logger.info('✅ WhatsApp Manager initialized');
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      ErrorHandler.log(standardError, logger);
      throw new ConfigurationError(
        `Failed to initialize WhatsApp Manager: ${standardError.message}`,
        'initialization',
        { provider: this.provider }
      );
    }
  }

  /**
   * Ensure initialization before operations
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // ============= Core Messaging Functions =============

  /**
   * Send text message
   * @param {string} phone - Phone number
   * @param {string} message - Message text
   * @param {Object} options - Options including companyId
   */
  async sendMessage(phone, message, options = {}) {
    await this.ensureInitialized();

    const companyId = options.companyId || this.defaultCompanyId;

    // Validate input
    if (!phone) {
      throw new ValidationError('Phone number is required', 'phone');
    }
    if (!message) {
      throw new ValidationError('Message is required', 'message');
    }
    if (!this.isValidPhone(phone)) {
      throw new ValidationError('Invalid phone number format', 'phone', { phone });
    }

    try {
      const result = await this.sessionManager.sendMessage(companyId, phone, message, options);
      return { success: true, ...result };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      ErrorHandler.log(standardError, logger);

      if (error.message?.includes('No active session')) {
        throw new SessionError('No active WhatsApp session', companyId, { phone });
      }
      if (error.message?.includes('rate')) {
        throw standardError; // Already standardized as RateLimitError
      }

      throw new MessageSendError(
        `Failed to send message: ${standardError.message}`,
        phone,
        { companyId, originalError: standardError.code }
      );
    }
  }

  /**
   * Send media message
   * @param {string} phone - Phone number
   * @param {string} mediaUrl - Media URL or path
   * @param {string} type - Media type (image, video, document)
   * @param {string} caption - Optional caption
   * @param {Object} options - Options including companyId
   */
  async sendMedia(phone, mediaUrl, type, caption = '', options = {}) {
    await this.ensureInitialized();

    const companyId = options.companyId || this.defaultCompanyId;

    // Validate input
    if (!phone) {
      throw new ValidationError('Phone number is required', 'phone');
    }
    if (!mediaUrl) {
      throw new ValidationError('Media URL is required', 'mediaUrl');
    }
    if (!['image', 'video', 'audio', 'document'].includes(type)) {
      throw new ValidationError('Invalid media type', 'type', { type });
    }

    try {
      const result = await this.sessionManager.sendMedia(companyId, phone, mediaUrl, type, caption);
      return { success: true, ...result };
    } catch (error) {
      const standardError = ErrorHandler.standardize(error);
      ErrorHandler.log(standardError, logger);

      throw new MessageSendError(
        `Failed to send media: ${standardError.message}`,
        phone,
        { companyId, mediaUrl, type, originalError: standardError.code }
      );
    }
  }

  /**
   * Send file
   * @param {string} phone - Phone number
   * @param {string} fileUrl - File URL or path
   * @param {string} caption - Optional caption
   * @param {Object} options - Options
   */
  async sendFile(phone, fileUrl, caption = '', options = {}) {
    return this.sendMedia(phone, fileUrl, 'document', caption, options);
  }

  /**
   * Send typing indicator
   * @param {string} phone - Phone number
   * @param {number} duration - Duration in ms
   * @param {Object} options - Options
   */
  async sendTyping(phone, duration = 3000, options = {}) {
    await this.ensureInitialized();

    const companyId = options.companyId || this.defaultCompanyId;

    try {
      await this.sessionManager.provider.sendTyping(companyId, phone, duration);
      return { success: true };
    } catch (error) {
      logger.warn(`Failed to send typing: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ============= Session Management =============

  /**
   * Initialize session for specific company
   * @param {string} companyId - Company ID
   * @param {Object} config - Company configuration
   */
  async initializeCompany(companyId, config = {}) {
    await this.ensureInitialized();
    return await this.sessionManager.initializeCompanySession(companyId, config);
  }

  /**
   * Get session status for company
   * @param {string} companyId - Company ID
   */
  getSessionStatus(companyId = null) {
    const targetCompanyId = companyId || this.defaultCompanyId;
    return this.sessionManager.getSessionStatus(targetCompanyId);
  }

  /**
   * Get all sessions status
   */
  getAllSessionsStatus() {
    return this.sessionManager.getAllSessionsStatus();
  }

  /**
   * Disconnect session for company
   * @param {string} companyId - Company ID
   */
  async disconnectSession(companyId) {
    return await this.sessionManager.disconnectSession(companyId);
  }

  /**
   * Delete session for company (logout)
   * @param {string} companyId - Company ID
   */
  async deleteSession(companyId) {
    return await this.sessionManager.deleteSession(companyId);
  }

  // ============= QR Code & Pairing =============

  /**
   * Get QR code for authentication
   * @param {string} companyId - Company ID
   */
  async getQRCode(companyId = null) {
    await this.ensureInitialized();

    const targetCompanyId = companyId || this.defaultCompanyId;
    return await this.sessionManager.getQRCode(targetCompanyId);
  }

  /**
   * Request pairing code for company
   * @param {string} companyId - Company ID
   * @param {string} phoneNumber - Phone number for pairing
   */
  async requestPairingCode(companyId, phoneNumber) {
    await this.ensureInitialized();
    return await this.sessionManager.requestPairingCode(companyId, phoneNumber);
  }

  // ============= Health & Monitoring =============

  /**
   * Check system health
   */
  async checkHealth() {
    const status = {
      initialized: this.isInitialized,
      provider: this.provider,
      defaultCompany: this.defaultCompanyId,
      sessions: {}
    };

    if (this.isInitialized) {
      const allSessions = this.sessionManager.getAllSessionsStatus();
      status.sessions = allSessions;
      status.totalSessions = Object.keys(allSessions).length;
      status.connectedSessions = Object.values(allSessions).filter(s => s.connected).length;
    }

    return status;
  }

  /**
   * Diagnose connection problem
   * @param {string} phone - Phone number to test
   * @param {string} companyId - Company ID
   */
  async diagnoseProblem(phone, companyId = null) {
    await this.ensureInitialized();

    const targetCompanyId = companyId || this.defaultCompanyId;

    const diagnosis = {
      timestamp: new Date(),
      companyId: targetCompanyId,
      phone: phone,
      checks: {}
    };

    // Check session status
    diagnosis.checks.sessionStatus = this.getSessionStatus(targetCompanyId);

    // Check if connected
    if (!diagnosis.checks.sessionStatus.connected) {
      diagnosis.problem = 'Session not connected';
      diagnosis.solution = 'Initialize session or scan QR code';
      return diagnosis;
    }

    // Try sending test message
    try {
      const testResult = await this.sendMessage(phone, '🔍 Test message from diagnostics', {
        companyId: targetCompanyId
      });

      diagnosis.checks.messageSend = testResult;

      if (testResult.success) {
        diagnosis.problem = 'No problems detected';
        diagnosis.status = 'healthy';
      } else {
        diagnosis.problem = 'Message sending failed';
        diagnosis.error = testResult.error;
      }
    } catch (error) {
      diagnosis.problem = 'Unexpected error';
      diagnosis.error = error.message;
    }

    return diagnosis;
  }

  // ============= Utility Functions =============

  /**
   * Format phone number for WhatsApp
   * @param {string} phone - Phone number
   */
  formatPhone(phone) {
    let cleanPhone = phone.replace(/\D/g, '');

    // Add country code if missing
    if (!cleanPhone.startsWith('7') && cleanPhone.length === 10) {
      cleanPhone = '7' + cleanPhone;
    }

    return cleanPhone;
  }

  /**
   * Validate phone number
   * @param {string} phone - Phone number
   */
  isValidPhone(phone) {
    const cleaned = this.formatPhone(phone);
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  /**
   * Get provider name
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Shutdown manager
   */
  async shutdown() {
    logger.info('Shutting down WhatsApp Manager...');

    if (this.isInitialized) {
      await this.sessionManager.shutdown();
    }

    this.isInitialized = false;
    logger.info('WhatsApp Manager shut down');
  }
}

// Export singleton instance
module.exports = new WhatsAppManager();