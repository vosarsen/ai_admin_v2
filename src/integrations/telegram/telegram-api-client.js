/**
 * Telegram API Client for Workers
 *
 * HTTP client for sending Telegram messages from worker processes.
 * Similar to WhatsApp API client pattern - workers don't have direct
 * access to the bot, so they communicate via HTTP.
 *
 * In standalone mode, the Telegram bot runs as separate service.
 * Workers use this client to send messages.
 */

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'telegram-api-client' });

class TelegramApiClient {
  constructor() {
    this.baseUrl = process.env.TELEGRAM_API_URL || `http://localhost:${config.app.port}`;
    this.timeout = 30000;

    // Axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey || process.env.API_KEY || ''
      }
    });
  }

  /**
   * Send message via Telegram
   *
   * @param {number} companyId - Company ID
   * @param {number} chatId - Telegram chat ID
   * @param {string} message - Message text
   * @param {Object} options - Additional options
   */
  async sendMessage(companyId, chatId, message, options = {}) {
    try {
      logger.debug('Sending Telegram message via API:', { companyId, chatId });

      const response = await this.client.post('/api/telegram/send', {
        companyId,
        chatId,
        message,
        withTyping: options.withTyping !== false // Default true for natural UX
      });

      if (response.data.success) {
        logger.info('Telegram message sent successfully:', {
          companyId,
          chatId,
          messageId: response.data.messageId
        });
      }

      return response.data;

    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      logger.error('Failed to send Telegram message:', {
        companyId,
        chatId,
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Send message with typing indicator
   * Wrapper for sendMessage with withTyping=true
   */
  async sendWithTyping(companyId, chatId, message, delayMs = 1500) {
    return this.sendMessage(companyId, chatId, message, {
      withTyping: true,
      typingDelay: delayMs
    });
  }

  /**
   * Get connection status for a company
   */
  async getConnectionStatus(companyId) {
    try {
      const response = await this.client.get(`/api/telegram/status/${companyId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Telegram status:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if Telegram is available for a company
   */
  async canSendVia(companyId) {
    try {
      const status = await this.getConnectionStatus(companyId);
      return status.success && status.telegram?.connected && status.telegram?.canReply;
    } catch (error) {
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/api/telegram/health');
      return response.data;
    } catch (error) {
      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new TelegramApiClient();
