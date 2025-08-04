const logger = require('../../../utils/logger').child({ module: 'error-handler' });

/**
 * Классы ошибок для AI Admin v2
 */

class AIAdminError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AIAdminError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }

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
  constructor(message, field, value) {
    super('VALIDATION_ERROR', message, { field, value });
    this.name = 'ValidationError';
  }
}

class APIError extends AIAdminError {
  constructor(service, message, statusCode, response) {
    super('API_ERROR', message, { service, statusCode, response });
    this.name = 'APIError';
  }
}

class BookingError extends AIAdminError {
  constructor(message, type, details) {
    super('BOOKING_ERROR', message, { type, ...details });
    this.name = 'BookingError';
  }
}

class ContextError extends AIAdminError {
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
    // Конфигурация retry
    this.retryConfig = {
      maxAttempts: 3,
      initialDelay: 1000, // 1 секунда
      maxDelay: 10000,    // 10 секунд
      backoffFactor: 2
    };

    // Коды ошибок, которые можно повторить
    this.retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_ERROR',
      'TEMPORARY_ERROR'
    ];
  }

  /**
   * Обработка ошибки с определением типа
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
   */
  isRetryable(classifiedError) {
    return this.retryableCodes.includes(classifiedError.code);
  }

  /**
   * Расчет задержки для retry (exponential backoff)
   */
  calculateRetryDelay(attemptNumber) {
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, attemptNumber - 1),
      this.retryConfig.maxDelay
    );

    // Добавляем случайный jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    
    return Math.round(delay + jitter);
  }

  /**
   * Получение user-friendly сообщения
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
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Форматирование ошибки для логов
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