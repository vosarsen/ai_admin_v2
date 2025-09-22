// src/integrations/whatsapp/client.js
const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');
const { CircuitBreakerFactory: circuitBreakerFactory } = require('../../utils/circuit-breaker');

/**
 * WhatsApp Client for Baileys Integration
 *
 * This client communicates directly with baileys-service running on port 3003.
 * It maintains backward compatibility with the old Venom-based client interface
 * while using the new Baileys backend.
 *
 * Architecture:
 * [Services] -> [WhatsApp Client] -> [Baileys Service :3003] -> [WhatsApp]
 *
 * @class WhatsAppClient
 */
class WhatsAppClient {
  constructor() {
    // Baileys service configuration
    // In production, baileys-service runs on localhost:3003
    this.baseUrl = process.env.BAILEYS_SERVICE_URL || 'http://localhost:3003';

    // Timeout and retry configuration (keeping these for reliability)
    this.timeout = config.whatsapp?.timeout || 30000;
    this.retries = config.whatsapp?.retries || 3;

    // Initialize circuit breaker for fault tolerance
    // This prevents cascading failures if Baileys service is temporarily down
    this.circuitBreaker = circuitBreakerFactory.getBreaker('whatsapp', {
      timeout: this.timeout,
      failureThreshold: 5,
      resetTimeout: 60000 // 1 minute
    });

    // Create axios instance for HTTP requests
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => {
        logger.debug('Baileys API response:', {
          status: response.status,
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      error => {
        logger.error('Baileys API error:', {
          message: error?.message,
          code: error?.code,
          status: error?.response?.status,
          data: error?.response?.data,
          url: error?.config?.url
        });
        return Promise.reject(error);
      }
    );

    logger.info('✅ WhatsApp Client initialized for Baileys', {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      retries: this.retries
    });
  }

  /**
   * Send text message via WhatsApp
   *
   * @param {string} phone - Recipient phone number
   * @param {string} message - Message text
   * @param {object} options - Additional options (for future extensions)
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async sendMessage(phone, message, options = {}) {
    // Format phone number for WhatsApp
    const formattedPhone = this._formatPhone(phone);
    const cleanPhone = this._extractPhoneNumber(formattedPhone);

    try {
      logger.info(`📱 Sending message to ${this._sanitizePhone(cleanPhone)}`, {
        messageLength: message.length,
        messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : '')
      });

      // Execute request with circuit breaker protection
      const response = await this.circuitBreaker.execute(async () => {
        return await this._retryRequest(async () => {
          // Baileys expects { phone, message } format
          const requestData = {
            phone: cleanPhone,
            message: message
          };

          logger.debug(`📤 Request to Baileys:`, {
            endpoint: '/send',
            phone: this._sanitizePhone(cleanPhone)
          });

          // Send to Baileys service
          const result = await this.client.post('/send', requestData);
          return result;
        });
      });

      logger.info(`✅ Message sent to ${this._sanitizePhone(cleanPhone)}`, {
        messageId: response.data?.messageId
      });

      // Return in backward-compatible format
      return {
        success: true,
        data: {
          messageId: response.data?.messageId,
          phone: response.data?.phone,
          companyId: response.data?.companyId
        }
      };

    } catch (error) {
      logger.error(`❌ Failed to send message to ${this._sanitizePhone(cleanPhone)}:`, {
        error: error?.message,
        code: error?.code
      });

      // Handle circuit breaker open state
      if (error?.code === 'CIRCUIT_OPEN') {
        logger.warn('WhatsApp circuit breaker is open, service temporarily unavailable');
        return {
          success: false,
          error: 'WhatsApp service temporarily unavailable. Please try again later.'
        };
      }

      // Return error in backward-compatible format
      return {
        success: false,
        error: error?.message || 'Failed to send message'
      };
    }
  }

  /**
   * Send reaction emoji to a message
   * Note: Simplified implementation - sends emoji as regular message
   * Can be enhanced when Baileys supports native reactions
   *
   * @param {string} phone - Recipient phone number
   * @param {string} emoji - Emoji to send (default: ❤️)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendReaction(phone, emoji = '❤️') {
    try {
      logger.info(`💫 Sending reaction ${emoji} to ${this._sanitizePhone(phone)}`);

      // For now, send emoji as a regular message
      // This maintains backward compatibility
      const response = await this.sendMessage(phone, emoji);

      if (response.success) {
        logger.info(`💫 Reaction sent successfully`);
      }

      return response;
    } catch (error) {
      logger.error(`Failed to send reaction:`, error);
      return {
        success: false,
        error: error?.message || 'Failed to send reaction'
      };
    }
  }

  /**
   * Send file via WhatsApp
   * Note: Not implemented yet for Baileys
   * Placeholder for future enhancement
   *
   * @param {string} phone - Recipient phone number
   * @param {string} fileUrl - URL of the file to send
   * @param {string} caption - Optional caption for the file
   * @returns {Promise<{success: boolean, error: string}>}
   */
  async sendFile(phone, fileUrl, caption = '') {
    logger.warn('sendFile not implemented for Baileys yet');
    return {
      success: false,
      error: 'File sending not implemented in Baileys integration yet'
    };
  }

  /**
   * Check WhatsApp connection status
   *
   * @returns {Promise<{success: boolean, connected: boolean, error?: string}>}
   */
  async checkStatus() {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.get('/health');
      });

      return {
        success: true,
        connected: response.data?.connected || true,
        sessions: response.data?.sessions,
        metrics: response.data?.metrics
      };
    } catch (error) {
      if (error?.code === 'CIRCUIT_OPEN') {
        logger.warn('WhatsApp circuit breaker is open');
        return {
          success: false,
          connected: false,
          circuitOpen: true
        };
      }

      logger.error('Failed to check WhatsApp status:', error);
      return {
        success: false,
        connected: false,
        error: error?.message
      };
    }
  }

  /**
   * Send typing indicator
   * Note: Not implemented for Baileys yet
   *
   * @param {string} phone - Recipient phone number
   * @param {number} duration - Duration in milliseconds
   * @returns {Promise<void>}
   */
  async sendTyping(phone, duration = 3000) {
    // Baileys doesn't expose typing indicator API yet
    // This is a no-op for backward compatibility
    logger.debug(`⌨️ Typing indicator requested for ${this._sanitizePhone(phone)} (not implemented)`);
  }

  /**
   * Diagnose connection issues
   * Useful for debugging
   *
   * @param {string} phone - Test phone number
   * @returns {Promise<{success: boolean, diagnosis: string}>}
   */
  async diagnoseProblem(phone) {
    const formattedPhone = this._formatPhone(phone);
    const cleanPhone = this._extractPhoneNumber(formattedPhone);

    logger.info(`🔍 Diagnosing WhatsApp connection for ${this._sanitizePhone(cleanPhone)}`);

    try {
      // Check health status
      const healthResult = await this.client.get('/health');
      logger.info('📊 Health check result:', healthResult.data);

      // Try sending a test message
      const testResult = await this.client.post('/send', {
        phone: cleanPhone,
        message: '🔍 Test message from diagnostic tool'
      });
      logger.info('📱 Test message result:', testResult.data);

      return {
        success: true,
        diagnosis: 'Connection healthy',
        details: {
          health: healthResult.data,
          testMessage: testResult.data
        }
      };
    } catch (error) {
      logger.error('🔍 Diagnosis error:', {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status
      });

      let diagnosis = 'Unknown error';

      if (error?.code === 'ECONNREFUSED') {
        diagnosis = 'Baileys service is not running on port 3003';
      } else if (error?.code === 'ENOTFOUND') {
        diagnosis = 'Cannot resolve Baileys service hostname';
      } else if (error?.code === 'ECONNABORTED') {
        diagnosis = 'Request timeout - Baileys service is too slow';
      } else if (error?.response?.status === 503) {
        diagnosis = 'Baileys service is unavailable';
      } else if (error?.response?.status === 500) {
        diagnosis = 'Internal error in Baileys service';
      }

      return {
        success: false,
        diagnosis,
        error: error?.message,
        details: {
          code: error?.code,
          status: error?.response?.status,
          data: error?.response?.data
        }
      };
    }
  }

  /**
   * Format phone number for WhatsApp
   * Handles various input formats and ensures proper WhatsApp format
   *
   * @param {string} phone - Input phone number
   * @returns {string} Formatted phone number
   */
  _formatPhone(phone) {
    if (!phone) return '';

    // Remove any non-digit characters except @
    let cleanPhone = phone.replace(/[^\d@]/g, '');

    // If already in WhatsApp format (@c.us or @s.whatsapp.net), return as is
    if (cleanPhone.includes('@')) {
      return cleanPhone;
    }

    // Ensure the phone starts with country code
    // For Russian numbers, add 7 if not present
    if (cleanPhone.length === 10 && cleanPhone.startsWith('9')) {
      cleanPhone = '7' + cleanPhone;
    }

    // Add WhatsApp suffix for compatibility with old code
    return `${cleanPhone}@c.us`;
  }

  /**
   * Extract clean phone number from WhatsApp format
   *
   * @param {string} formattedPhone - Phone in WhatsApp format
   * @returns {string} Clean phone number
   */
  _extractPhoneNumber(formattedPhone) {
    if (!formattedPhone) return '';

    // Remove WhatsApp suffixes
    return formattedPhone
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '')
      .replace(/[^\d]/g, '');
  }

  /**
   * Sanitize phone number for logging (hide middle digits)
   *
   * @param {string} phone - Phone number
   * @returns {string} Sanitized phone number
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
   * Retry request with exponential backoff
   * Provides resilience against temporary failures
   *
   * @param {Function} requestFn - Function that performs the request
   * @returns {Promise<any>} Request result
   */
  async _retryRequest(requestFn) {
    let lastError;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        logger.debug(`Attempt ${attempt + 1}/${this.retries}`);
        const result = await requestFn();
        logger.debug(`✅ Request successful on attempt ${attempt + 1}`);
        return result;
      } catch (error) {
        lastError = error;

        logger.warn(`❌ Request failed on attempt ${attempt + 1}:`, {
          error: error?.message,
          code: error?.code
        });

        // Don't retry on client errors (4xx)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          logger.warn('Client error detected, not retrying');
          throw error;
        }

        // Exponential backoff for retries
        if (attempt < this.retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          logger.info(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('All retry attempts exhausted');
    throw lastError;
  }
}

// Export singleton instance for backward compatibility
module.exports = new WhatsAppClient();