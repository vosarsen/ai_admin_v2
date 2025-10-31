// src/utils/retry-handler.js
const logger = require('./logger');

class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.initialDelay = options.initialDelay || 1000;
    this.maxDelay = options.maxDelay || 10000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.retryableErrors = options.retryableErrors || [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
      'EPIPE',
      'ECONNRESET'
    ];
    this.retryableStatusCodes = options.retryableStatusCodes || [
      408, // Request Timeout
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504  // Gateway Timeout
    ];
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @param {string} operation - Operation name for logging
   * @param {Object} context - Additional context for logging
   * @returns {Promise<any>} - Result of function execution
   */
  async execute(fn, operation = 'operation', context = {}) {
    let lastError;
    let delay = this.initialDelay;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug(`Attempting ${operation} (attempt ${attempt}/${this.maxRetries})`, context);
        
        const result = await fn();
        
        if (attempt > 1) {
          logger.info(`${operation} succeeded after ${attempt} attempts`, context);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryable(error) || attempt === this.maxRetries) {
          logger.error(`${operation} failed permanently after ${attempt} attempts`, {
            ...context,
            error: error.message,
            code: error.code,
            statusCode: error.response?.status
          });
          throw error;
        }
        
        // Log retry attempt
        logger.warn(`${operation} failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms`, {
          ...context,
          error: error.message,
          code: error.code,
          statusCode: error.response?.status,
          nextDelay: delay
        });
        
        // Wait before retry
        await this.sleep(delay);
        
        // Calculate next delay with exponential backoff
        delay = Math.min(delay * this.backoffMultiplier, this.maxDelay);
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error) {
    // Check network errors
    if (error.code && this.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check HTTP status codes
    if (error.response?.status && this.retryableStatusCodes.includes(error.response.status)) {
      return true;
    }
    
    // Check specific error messages
    if (error.message) {
      const message = error.message.toLowerCase();
      if (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('econnrefused') ||
        message.includes('socket hang up')
      ) {
        return true;
      }
    }
    
    // Don't retry validation errors, auth errors, etc.
    if (error.response?.status >= 400 && error.response?.status < 500) {
      // Except for specific retryable 4xx errors
      return this.retryableStatusCodes.includes(error.response.status);
    }
    
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retryable version of a function
   */
  wrap(fn, operation, context) {
    return async (...args) => {
      return this.execute(
        () => fn(...args),
        operation,
        context
      );
    };
  }
}

// Create default instance
const defaultRetryHandler = new RetryHandler();

// Export both class and default instance
module.exports = {
  RetryHandler,
  retry: defaultRetryHandler
};