// src/integrations/whatsapp/baileys-client.js
const sessionManager = require('./session-manager');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Baileys WhatsApp Client - Drop-in replacement for Venom client
 * Provides backward compatibility while using Baileys under the hood
 */
class BaileysWhatsAppClient {
  constructor() {
    this.sessionManager = sessionManager;
    this.defaultCompanyId = config.yclients?.companyId || process.env.YCLIENTS_COMPANY_ID || 'default';
    this.isInitialized = false;
  }

  /**
   * Initialize the client
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    await this.sessionManager.initialize();
    
    // Initialize default company session if configured
    if (this.defaultCompanyId) {
      try {
        await this.sessionManager.initializeCompanySession(this.defaultCompanyId);
      } catch (error) {
        logger.warn(`Failed to initialize default company session: ${error.message}`);
      }
    }

    this.isInitialized = true;
    logger.info('✅ Baileys WhatsApp client initialized');
  }

  /**
   * Send message (backward compatible with Venom client)
   * @param {string} phone - Phone number (can be in various formats)
   * @param {string} message - Message text
   * @param {Object} options - Additional options
   */
  async sendMessage(phone, message, options = {}) {
    // Ensure initialization
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Extract company ID from options or use default
    const companyId = options.companyId || this.defaultCompanyId;
    
    try {
      logger.info(`📱 Sending message via Baileys to ${this._sanitizePhone(phone)} for company ${companyId}`);
      
      // Send through session manager
      const result = await this.sessionManager.sendMessage(companyId, phone, message, options);
      
      logger.info(`✅ Message sent to ${this._sanitizePhone(phone)}`);
      return { 
        success: true, 
        data: result,
        messageId: result.messageId 
      };

    } catch (error) {
      logger.error(`Failed to send message to ${this._sanitizePhone(phone)}:`, error);
      
      // Check if it's a session issue
      if (error.message.includes('No active session')) {
        // Try to initialize session
        try {
          await this.sessionManager.initializeCompanySession(companyId);
          // Retry sending
          const result = await this.sessionManager.sendMessage(companyId, phone, message, options);
          return { success: true, data: result };
        } catch (retryError) {
          logger.error('Failed to initialize session and retry:', retryError);
        }
      }
      
      return { 
        success: false, 
        error: error.message || 'Failed to send message' 
      };
    }
  }

  /**
   * Send file via WhatsApp
   * @param {string} phone - Phone number
   * @param {string} fileUrl - URL or path to file
   * @param {string} caption - Optional caption
   */
  async sendFile(phone, fileUrl, caption = '') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const companyId = this.defaultCompanyId;
    
    try {
      // Determine media type from URL/extension
      const mediaType = this._getMediaType(fileUrl);
      
      const result = await this.sessionManager.sendMedia(companyId, phone, fileUrl, mediaType, caption);
      
      logger.info(`📎 File sent to ${this._sanitizePhone(phone)}`);
      return { success: true, data: result };

    } catch (error) {
      logger.error(`Failed to send file to ${this._sanitizePhone(phone)}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send reaction to a message
   * @param {string} phone - Phone number
   * @param {string} emoji - Reaction emoji
   */
  async sendReaction(phone, emoji = '❤️') {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // For backward compatibility, we'll send emoji as a message
    // since we don't have the original message ID in this interface
    return await this.sendMessage(phone, emoji);
  }

  /**
   * Send typing indicator
   * @param {string} phone - Phone number
   * @param {number} duration - Duration in milliseconds
   */
  async sendTyping(phone, duration = 3000) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const companyId = this.defaultCompanyId;
    
    try {
      const provider = this.sessionManager.provider;
      await provider.sendTyping(companyId, phone, duration);
      logger.debug(`⌨️ Typing indicator sent to ${this._sanitizePhone(phone)}`);
    } catch (error) {
      logger.warn('Failed to send typing indicator:', error.message);
    }
  }

  /**
   * Check WhatsApp connection status
   */
  async checkStatus() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const status = this.sessionManager.getSessionStatus(this.defaultCompanyId);
      
      return {
        success: true,
        connected: status.connected,
        status: status.status,
        user: status.user,
        qrCode: status.status === 'connecting' ? await this._tryGetQR() : null
      };

    } catch (error) {
      logger.error('Failed to check WhatsApp status:', error);
      return { 
        success: false, 
        connected: false,
        error: error.message 
      };
    }
  }

  /**
   * Get QR code for authentication
   */
  async getQRCode(companyId = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const targetCompanyId = companyId || this.defaultCompanyId;
    
    try {
      const qr = await this.sessionManager.getQRCode(targetCompanyId);
      return { success: true, qr };
    } catch (error) {
      logger.error('Failed to get QR code:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Diagnose connection problems (for debugging)
   */
  async diagnoseProblem(phone) {
    const companyId = this.defaultCompanyId;
    
    logger.info(`🔍 Diagnosing WhatsApp connection issues for ${this._sanitizePhone(phone)}`);
    
    try {
      const status = this.sessionManager.getSessionStatus(companyId);
      
      if (!status.connected) {
        return {
          success: false,
          diagnosis: 'Not connected to WhatsApp',
          status: status.status,
          solution: 'Scan QR code to authenticate'
        };
      }

      // Try sending a test message
      const testResult = await this.sendMessage(phone, '🔍 Test message');
      
      if (testResult.success) {
        return { 
          success: true, 
          diagnosis: 'Connection healthy',
          testMessageSent: true 
        };
      } else {
        return {
          success: false,
          diagnosis: 'Connected but unable to send messages',
          error: testResult.error
        };
      }

    } catch (error) {
      return {
        success: false,
        diagnosis: 'Connection check failed',
        error: error.message
      };
    }
  }

  /**
   * Initialize company session (multi-tenant support)
   * @param {string} companyId - Company identifier
   * @param {Object} config - Company-specific configuration
   */
  async initializeCompany(companyId, config = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.sessionManager.initializeCompanySession(companyId, config);
  }

  /**
   * Send message for specific company (multi-tenant)
   */
  async sendMessageForCompany(companyId, phone, message, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.sessionManager.sendMessage(companyId, phone, message, options);
  }

  /**
   * Get all active sessions (multi-tenant)
   */
  getAllSessions() {
    return this.sessionManager.getAllSessionsStatus();
  }

  /**
   * Disconnect specific company session
   */
  async disconnectCompany(companyId) {
    return await this.sessionManager.disconnectSession(companyId);
  }

  /**
   * Format phone number for WhatsApp
   */
  _formatPhone(phone) {
    // Remove all non-numeric characters
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming Russia)
    if (!cleanPhone.startsWith('7') && cleanPhone.length === 10) {
      cleanPhone = '7' + cleanPhone;
    }
    
    return cleanPhone;
  }

  /**
   * Sanitize phone for logs
   */
  _sanitizePhone(phone) {
    if (!phone) return 'unknown';
    const digits = phone.replace(/\D/g, '');
    if (digits.length > 6) {
      return `${digits.substring(0, 3)}****${digits.substring(digits.length - 2)}`;
    }
    return 'phone_****';
  }

  /**
   * Get media type from file URL/path
   */
  _getMediaType(fileUrl) {
    const extension = fileUrl.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return 'image';
    } else if (['mp4', 'avi', 'mov', 'webm'].includes(extension)) {
      return 'video';
    } else if (['mp3', 'ogg', 'wav', 'aac'].includes(extension)) {
      return 'audio';
    } else {
      return 'document';
    }
  }

  /**
   * Try to get QR code (internal helper)
   */
  async _tryGetQR() {
    try {
      const result = await this.getQRCode();
      return result.success ? result.qr : null;
    } catch {
      return null;
    }
  }

  /**
   * Retry request with exponential backoff (for compatibility)
   */
  async _retryRequest(requestFn, retries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

// Export singleton instance for backward compatibility
module.exports = new BaileysWhatsAppClient();