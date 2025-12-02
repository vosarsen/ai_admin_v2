/**
 * Result Type - Standardized response wrapper for service methods
 *
 * Provides consistent success/error handling across the codebase.
 * Inspired by Rust's Result type and functional programming patterns.
 *
 * Usage:
 * ```javascript
 * const { Result } = require('./result');
 *
 * // Success case
 * return Result.ok(data);
 *
 * // Error case
 * return Result.fail('Error message', 'ERROR_CODE');
 *
 * // In route handler
 * const result = await someService.doSomething();
 * if (!result.success) {
 *   return res.status(result.httpStatus || 500).json(result.toJSON());
 * }
 * res.json(result.toJSON());
 * ```
 *
 * @module utils/result
 */

/**
 * Standard error codes for marketplace operations
 */
const ErrorCodes = {
  // Authentication & Authorization (4xx)
  UNAUTHORIZED: { code: 'UNAUTHORIZED', httpStatus: 401, message: 'Authentication required' },
  FORBIDDEN: { code: 'FORBIDDEN', httpStatus: 403, message: 'Access denied' },
  INVALID_TOKEN: { code: 'INVALID_TOKEN', httpStatus: 401, message: 'Invalid or expired token' },

  // Validation (400)
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', httpStatus: 400, message: 'Validation failed' },
  INVALID_INPUT: { code: 'INVALID_INPUT', httpStatus: 400, message: 'Invalid input data' },
  MISSING_PARAMETER: { code: 'MISSING_PARAMETER', httpStatus: 400, message: 'Required parameter missing' },

  // Resource errors (404, 409)
  NOT_FOUND: { code: 'NOT_FOUND', httpStatus: 404, message: 'Resource not found' },
  ALREADY_EXISTS: { code: 'ALREADY_EXISTS', httpStatus: 409, message: 'Resource already exists' },
  CONFLICT: { code: 'CONFLICT', httpStatus: 409, message: 'Operation conflict' },
  CONCURRENT_OPERATION: { code: 'CONCURRENT_OPERATION', httpStatus: 409, message: 'Concurrent operation in progress' },

  // External service errors (502, 503)
  EXTERNAL_SERVICE_ERROR: { code: 'EXTERNAL_SERVICE_ERROR', httpStatus: 502, message: 'External service error' },
  YCLIENTS_API_ERROR: { code: 'YCLIENTS_API_ERROR', httpStatus: 502, message: 'YClients API error' },
  WHATSAPP_ERROR: { code: 'WHATSAPP_ERROR', httpStatus: 502, message: 'WhatsApp service error' },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', httpStatus: 503, message: 'Service temporarily unavailable' },
  CIRCUIT_OPEN: { code: 'CIRCUIT_OPEN', httpStatus: 503, message: 'Service circuit breaker is open' },

  // Rate limiting (429)
  RATE_LIMITED: { code: 'RATE_LIMITED', httpStatus: 429, message: 'Too many requests' },

  // Internal errors (500)
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', httpStatus: 500, message: 'Internal server error' },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', httpStatus: 500, message: 'Database operation failed' },

  // Business logic errors (422)
  BUSINESS_ERROR: { code: 'BUSINESS_ERROR', httpStatus: 422, message: 'Business rule violation' },
  SALON_NOT_ACTIVE: { code: 'SALON_NOT_ACTIVE', httpStatus: 422, message: 'Salon is not active' },
  SUBSCRIPTION_EXPIRED: { code: 'SUBSCRIPTION_EXPIRED', httpStatus: 422, message: 'Subscription has expired' }
};

class Result {
  /**
   * @param {boolean} success - Whether the operation succeeded
   * @param {*} data - The result data (if success)
   * @param {string|null} error - Error message (if failure)
   * @param {string|null} code - Error code (if failure)
   * @param {number} httpStatus - HTTP status code
   * @param {Object} meta - Additional metadata
   */
  constructor(success, data = null, error = null, code = null, httpStatus = 200, meta = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.code = code;
    this.httpStatus = httpStatus;
    this.meta = meta;
  }

  /**
   * Create a successful result
   * @param {*} data - The result data
   * @param {Object} meta - Optional metadata
   * @returns {Result}
   */
  static ok(data = null, meta = {}) {
    return new Result(true, data, null, null, 200, meta);
  }

  /**
   * Create a failure result
   * @param {string} error - Error message
   * @param {string|Object} codeOrErrorDef - Error code string or ErrorCodes definition
   * @param {Object} meta - Optional metadata (e.g., { retry_after: 5 })
   * @returns {Result}
   */
  static fail(error, codeOrErrorDef = 'INTERNAL_ERROR', meta = {}) {
    let code, httpStatus;

    if (typeof codeOrErrorDef === 'object' && codeOrErrorDef.code) {
      // ErrorCodes definition passed
      code = codeOrErrorDef.code;
      httpStatus = codeOrErrorDef.httpStatus || 500;
      error = error || codeOrErrorDef.message;
    } else if (typeof codeOrErrorDef === 'string') {
      // String code passed, try to find in ErrorCodes
      const errorDef = ErrorCodes[codeOrErrorDef];
      if (errorDef) {
        code = errorDef.code;
        httpStatus = errorDef.httpStatus;
        error = error || errorDef.message;
      } else {
        code = codeOrErrorDef;
        httpStatus = 500;
      }
    } else {
      code = 'INTERNAL_ERROR';
      httpStatus = 500;
    }

    return new Result(false, null, error, code, httpStatus, meta);
  }

  /**
   * Create a failure from an Error object
   * @param {Error} err - Error object
   * @param {string} code - Error code (default: INTERNAL_ERROR)
   * @returns {Result}
   */
  static fromError(err, code = 'INTERNAL_ERROR') {
    const message = err.message || 'An unexpected error occurred';
    return Result.fail(message, code, { originalError: err.name });
  }

  /**
   * Check if result is successful
   * @returns {boolean}
   */
  isOk() {
    return this.success === true;
  }

  /**
   * Check if result is a failure
   * @returns {boolean}
   */
  isFail() {
    return this.success === false;
  }

  /**
   * Convert to JSON for API response
   * @returns {Object}
   */
  toJSON() {
    const json = {
      success: this.success
    };

    if (this.success) {
      if (this.data !== null) {
        json.data = this.data;
      }
    } else {
      json.error = this.error;
      json.code = this.code;
    }

    // Add meta fields to response (e.g., retry_after, pagination)
    if (Object.keys(this.meta).length > 0) {
      Object.assign(json, this.meta);
    }

    return json;
  }

  /**
   * Send result as Express response
   * @param {Object} res - Express response object
   * @returns {Object} - Express response
   */
  send(res) {
    return res.status(this.httpStatus).json(this.toJSON());
  }

  /**
   * Map successful data to new value
   * @param {Function} fn - Transform function
   * @returns {Result}
   */
  map(fn) {
    if (this.success) {
      return Result.ok(fn(this.data), this.meta);
    }
    return this;
  }

  /**
   * Chain another operation if successful
   * @param {Function} fn - Function that returns a Result
   * @returns {Result}
   */
  flatMap(fn) {
    if (this.success) {
      return fn(this.data);
    }
    return this;
  }

  /**
   * Get data or throw error
   * @returns {*} - The data
   * @throws {Error} - If result is a failure
   */
  unwrap() {
    if (this.success) {
      return this.data;
    }
    throw new Error(`Result.unwrap() called on failure: ${this.error} (${this.code})`);
  }

  /**
   * Get data or return default value
   * @param {*} defaultValue - Default value if failure
   * @returns {*}
   */
  unwrapOr(defaultValue) {
    return this.success ? this.data : defaultValue;
  }
}

module.exports = {
  Result,
  ErrorCodes
};
