// src/middleware/critical-error-middleware.js
const criticalErrorLogger = require('../utils/critical-error-logger');
const errorMessages = require('../utils/error-messages');
const logger = require('../utils/logger');

/**
 * Middleware для обработки и логирования критичных ошибок в API
 */
function criticalErrorMiddleware(err, req, res, next) {
  // Логируем все ошибки
  logger.error('API Error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Определяем контекст ошибки
  const errorContext = {
    operation: 'api_request',
    url: req.url,
    method: req.method,
    companyId: req.body?.companyId || req.params?.companyId || req.query?.companyId,
    userId: req.body?.phone || req.body?.userId,
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
  
  // Получаем информацию об ошибке
  const errorResult = errorMessages.getUserMessage(err, errorContext);
  
  // Логируем критичные ошибки
  if (shouldLogAsCritical(err, errorResult)) {
    criticalErrorLogger.logCriticalError(err, {
      ...errorContext,
      requestBody: sanitizeRequestBody(req.body),
      requestHeaders: sanitizeHeaders(req.headers),
      requestParams: req.params,
      requestQuery: req.query,
      responseTime: Date.now() - req.startTime
    });
  }
  
  // Определяем HTTP статус
  const statusCode = determineStatusCode(err);
  
  // Отправляем ответ
  res.status(statusCode).json({
    success: false,
    error: errorResult.message,
    errorCode: err.code || 'INTERNAL_ERROR',
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && {
      technical: err.message,
      stack: err.stack
    })
  });
}

/**
 * Определить, нужно ли логировать как критичную ошибку
 */
function shouldLogAsCritical(err, errorResult) {
  // Всегда логируем высокой и критичной серьезности
  if (errorResult.severity === 'high' || errorResult.severity === 'critical') {
    return true;
  }
  
  // Логируем ошибки баз данных
  if (err.code && err.code.startsWith('PGRST')) {
    return true;
  }
  
  // Логируем ошибки безопасности
  if (err.name === 'UnauthorizedError' || err.code === 'INVALID_HMAC') {
    return true;
  }
  
  // Логируем системные ошибки
  if (err.syscall || err.code === 'ECONNREFUSED') {
    return true;
  }
  
  // Логируем 5xx ошибки
  const statusCode = determineStatusCode(err);
  if (statusCode >= 500) {
    return true;
  }
  
  return false;
}

/**
 * Определить HTTP статус код для ошибки
 */
function determineStatusCode(err) {
  // Если статус уже установлен
  if (err.statusCode) return err.statusCode;
  if (err.status) return err.status;
  
  // Определяем по типу ошибки
  if (err.name === 'ValidationError') return 400;
  if (err.name === 'UnauthorizedError') return 401;
  if (err.code === 'FORBIDDEN') return 403;
  if (err.name === 'NotFoundError') return 404;
  if (err.code === 'RATE_LIMIT_EXCEEDED') return 429;
  
  // По умолчанию - внутренняя ошибка сервера
  return 500;
}

/**
 * Очистить чувствительные данные из тела запроса
 */
function sanitizeRequestBody(body) {
  if (!body) return null;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'api_key', 'secret', 'auth'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Очистить чувствительные заголовки
 */
function sanitizeHeaders(headers) {
  if (!headers) return null;
  
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

module.exports = criticalErrorMiddleware;