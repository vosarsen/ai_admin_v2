const logger = require('../../../utils/logger').child({ module: 'error-handler' });
const config = require('../config/modules-config');

/**
 * @typedef {Object} ErrorDetails
 * @property {string} [field] - Field name for validation errors
 * @property {*} [value] - Invalid value
 * @property {string} [service] - Service name for API errors
 * @property {number} [statusCode] - HTTP status code
 * @property {*} [response] - API response
 * @property {string} [operation] - Operation name
 * @property {string} [type] - Error type
 */

/**
 * @typedef {Object} ClassifiedError
 * @property {string} code - Error code
 * @property {string} type - Error type
 * @property {string} message - Error message
 * @property {ErrorDetails} [details] - Error details
 * @property {'critical' | 'high' | 'medium' | 'low'} severity - Error severity
 * @property {boolean} [needsRetry] - Whether error is retryable
 * @property {number} [retryAfter] - Retry delay in ms
 * @property {string} [userMessage] - User-friendly message
 */

/**
 * @typedef {Object} RetryConfig
 * @property {number} maxAttempts - Maximum retry attempts
 * @property {number} initialDelay - Initial delay in ms
 * @property {number} maxDelay - Maximum delay in ms
 * @property {number} backoffFactor - Exponential backoff factor
 */

/**
 * @typedef {Object} ErrorContext
 * @property {number} [attemptNumber] - Current attempt number
 * @property {string} [operation] - Operation being performed
 * @property {*} [data] - Additional context data
 */

/**
 * Классы ошибок для AI Admin v2
 */

class AIAdminError extends Error {
  /**
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {ErrorDetails} [details={}] - Error details
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AIAdminError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }

  /**
   * Convert error to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

// Специфичные типы ошибок
class ValidationError extends AIAdminError {
  /**
   * @param {string} message - Error message
   * @param {string} field - Field name
   * @param {*} value - Invalid value
   */
  constructor(message, field, value) {
    super('VALIDATION_ERROR', message, { field, value });
    this.name = 'ValidationError';
  }
}

class APIError extends AIAdminError {
  /**
   * @param {string} service - Service name
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {*} response - API response
   */
  constructor(service, message, statusCode, response) {
    super('API_ERROR', message, { service, statusCode, response });
    this.name = 'APIError';
  }
}

class BookingError extends AIAdminError {
  /**
   * @param {string} message - Error message
   * @param {string} type - Booking error type
   * @param {Object} details - Additional details
   */
  constructor(message, type, details) {
    super('BOOKING_ERROR', message, { type, ...details });
    this.name = 'BookingError';
  }
}

class ContextError extends AIAdminError {
  /**
   * @param {string} message - Error message
   * @param {string} operation - Operation name
   * @param {Object} details - Additional details
   */
  constructor(message, operation, details) {
    super('CONTEXT_ERROR', message, { operation, ...details });
    this.name = 'ContextError';
  }
}

/**
 * Обработчик ошибок с retry логикой
 */
class ErrorHandler {
  constructor() {
    /** @type {RetryConfig} */
    // Конфигурация retry
    this.retryConfig = config.errorHandler.retry;

    // Коды ошибок, которые можно повторить
    /** @type {string[]} */
    this.retryableCodes = config.errorHandler.retryableCodes;
  }

  /**
   * Обработка ошибки с определением типа
   * @param {Error} error - Error to handle
   * @param {ErrorContext} [context={}] - Error context
   * @returns {Promise<ClassifiedError>} Classified error
   */
  async handleError(error, context = {}) {
    logger.error('Handling error:', {
      error: error.message,
      stack: error.stack,
      context
    });

    // Классифицируем ошибку
    const classified = this.classifyError(error);
    
    // Определяем, нужен ли retry
    if (this.isRetryable(classified)) {
      classified.needsRetry = true;
      classified.retryAfter = this.calculateRetryDelay(context.attemptNumber || 1);
    }

    // Получаем user-friendly сообщение
    classified.userMessage = this.getUserMessage(classified);

    return classified;
  }

  /**
   * Классификация ошибки
   * @param {Error} error - Error to classify
   * @returns {ClassifiedError} Classified error
   */
  classifyError(error) {
    // Если это уже наша ошибка
    if (error instanceof AIAdminError) {
      return {
        code: error.code,
        type: error.name,
        message: error.message,
        details: error.details,
        severity: this.getSeverity(error.code)
      };
    }

    // Анализ по тексту ошибки
    const errorLower = error.message?.toLowerCase() || '';

    // Сетевые ошибки
    if (errorLower.includes('econnrefused') || 
        errorLower.includes('timeout') ||
        errorLower.includes('network')) {
      return {
        code: 'NETWORK_ERROR',
        type: 'NetworkError',
        message: error.message,
        severity: 'medium'
      };
    }

    // Ошибки доступности
    if (errorLower.includes('занято') || 
        errorLower.includes('недоступно') ||
        errorLower.includes('not available')) {
      return {
        code: 'AVAILABILITY_ERROR',
        type: 'AvailabilityError',
        message: error.message,
        severity: 'low'
      };
    }

    // Ошибки валидации
    if (errorLower.includes('invalid') || 
        errorLower.includes('required') ||
        errorLower.includes('must be')) {
      return {
        code: 'VALIDATION_ERROR',
        type: 'ValidationError',
        message: error.message,
        severity: 'low'
      };
    }

    // Неизвестная ошибка
    return {
      code: 'UNKNOWN_ERROR',
      type: 'Error',
      message: error.message,
      severity: 'high'
    };
  }

  /**
   * Определение серьезности ошибки
   * @param {string} code - Error code
   * @returns {'critical' | 'high' | 'medium' | 'low'} Severity level
   */
  getSeverity(code) {
    const severityMap = {
      'VALIDATION_ERROR': 'low',
      'AVAILABILITY_ERROR': 'low',
      'NETWORK_ERROR': 'medium',
      'API_ERROR': 'medium',
      'BOOKING_ERROR': 'medium',
      'CONTEXT_ERROR': 'high',
      'UNKNOWN_ERROR': 'high'
    };

    return severityMap[code] || 'medium';
  }

  /**
   * Проверка, можно ли повторить операцию
   * @param {ClassifiedError} classifiedError - Classified error
   * @returns {boolean} Whether error is retryable
   */
  isRetryable(classifiedError) {
    return this.retryableCodes.includes(classifiedError.code);
  }

  /**
   * Расчет задержки для retry (exponential backoff)
   * @param {number} attemptNumber - Current attempt number
   * @returns {number} Delay in milliseconds
   */
  calculateRetryDelay(attemptNumber) {
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, attemptNumber - 1),
      this.retryConfig.maxDelay
    );

    // Добавляем случайный jitter
    const jitter = delay * config.errorHandler.retry.jitterPercent * (Math.random() * 2 - 1);
    
    return Math.round(delay + jitter);
  }

  /**
   * Получение user-friendly сообщения
   * @param {ClassifiedError} classifiedError - Classified error
   * @returns {string} User-friendly message
   */
  getUserMessage(classifiedError) {
    const messages = {
      'NETWORK_ERROR': 'Проблема с подключением. Попробуйте еще раз через несколько секунд.',
      'AVAILABILITY_ERROR': 'Выбранное время недоступно. Давайте подберем другое.',
      'VALIDATION_ERROR': 'Проверьте введенные данные и попробуйте еще раз.',
      'API_ERROR': 'Временная проблема с сервисом. Попробуйте позже.',
      'BOOKING_ERROR': 'Не удалось создать запись. Попробуйте другое время.',
      'CONTEXT_ERROR': 'Произошла ошибка. Давайте начнем сначала.',
      'UNKNOWN_ERROR': 'Произошла неожиданная ошибка. Попробуйте еще раз.'
    };

    return messages[classifiedError.code] || messages['UNKNOWN_ERROR'];
  }

  /**
   * Выполнение операции с retry
   * @template T
   * @param {() => Promise<T>} operation - Operation to execute
   * @param {ErrorContext} [context={}] - Operation context
   * @returns {Promise<T>} Operation result
   * @throws {Error} When all retries are exhausted
   */
  async executeWithRetry(operation, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        // Выполняем операцию
        const result = await operation();
        
        // Успех - логируем если были попытки
        if (attempt > 1) {
          logger.info('Operation succeeded after retry', {
            attempt,
            operation: context.operationName
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Обрабатываем ошибку
        const classified = await this.handleError(error, { 
          ...context, 
          attemptNumber: attempt 
        });
        
        // Проверяем, нужен ли retry
        if (!classified.needsRetry || attempt === this.retryConfig.maxAttempts) {
          logger.error('Operation failed permanently', {
            attempt,
            operation: context.operationName,
            error: classified
          });
          throw error;
        }
        
        // Ждем перед следующей попыткой
        logger.warn(`Retrying operation after ${classified.retryAfter}ms`, {
          attempt,
          operation: context.operationName
        });
        
        await this.delay(classified.retryAfter);
      }
    }
    
    throw lastError;
  }

  /**
   * Задержка выполнения
   * @private
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Форматирование ошибки для логов
   * @param {Error} error - Error to format
   * @param {ErrorContext} [context={}] - Error context
   * @returns {Object} Formatted error object
   */
  formatErrorForLogging(error, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.details
      },
      context,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage()
      }
    };
  }
}

// Экспортируем классы и singleton обработчика
module.exports = {
  ErrorHandler: new ErrorHandler(),
  AIAdminError,
  ValidationError,
  APIError,
  BookingError,
  ContextError
};