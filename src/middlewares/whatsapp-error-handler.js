/**
 * WhatsApp Error Handler Middleware
 * Standardizes error responses for WhatsApp-related endpoints
 */

const { WhatsAppError, ErrorHandler } = require('../utils/whatsapp-errors');
const logger = require('../utils/logger');

/**
 * Express error handler middleware for WhatsApp routes
 */
function whatsappErrorHandler(err, req, res, next) {
  // Skip if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Standardize error
  const standardError = ErrorHandler.standardize(err);

  // Log error
  ErrorHandler.log(standardError, logger);

  // Add request context to error
  standardError.details = {
    ...standardError.details,
    requestId: req.id,
    path: req.path,
    method: req.method,
    ip: req.ip
  };

  // Determine HTTP status code
  let statusCode = 500;

  switch (standardError.code) {
    case 'VALIDATION_ERROR':
      statusCode = 400;
      break;
    case 'AUTH_ERROR':
      statusCode = 401;
      break;
    case 'RATE_LIMIT':
      statusCode = 429;
      break;
    case 'SESSION_ERROR':
    case 'QR_CODE_ERROR':
    case 'PAIRING_CODE_ERROR':
      statusCode = 503;
      break;
    case 'CONNECTION_ERROR':
    case 'TIMEOUT_ERROR':
      statusCode = 504;
      break;
    case 'CONFIG_ERROR':
      statusCode = 500;
      break;
    default:
      statusCode = 500;
  }

  // Build response
  const response = ErrorHandler.toResponse(standardError);

  // Add retry headers for rate limit errors
  if (standardError.code === 'RATE_LIMIT' && standardError.retryAfter) {
    res.set('Retry-After', standardError.retryAfter.toString());
    res.set('X-RateLimit-Reset', new Date(Date.now() + standardError.retryAfter * 1000).toISOString());
  }

  // Send response
  res.status(statusCode).json(response);
}

/**
 * Async route wrapper with error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation middleware factory
 */
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      const { error } = schema.validate(req.body);
      if (error) {
        const { ValidationError } = require('../utils/whatsapp-errors');
        throw new ValidationError(
          error.details[0].message,
          error.details[0].path.join('.'),
          { validationDetails: error.details }
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Rate limit error handler
 */
function rateLimitHandler(req, res) {
  const { RateLimitError } = require('../utils/whatsapp-errors');
  const error = new RateLimitError(
    'Too many requests',
    60, // Default retry after 60 seconds
    { ip: req.ip }
  );

  whatsappErrorHandler(error, req, res, () => {});
}

/**
 * Not found handler
 */
function notFoundHandler(req, res) {
  const { WhatsAppError } = require('../utils/whatsapp-errors');
  const error = new WhatsAppError(
    'Endpoint not found',
    'NOT_FOUND',
    { path: req.path }
  );

  res.status(404).json(ErrorHandler.toResponse(error));
}

module.exports = {
  whatsappErrorHandler,
  asyncHandler,
  validateRequest,
  rateLimitHandler,
  notFoundHandler
};