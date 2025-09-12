// src/integrations/whatsapp/api-client.js
const axios = require('axios');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * WhatsApp API Client - sends messages through API endpoint
 * This client is used by workers to avoid direct WhatsApp connection
 */
class WhatsAppAPIClient {
  constructor() {
    this.apiUrl = `http://localhost:${config.app.port || 3000}`;
    this.initialized = true;
  }

  /**
   * Initialize (no-op for API client)
   */
  async initialize() {
    logger.info('✅ WhatsApp API client initialized (using API endpoint)');
    return true;
  }

  /**
   * Check status (always returns connected for API client)
   */
  async checkStatus() {
    return {
      connected: true,
      provider: 'baileys-api',
      mode: 'api-proxy'
    };
  }

  /**
   * Send message through API endpoint
   */
  async sendMessage(to, message, options = {}) {
    try {
      const phone = to.replace(/\D/g, '');
      const companyId = options.companyId || config.yclients.companyId || '962302';
      
      logger.info(`📤 Sending message via API to ${phone} for company ${companyId}`);
      
      const response = await axios.post(
        `${this.apiUrl}/api/whatsapp/sessions/${companyId}/send`,
        {
          phone,
          message
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 seconds timeout
        }
      );

      if (response.data.success) {
        logger.info(`✅ Message sent successfully via API`);
        return {
          success: true,
          messageId: response.data.result?.messageId
        };
      } else {
        throw new Error(response.data.error || 'Failed to send message');
      }
    } catch (error) {
      logger.error('Failed to send message via API:', error.message);
      
      // If API call fails, return error but don't crash
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send media (delegates to sendMessage for now)
   */
  async sendMedia(to, mediaUrl, caption = '') {
    // For now, just send caption as text
    // TODO: Implement media sending through API
    return this.sendMessage(to, caption || '[Media]');
  }

  /**
   * Send reaction via API
   */
  async sendReaction(to, emoji, messageId, companyId) {
    if (!messageId) {
      logger.warn('Cannot send reaction without messageId');
      return { success: false, error: 'messageId is required for reactions' };
    }
    
    if (!companyId) {
      logger.warn('Cannot send reaction without companyId');
      return { success: false, error: 'companyId is required for reactions' };
    }
    
    try {
      const response = await axios.post(
        `${this.apiUrl}/api/whatsapp/reaction`,
        {
          to,
          emoji,
          messageId,
          companyId: String(companyId)
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info(`✅ Reaction sent via API to ${to}`);
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('Failed to send reaction via API:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect (no-op for API client)
   */
  async disconnect() {
    logger.info('WhatsApp API client disconnected');
    return true;
  }
}

module.exports = WhatsAppAPIClient;