/**
 * Telegram API Client for Workers
 *
 * HTTP client for sending Telegram messages from worker processes.
 * Similar to WhatsApp API client pattern - workers don't have direct
 * access to the bot, so they communicate via HTTP.
 *
 * Features:
 * - Retry logic with exponential backoff
 * - Rate limiting integration
 * - Sentry error tracking
 */

const axios = require('axios');
const Sentry = require('@sentry/node');
const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'telegram-api-client' });
const { TelegramErrorHandler, TelegramRateLimitError } = require('../../utils/telegram-errors');
const rateLimiter = require('./telegram-rate-limiter');

class TelegramApiClient {
  constructor() {
    this.baseUrl = process.env.TELEGRAM_API_URL || `http://localhost:${config.app.port}`;
    this.timeout = 30000;

    // Retry configuration
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second

    // Axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey || process.env.API_KEY || ''
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => this.handleAxiosError(error)
    );
  }

  /**
   * Handle Axios errors and convert to standardized errors
   */
  handleAxiosError(error) {
    const context = {
      method: error.config?.method,
      url: error.config?.url
    };

    // Network error
    if (!error.response) {
      const standardError = TelegramErrorHandler.standardize(error, context);
      return Promise.reject(standardError);
    }

    // API error with response
    const { status, data } = error.response;

    // Rate limit from server
    if (status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
      const rateLimitError = new TelegramRateLimitError(
        data?.error || 'Rate limited by server',
        retryAfter,
        context
      );
      return Promise.reject(rateLimitError);
    }

    // Other errors
    const standardError = TelegramErrorHandler.standardize(
      new Error(data?.error || `HTTP ${status}`),
      { ...context, statusCode: status }
    );

    return Promise.reject(standardError);
  }

  /**
   * Execute request with retry logic
   */
  async executeWithRetry(operation, options = {}) {
    const { maxRetries = this.maxRetries, context = {} } = options;

    return TelegramErrorHandler.retry(
      operation,
      {
        maxAttempts: maxRetries,
        context,
        onError: (error, attempt) => {
          logger.warn('Request failed, retrying...', {
            attempt,
            maxRetries,
            error: error.message,
            isRetryable: error.isRetryable
          });
        }
      }
    );
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
    const context = { companyId, chatId };

    try {
      // Check rate limit before sending
      if (options.checkRateLimit !== false) {
        try {
          rateLimiter.acquire(chatId);
        } catch (rateLimitError) {
          if (rateLimitError instanceof TelegramRateLimitError) {
            // Wait for slot if configured
            if (options.waitForSlot) {
              const acquired = await rateLimiter.waitForSlot(chatId, options.maxWait || 5000);
              if (!acquired) {
                logger.error('Rate limit timeout waiting for slot', { companyId, chatId });
                return {
                  success: false,
                  error: 'Rate limit timeout',
                  code: 'TELEGRAM_RATE_LIMIT',
                  isRetryable: true
                };
              }
            } else {
              // Return rate limit error without throwing
              return {
                success: false,
                error: rateLimitError.message,
                code: rateLimitError.code,
                retryAfter: rateLimitError.retryAfter,
                isRetryable: true
              };
            }
          } else {
            throw rateLimitError;
          }
        }
      }

      logger.debug('Sending Telegram message via API:', { companyId, chatId });

      const response = await this.executeWithRetry(
        () => this.client.post('/api/telegram/send', {
          companyId,
          chatId,
          message,
          withTyping: options.withTyping !== false // Default true for natural UX
        }),
        { context }
      );

      if (response.data.success) {
        logger.info('Telegram message sent successfully:', {
          companyId,
          chatId,
          messageId: response.data.messageId
        });
      }

      return response.data;

    } catch (error) {
      const standardError = TelegramErrorHandler.standardize(error, context);

      logger.error('Failed to send Telegram message:', {
        companyId,
        chatId,
        error: standardError.message,
        code: standardError.code
      });

      // Capture to Sentry
      Sentry.captureException(standardError, {
        tags: TelegramErrorHandler.getSentryTags(standardError, context),
        extra: { messageLength: message?.length }
      });

      return {
        success: false,
        error: standardError.message,
        code: standardError.code,
        isRetryable: standardError.isRetryable
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
      const response = await this.executeWithRetry(
        () => this.client.get(`/api/telegram/status/${companyId}`),
        { context: { companyId } }
      );
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

  /**
   * Get rate limiter metrics
   */
  getRateLimiterMetrics() {
    return rateLimiter.getMetrics();
  }
}

// Export singleton instance
module.exports = new TelegramApiClient();
module.exports.TelegramApiClient = TelegramApiClient;
