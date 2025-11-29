/**
 * Standardized Telegram Error Classes
 * Provides consistent error handling across the entire Telegram integration
 *
 * Based on WhatsApp errors pattern for consistency
 */

/**
 * Base Telegram Error
 */
class TelegramError extends Error {
  constructor(message, code = 'TELEGRAM_ERROR', details = {}) {
    super(message);
    this.name = 'TelegramError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    this.isRetryable = false;
    this.isOperational = true;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      isRetryable: this.isRetryable,
      stack: this.stack
    };
  }
}

/**
 * Connection Error - Business Connection issues
 */
class TelegramConnectionError extends TelegramError {
  constructor(message, companyId, details = {}) {
    super(message, 'TELEGRAM_CONNECTION_ERROR', { companyId, ...details });
    this.name = 'TelegramConnectionError';
    this.companyId = companyId;
    this.isRetryable = true;
  }
}

/**
 * Message Error - Failed to send/receive message
 */
class TelegramMessageError extends TelegramError {
  constructor(message, chatId, details = {}) {
    super(message, 'TELEGRAM_MESSAGE_ERROR', { chatId, ...details });
    this.name = 'TelegramMessageError';
    this.chatId = chatId;
    this.isRetryable = true;
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 * Telegram limits: 1 msg/sec per user, 30 msg/sec globally
 */
class TelegramRateLimitError extends TelegramError {
  constructor(message, retryAfter = 60, details = {}) {
    super(message, 'TELEGRAM_RATE_LIMIT', { retryAfter, ...details });
    this.name = 'TelegramRateLimitError';
    this.retryAfter = retryAfter;
    this.isRetryable = true;
  }
}

/**
 * Bot Blocked Error - User blocked the bot (403 Forbidden)
 */
class TelegramBotBlockedError extends TelegramError {
  constructor(message, chatId, details = {}) {
    super(message, 'TELEGRAM_BOT_BLOCKED', { chatId, ...details });
    this.name = 'TelegramBotBlockedError';
    this.chatId = chatId;
    this.isRetryable = false;
  }
}

/**
 * Activity Window Error - 24-hour window expired
 * Business Bot can only reply to chats active in last 24 hours
 */
class TelegramActivityWindowError extends TelegramError {
  constructor(message, chatId, details = {}) {
    super(message, 'TELEGRAM_ACTIVITY_WINDOW', { chatId, ...details });
    this.name = 'TelegramActivityWindowError';
    this.chatId = chatId;
    this.isRetryable = false;
  }
}

/**
 * Webhook Error - Webhook configuration issues
 */
class TelegramWebhookError extends TelegramError {
  constructor(message, webhookUrl, details = {}) {
    super(message, 'TELEGRAM_WEBHOOK_ERROR', { webhookUrl, ...details });
    this.name = 'TelegramWebhookError';
    this.webhookUrl = webhookUrl;
    this.isRetryable = true;
  }
}

/**
 * Business Connection Not Found Error
 */
class TelegramConnectionNotFoundError extends TelegramError {
  constructor(message, companyId, details = {}) {
    super(message, 'TELEGRAM_CONNECTION_NOT_FOUND', { companyId, ...details });
    this.name = 'TelegramConnectionNotFoundError';
    this.companyId = companyId;
    this.isRetryable = false;
  }
}

/**
 * API Error - Telegram API returned an error
 */
class TelegramAPIError extends TelegramError {
  constructor(message, errorCode, method, details = {}) {
    super(message, 'TELEGRAM_API_ERROR', { errorCode, method, ...details });
    this.name = 'TelegramAPIError';
    this.errorCode = errorCode;
    this.method = method;
    // Retry for 5xx errors, not for 4xx
    this.isRetryable = errorCode >= 500;
  }
}

/**
 * Configuration Error - Missing or invalid configuration
 */
class TelegramConfigError extends TelegramError {
  constructor(message, configKey, details = {}) {
    super(message, 'TELEGRAM_CONFIG_ERROR', { configKey, ...details });
    this.name = 'TelegramConfigError';
    this.configKey = configKey;
    this.isRetryable = false;
    this.isOperational = false; // System error
  }
}

/**
 * Telegram Error Handler Utility
 */
class TelegramErrorHandler {
  /**
   * Map grammY errors to our custom errors
   * @param {Error} error - grammY error or other error
   * @param {object} context - Additional context (chatId, companyId, etc.)
   */
  static fromGrammyError(error, context = {}) {
    const { chatId, companyId, method } = context;

    // Already our error
    if (error instanceof TelegramError) {
      return error;
    }

    // GrammyError - Telegram API error
    if (error.name === 'GrammyError') {
      const errorCode = error.error_code;
      const description = error.description || error.message;

      // 403 - Forbidden (bot blocked or no permission)
      if (errorCode === 403) {
        if (description.includes('bot was blocked')) {
          return new TelegramBotBlockedError(
            `User blocked the bot: ${description}`,
            chatId,
            { originalError: description, method }
          );
        }
        return new TelegramConnectionError(
          `Access forbidden: ${description}`,
          companyId,
          { chatId, originalError: description, method }
        );
      }

      // 429 - Rate limit
      if (errorCode === 429) {
        const retryAfter = error.parameters?.retry_after || 60;
        return new TelegramRateLimitError(
          `Rate limited: ${description}`,
          retryAfter,
          { chatId, method }
        );
      }

      // 400 - Bad Request
      if (errorCode === 400) {
        // Activity window expired
        if (description.includes('BUSINESS_REPLY_FORBIDDEN') ||
            description.includes('can\'t reply')) {
          return new TelegramActivityWindowError(
            `24-hour activity window expired: ${description}`,
            chatId,
            { companyId, method }
          );
        }
        return new TelegramMessageError(
          `Bad request: ${description}`,
          chatId,
          { companyId, method, originalError: description }
        );
      }

      // Other API errors
      return new TelegramAPIError(
        description,
        errorCode,
        method || error.method,
        { chatId, companyId }
      );
    }

    // HttpError - Network error
    if (error.name === 'HttpError') {
      return new TelegramAPIError(
        error.message,
        error.status || 0,
        'http',
        { chatId, companyId, isNetworkError: true }
      );
    }

    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new TelegramConnectionError(
        `Network error: ${error.message}`,
        companyId,
        { originalCode: error.code, chatId }
      );
    }

    // Default to generic Telegram error
    return new TelegramError(error.message || 'Unknown Telegram error', 'UNKNOWN', {
      originalError: error.toString(),
      chatId,
      companyId
    });
  }

  /**
   * Standardize any error to Telegram error
   */
  static standardize(error, context = {}) {
    return this.fromGrammyError(error, context);
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error) {
    if (error instanceof TelegramError) {
      return error.isRetryable;
    }
    // Network errors are usually retryable
    return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code);
  }

  /**
   * Get retry delay for error
   */
  static getRetryDelay(error, attempt = 1) {
    if (error instanceof TelegramRateLimitError) {
      return error.retryAfter * 1000;
    }

    // Exponential backoff
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // Add jitter
    return delay + Math.random() * 1000;
  }

  /**
   * Log error with appropriate level
   */
  static log(error, logger) {
    const errorObj = this.standardize(error);

    if (!errorObj.isOperational) {
      // System error - critical
      logger.error('Telegram system error:', errorObj.toJSON());
    } else if (errorObj.isRetryable) {
      // Retryable - warning
      logger.warn('Telegram retryable error:', errorObj.toJSON());
    } else {
      // Non-retryable operational - info
      logger.info('Telegram operational error:', errorObj.toJSON());
    }

    return errorObj;
  }

  /**
   * Create error response for API
   */
  static toResponse(error) {
    const standardError = this.standardize(error);

    return {
      success: false,
      error: {
        code: standardError.code,
        message: standardError.message,
        details: standardError.details,
        isRetryable: standardError.isRetryable,
        ...(standardError instanceof TelegramRateLimitError && {
          retryAfter: standardError.retryAfter
        })
      }
    };
  }

  /**
   * Retry operation with error handling
   */
  static async retry(operation, options = {}) {
    const {
      maxAttempts = 3,
      onError = null,
      shouldRetry = (err) => this.isRetryable(err),
      context = {}
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.standardize(error, context);

        if (onError) {
          onError(lastError, attempt);
        }

        if (attempt < maxAttempts && shouldRetry(lastError)) {
          const delay = this.getRetryDelay(lastError, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Get Sentry tags for error
   */
  static getSentryTags(error, context = {}) {
    const standardError = this.standardize(error, context);

    return {
      'telegram.error_code': standardError.code,
      'telegram.error_name': standardError.name,
      'telegram.retryable': String(standardError.isRetryable),
      'telegram.operational': String(standardError.isOperational),
      ...(standardError.companyId && { 'telegram.company_id': String(standardError.companyId) }),
      ...(standardError.chatId && { 'telegram.chat_id': String(standardError.chatId) }),
      ...(standardError.errorCode && { 'telegram.api_error_code': String(standardError.errorCode) }),
      ...(standardError.method && { 'telegram.api_method': standardError.method })
    };
  }
}

module.exports = {
  // Error classes
  TelegramError,
  TelegramConnectionError,
  TelegramMessageError,
  TelegramRateLimitError,
  TelegramBotBlockedError,
  TelegramActivityWindowError,
  TelegramWebhookError,
  TelegramConnectionNotFoundError,
  TelegramAPIError,
  TelegramConfigError,

  // Utility
  TelegramErrorHandler
};
