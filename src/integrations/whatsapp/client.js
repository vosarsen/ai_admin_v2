// src/integrations/whatsapp/client.js
const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');
const { CircuitBreakerFactory: circuitBreakerFactory } = require('../../utils/circuit-breaker');

// Constants for configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 60000; // 1 minute
const MAX_MESSAGE_LENGTH = 4096; // WhatsApp limit
const DEFAULT_COUNTRY_CODE = '7'; // Russia

/**
 * @typedef {Object} SendMessageResult
 * @property {boolean} success - Whether the operation was successful
 * @property {Object} [data] - Response data if successful
 * @property {string} [data.messageId] - Unique message identifier
 * @property {string} [data.phone] - Recipient phone number
 * @property {string} [data.companyId] - Company identifier
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} StatusResult
 * @property {boolean} success - Whether the check was successful
 * @property {boolean} connected - Whether WhatsApp is connected
 * @property {Object} [sessions] - Active sessions information
 * @property {Object} [metrics] - Service metrics
 * @property {boolean} [circuitOpen] - Whether circuit breaker is open
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} DiagnosisResult
 * @property {boolean} success - Whether diagnosis was successful
 * @property {string} diagnosis - Diagnosis message
 * @property {Object} [details] - Additional diagnostic details
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {string} service - Service name
 * @property {string} status - Current status
 * @property {Object} metrics - Service metrics
 * @property {Object} config - Current configuration
 * @property {string} [lastError] - Last error message
 * @property {Date} [lastErrorTime] - Last error timestamp
 */

/**
 * @typedef {Object} BulkMessage
 * @property {string} phone - Recipient phone number
 * @property {string} message - Message text
 * @property {Object} [options] - Additional options
 */

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
    // Configuration
    this.baseUrl = process.env.BAILEYS_SERVICE_URL || 'http://localhost:3003';
    this.timeout = config.whatsapp?.timeout || DEFAULT_TIMEOUT;
    this.retries = config.whatsapp?.retries || DEFAULT_RETRIES;
    this.defaultCountryCode = config.whatsapp?.defaultCountryCode || DEFAULT_COUNTRY_CODE;

    // Initialize metrics
    this.metrics = {
      messagesSent: 0,
      messagesFailed: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      lastError: null,
      lastErrorTime: null,
      circuitBreakerTrips: 0
    };

    // Initialize circuit breaker for fault tolerance
    this.circuitBreaker = circuitBreakerFactory.getBreaker('whatsapp', {
      timeout: this.timeout,
      failureThreshold: config.circuitBreaker?.failureThreshold || CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      resetTimeout: config.circuitBreaker?.resetTimeout || CIRCUIT_BREAKER_RESET_TIMEOUT
    });

    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Store interceptor IDs for cleanup
    this.responseInterceptorId = this.client.interceptors.response.use(
      response => {
        logger.debug('Baileys API response:', {
          status: response.status,
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      error => {
        this.recordError(error);
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
      retries: this.retries,
      defaultCountryCode: this.defaultCountryCode
    });
  }

  /**
   * Send text message via WhatsApp
   *
   * @param {string} phone - Recipient phone number
   * @param {string} message - Message text
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<SendMessageResult>}
   */
  async sendMessage(phone, message, options = {}) {
    // Input validation
    if (!phone || typeof phone !== 'string') {
      return {
        success: false,
        error: 'Phone number is required and must be a string'
      };
    }

    if (!message || typeof message !== 'string') {
      return {
        success: false,
        error: 'Message is required and must be a string'
      };
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return {
        success: false,
        error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters, got ${message.length})`
      };
    }

    // Format phone number
    const formattedPhone = this._formatPhone(phone);
    const cleanPhone = this._extractPhoneNumber(formattedPhone);

    const startTime = Date.now();

    try {
      logger.info(`📱 Sending message to ${this._sanitizePhone(cleanPhone)}`, {
        messageLength: message.length,
        messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        hasOptions: Object.keys(options).length > 0
      });

      // Execute request with circuit breaker protection
      const response = await this.circuitBreaker.execute(async () => {
        return await this._retryRequest(async () => {
          // Baileys expects { phone, message } format
          const requestData = {
            phone: cleanPhone,
            message: message,
            ...options // Include additional options
          };

          logger.debug(`📤 Request to Baileys:`, {
            endpoint: '/send',
            phone: this._sanitizePhone(cleanPhone),
            optionsKeys: Object.keys(options)
          });

          const result = await this.client.post('/send', requestData);
          return result;
        });
      });

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      logger.info(`✅ Message sent to ${this._sanitizePhone(cleanPhone)}`, {
        messageId: response.data?.messageId,
        responseTime: `${responseTime}ms`
      });

      // Return in backward-compatible format
      return {
        success: true,
        data: {
          messageId: response.data?.messageId,
          phone: response.data?.phone || cleanPhone,
          companyId: response.data?.companyId,
          responseTime
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);

      logger.error(`❌ Failed to send message to ${this._sanitizePhone(cleanPhone)}:`, {
        error: error?.message,
        code: error?.code,
        responseTime: `${responseTime}ms`
      });

      // Handle circuit breaker open state
      if (error?.code === 'CIRCUIT_OPEN') {
        this.metrics.circuitBreakerTrips++;
        logger.warn('WhatsApp circuit breaker is open, service temporarily unavailable');
        return {
          success: false,
          error: 'WhatsApp service temporarily unavailable. Please try again later.'
        };
      }

      // Return error with more context
      return {
        success: false,
        error: error?.message || error?.code || 'Failed to send message: Unknown error'
      };
    }
  }

  /**
   * Send bulk messages efficiently
   *
   * @param {BulkMessage[]} messages - Array of messages to send
   * @param {Object} [options={}] - Bulk sending options
   * @param {number} [options.concurrency=5] - Number of concurrent sends
   * @returns {Promise<Array>} Array of results
   */
  async sendBulkMessages(messages, options = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    const concurrency = options.concurrency || 5;
    const results = [];

    logger.info(`📦 Sending bulk messages`, {
      total: messages.length,
      concurrency
    });

    // Process messages in batches
    for (let i = 0; i < messages.length; i += concurrency) {
      const batch = messages.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(msg =>
          this.sendMessage(msg.phone, msg.message, msg.options)
        )
      );

      results.push(...batchResults.map((result, index) => ({
        ...result,
        phone: batch[index].phone,
        index: i + index
      })));
    }

    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    logger.info(`📦 Bulk send completed`, {
      total: messages.length,
      successful,
      failed: messages.length - successful
    });

    return results;
  }

  /**
   * Send reaction emoji to a message
   *
   * @param {string} phone - Recipient phone number
   * @param {string} [emoji='❤️'] - Emoji to send
   * @returns {Promise<SendMessageResult>}
   */
  async sendReaction(phone, emoji = '❤️') {
    try {
      logger.info(`💫 Sending reaction ${emoji} to ${this._sanitizePhone(phone)}`);

      // For now, send emoji as a regular message
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
   *
   * @param {string} phone - Recipient phone number
   * @param {string} fileUrl - URL of the file to send
   * @param {string} [caption=''] - Optional caption
   * @returns {Promise<SendMessageResult>}
   */
  async sendFile(phone, fileUrl, caption = '') {
    logger.warn('sendFile not implemented for Baileys yet');
    // TODO: Implement when Baileys service supports file sending
    return {
      success: false,
      error: 'File sending not implemented in Baileys integration yet'
    };
  }

  /**
   * Check WhatsApp connection status
   *
   * @returns {Promise<StatusResult>}
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
   * Get health check information
   *
   * @returns {HealthCheckResult}
   */
  getHealth() {
    const circuitState = this.circuitBreaker?.getState?.() || 'unknown';

    return {
      service: 'whatsapp-client',
      status: circuitState === 'CLOSED' ? 'healthy' : circuitState === 'OPEN' ? 'unhealthy' : 'degraded',
      metrics: {
        ...this.metrics,
        successRate: this.metrics.messagesSent > 0
          ? ((this.metrics.messagesSent / (this.metrics.messagesSent + this.metrics.messagesFailed)) * 100).toFixed(2) + '%'
          : '0%'
      },
      config: {
        baseUrl: this.baseUrl,
        timeout: this.timeout,
        retries: this.retries,
        circuitBreakerState: circuitState
      },
      lastError: this.metrics.lastError,
      lastErrorTime: this.metrics.lastErrorTime
    };
  }

  /**
   * Send typing indicator
   *
   * @param {string} phone - Recipient phone number
   * @param {number} [duration=3000] - Duration in milliseconds
   * @returns {Promise<void>}
   */
  async sendTyping(phone, duration = 3000) {
    // Baileys doesn't expose typing indicator API yet
    // This is a no-op for backward compatibility
    logger.debug(`⌨️ Typing indicator requested for ${this._sanitizePhone(phone)} (not implemented)`);
  }

  /**
   * Diagnose connection issues
   *
   * @param {string} phone - Test phone number
   * @returns {Promise<DiagnosisResult>}
   */
  async diagnoseProblem(phone) {
    const formattedPhone = this._formatPhone(phone);
    const cleanPhone = this._extractPhoneNumber(formattedPhone);

    logger.info(`🔍 Diagnosing WhatsApp connection for ${this._sanitizePhone(cleanPhone)}`);

    try {
      // Check health status with circuit breaker protection
      const healthResult = await this.circuitBreaker.execute(async () => {
        return await this.client.get('/health');
      });
      logger.info('📊 Health check result:', healthResult.data);

      // Try sending a test message with circuit breaker protection
      const testResult = await this.circuitBreaker.execute(async () => {
        return await this.client.post('/send', {
          phone: cleanPhone,
          message: '🔍 Test message from diagnostic tool'
        });
      });
      logger.info('📱 Test message result:', testResult.data);

      return {
        success: true,
        diagnosis: 'Connection healthy',
        details: {
          health: healthResult.data,
          testMessage: testResult.data,
          clientMetrics: this.getHealth()
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
      } else if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
        diagnosis = 'Request timeout - Baileys service is too slow';
      } else if (error?.code === 'CIRCUIT_OPEN') {
        diagnosis = 'Circuit breaker is open due to multiple failures';
      } else if (error?.response?.status === 503) {
        diagnosis = 'Baileys service is unavailable';
      } else if (error?.response?.status === 500) {
        diagnosis = 'Internal error in Baileys service';
      } else if (error?.response?.status >= 400 && error?.response?.status < 500) {
        diagnosis = `Client error: ${error?.response?.data?.error || 'Bad request'}`;
      }

      return {
        success: false,
        diagnosis,
        error: error?.message,
        details: {
          code: error?.code,
          status: error?.response?.status,
          data: error?.response?.data,
          clientMetrics: this.getHealth()
        }
      };
    }
  }

  /**
   * Format phone number for WhatsApp
   *
   * @private
   * @param {string} phone - Input phone number
   * @returns {string} Formatted phone number
   */
  _formatPhone(phone) {
    if (!phone) return '';

    // Remove any non-digit characters except @
    let cleanPhone = phone.replace(/[^\d@]/g, '');

    // If already in WhatsApp format, return as is
    if (cleanPhone.includes('@')) {
      logger.debug('📞 Phone already formatted:', {
        input: this._sanitizePhone(phone),
        format: cleanPhone.includes('@lid') ? 'LID' : cleanPhone.includes('@c.us') ? '@c.us' : '@s.whatsapp.net'
      });
      return cleanPhone;
    }

    // Check if this is a LID (WhatsApp internal ID)
    // LIDs are typically 15+ digits and don't start with country codes (1, 7, etc.)
    // Regular phone numbers are usually 10-13 digits
    if (cleanPhone.length >= 15) {
      // This is likely a LID, use @lid suffix
      const result = `${cleanPhone}@lid`;
      logger.debug('📞 Phone formatted as LID:', {
        input: this._sanitizePhone(phone),
        digitCount: cleanPhone.length,
        output: this._sanitizePhone(result),
        format: 'LID'
      });
      return result;
    }

    // Handle different country formats
    if (cleanPhone.length === 10) {
      // Assume local number without country code
      if (this.defaultCountryCode === '7' && cleanPhone.startsWith('9')) {
        // Russian mobile number
        cleanPhone = '7' + cleanPhone;
      } else if (this.defaultCountryCode === '1') {
        // US/Canada number
        cleanPhone = '1' + cleanPhone;
      } else {
        // Use configured default country code
        cleanPhone = this.defaultCountryCode + cleanPhone;
      }
    }

    // Add WhatsApp suffix for compatibility
    const result = `${cleanPhone}@c.us`;
    logger.debug('📞 Phone formatted as regular:', {
      input: this._sanitizePhone(phone),
      digitCount: cleanPhone.length,
      output: this._sanitizePhone(result),
      format: 'regular'
    });
    return result;
  }

  /**
   * Extract clean phone number from WhatsApp format
   *
   * @private
   * @param {string} formattedPhone - Phone in WhatsApp format
   * @returns {string} Clean phone number or LID with @lid suffix
   */
  _extractPhoneNumber(formattedPhone) {
    if (!formattedPhone) return '';

    // CRITICAL: Preserve @lid suffix for WhatsApp internal IDs (LIDs)
    // LIDs are used by WhatsApp for certain contacts and MUST be sent with @lid suffix
    // Example: "152926689472618@lid" must NOT be stripped to just digits
    if (formattedPhone.includes('@lid')) {
      // Return as-is, Baileys needs the @lid suffix to route correctly
      return formattedPhone;
    }

    // Remove WhatsApp suffixes for regular phone numbers
    return formattedPhone
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '')
      .replace(/[^\d]/g, '');
  }

  /**
   * Sanitize phone number for logging
   *
   * @private
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
   *
   * @private
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
          code: error?.code,
          status: error?.response?.status
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

  /**
   * Update metrics after operation
   *
   * @private
   * @param {boolean} success - Whether operation was successful
   * @param {number} responseTime - Response time in milliseconds
   */
  updateMetrics(success, responseTime) {
    if (success) {
      this.metrics.messagesSent++;
    } else {
      this.metrics.messagesFailed++;
    }

    this.metrics.totalResponseTime += responseTime;
    const totalMessages = this.metrics.messagesSent + this.metrics.messagesFailed;
    this.metrics.avgResponseTime = Math.round(this.metrics.totalResponseTime / totalMessages);
  }

  /**
   * Record error for metrics
   *
   * @private
   * @param {Error} error - Error to record
   */
  recordError(error) {
    this.metrics.lastError = error?.message || error?.code || 'Unknown error';
    this.metrics.lastErrorTime = new Date();
  }

  /**
   * Clean up resources (for proper shutdown)
   */
  destroy() {
    if (this.responseInterceptorId !== undefined) {
      this.client.interceptors.response.eject(this.responseInterceptorId);
    }

    if (this.circuitBreaker && typeof this.circuitBreaker.destroy === 'function') {
      this.circuitBreaker.destroy();
    }

    logger.info('WhatsApp Client destroyed');
  }
}

// Export singleton instance for backward compatibility
module.exports = new WhatsAppClient();