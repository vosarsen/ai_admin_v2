  // src/middlewares/rate-limiter.js
  // Temporarily disabled rate-limiter due to Redis configuration issues

  const logger = require('../utils/logger');

  // Dummy rate limiter that does nothing
  function createRateLimiter(options = {}) {
    logger.warn('Rate limiter is disabled');
    return (req, res, next) => next();
  }

  module.exports = createRateLimiter();
