/**
 * Standardized WhatsApp Error Classes
 * Provides consistent error handling across the entire WhatsApp system
 */

/**
 * Base WhatsApp Error
 */
class WhatsAppError extends Error {
  constructor(message, code = 'WHATSAPP_ERROR', details = {}) {
    super(message);
    this.name = 'WhatsAppError';
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
 * Connection Error - Issues with WhatsApp connection
 */
class ConnectionError extends WhatsAppError {
  constructor(message, details = {}) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
    this.isRetryable = true;
  }
}

/**
 * Authentication Error - QR code, pairing code, session issues
 */
class AuthenticationError extends WhatsAppError {
  constructor(message, details = {}) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthenticationError';
    this.isRetryable = false;
  }
}

/**
 * Session Error - Session management issues
 */
class SessionError extends WhatsAppError {
  constructor(message, companyId, details = {}) {
    super(message, 'SESSION_ERROR', { companyId, ...details });
    this.name = 'SessionError';
    this.companyId = companyId;
    this.isRetryable = true;
  }
}

/**
 * Rate Limit Error - Too many requests
 */
class RateLimitError extends WhatsAppError {
  constructor(message, retryAfter = 60, details = {}) {
    super(message, 'RATE_LIMIT', { retryAfter, ...details });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.isRetryable = true;
  }
}

/**
 * Message Send Error - Failed to send message
 */
class MessageSendError extends WhatsAppError {
  constructor(message, phone, details = {}) {
    super(message, 'MESSAGE_SEND_ERROR', { phone, ...details });
    this.name = 'MessageSendError';
    this.phone = phone;
    this.isRetryable = true;
  }
}

/**
 * Validation Error - Invalid input data
 */
class ValidationError extends WhatsAppError {
  constructor(message, field, details = {}) {
    super(message, 'VALIDATION_ERROR', { field, ...details });
    this.name = 'ValidationError';
    this.field = field;
    this.isRetryable = false;
  }
}

/**
 * Configuration Error - Missing or invalid configuration
 */
class ConfigurationError extends WhatsAppError {
  constructor(message, configKey, details = {}) {
    super(message, 'CONFIG_ERROR', { configKey, ...details });
    this.name = 'ConfigurationError';
    this.configKey = configKey;
    this.isRetryable = false;
    this.isOperational = false; // System error
  }
}

/**
 * Timeout Error - Operation timed out
 */
class TimeoutError extends WhatsAppError {
  constructor(message, operation, timeoutMs, details = {}) {
    super(message, 'TIMEOUT_ERROR', { operation, timeoutMs, ...details });
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
    this.isRetryable = true;
  }
}

/**
 * Provider Error - Provider-specific issues
 */
class ProviderError extends WhatsAppError {
  constructor(message, provider, originalError, details = {}) {
    super(message, 'PROVIDER_ERROR', { provider, originalError: originalError?.message, ...details });
    this.name = 'ProviderError';
    this.provider = provider;
    this.originalError = originalError;
    this.isRetryable = true;
  }
}

/**
 * Database Error - Database operation failed
 */
class DatabaseError extends WhatsAppError {
  constructor(message, operation, details = {}) {
    super(message, 'DATABASE_ERROR', { operation, ...details });
    this.name = 'DatabaseError';
    this.operation = operation;
    this.isRetryable = true;
  }
}

/**
 * QR Code Error - QR code generation/scanning issues
 */
class QRCodeError extends WhatsAppError {
  constructor(message, companyId, attempts, details = {}) {
    super(message, 'QR_CODE_ERROR', { companyId, attempts, ...details });
    this.name = 'QRCodeError';
    this.companyId = companyId;
    this.attempts = attempts;
    this.isRetryable = attempts < 3;
  }
}

/**
 * Pairing Code Error - Pairing code issues
 */
class PairingCodeError extends WhatsAppError {
  constructor(message, phoneNumber, details = {}) {
    super(message, 'PAIRING_CODE_ERROR', { phoneNumber, ...details });
    this.name = 'PairingCodeError';
    this.phoneNumber = phoneNumber;
    this.isRetryable = false;
  }
}

/**
 * Error Handler Utility
 */
class ErrorHandler {
  /**
   * Wrap async function with error handling
   */
  static wrap(fn, errorMapper) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (errorMapper) {
          throw errorMapper(error);
        }
        throw this.standardize(error);
      }
    };
  }

  /**
   * Standardize any error to WhatsApp error
   */
  static standardize(error) {
    // Already a WhatsApp error
    if (error instanceof WhatsAppError) {
      return error;
    }

    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new ConnectionError(error.message, { originalCode: error.code });
    }

    // Rate limit errors
    if (error.message?.includes('rate') || error.message?.includes('limit')) {
      return new RateLimitError(error.message);
    }

    // Auth errors
    if (error.message?.includes('auth') || error.message?.includes('login')) {
      return new AuthenticationError(error.message);
    }

    // Timeout errors
    if (error.message?.includes('timeout')) {
      return new TimeoutError(error.message, 'unknown', 0);
    }

    // Default to generic WhatsApp error
    return new WhatsAppError(error.message || 'Unknown error', 'UNKNOWN', {
      originalError: error.toString()
    });
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error) {
    if (error instanceof WhatsAppError) {
      return error.isRetryable;
    }
    // Network errors are usually retryable
    return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code);
  }

  /**
   * Get retry delay for error
   */
  static getRetryDelay(error, attempt = 1) {
    if (error instanceof RateLimitError) {
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
      logger.error('System error:', errorObj.toJSON());
    } else if (errorObj.isRetryable) {
      // Retryable - warning
      logger.warn('Retryable error:', errorObj.toJSON());
    } else {
      // Non-retryable operational - info
      logger.info('Operational error:', errorObj.toJSON());
    }
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
        ...(standardError instanceof RateLimitError && {
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
      shouldRetry = this.isRetryable
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.standardize(error);

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
}

module.exports = {
  // Error classes
  WhatsAppError,
  ConnectionError,
  AuthenticationError,
  SessionError,
  RateLimitError,
  MessageSendError,
  ValidationError,
  ConfigurationError,
  TimeoutError,
  ProviderError,
  DatabaseError,
  QRCodeError,
  PairingCodeError,

  // Utility
  ErrorHandler
};