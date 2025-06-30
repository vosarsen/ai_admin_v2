// src/middlewares/rate-limiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { createRedisClient } = require('../utils/redis-factory');
const config = require('../config');
const logger = require('../utils/logger');

// Create Redis client for rate limiting
const redisClient = createRedisClient('rate-limiter');

/**
 * Create rate limiter middleware with Redis store
 */
function createRateLimiter(options = {}) {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      error: 'Too many requests, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:',
    }),
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.'
      });
    }
  };

  return rateLimit({ ...defaults, ...options });
}

// Specific rate limiters for different endpoints
const rateLimiters = {
  // Strict limit for webhook endpoint (1000 requests per 15 minutes)
  webhook: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyGenerator: (req) => {
      // Use phone number as key if available
      return req.body?.from || req.ip;
    }
  }),

  // Moderate limit for API endpoints (100 requests per 15 minutes)
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100
  }),

  // Relaxed limit for health checks (300 requests per 15 minutes)
  health: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 300
  }),

  // Very strict limit for manual message sending (20 requests per hour)
  sendMessage: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: {
      success: false,
      error: 'Message sending limit exceeded. Maximum 20 messages per hour.'
    }
  })
};

module.exports = {
  createRateLimiter,
  rateLimiters
};