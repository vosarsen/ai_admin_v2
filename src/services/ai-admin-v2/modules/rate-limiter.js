const logger = require('../../../utils/logger').child({ module: 'rate-limiter' });
const config = require('../config/modules-config');
const prometheusMetrics = require('./prometheus-metrics');

/**
 * @typedef {Object} RateLimiterOptions
 * @property {number} [windowMs=60000] - Time window in milliseconds
 * @property {number} [maxRequests=30] - Maximum requests per window
 * @property {number} [blockDuration=300000] - Block duration in ms after violations
 */

/**
 * @typedef {Object} UserRecord
 * @property {number[]} requests - Request timestamps
 * @property {number} violations - Violation count
 */

/**
 * @typedef {Object} BlockInfo
 * @property {number} since - Block start timestamp
 * @property {number} until - Block end timestamp
 * @property {string} reason - Block reason
 */

/**
 * @typedef {Object} RateLimiterStats
 * @property {number} totalRequests - Total requests count
 * @property {number} allowedRequests - Allowed requests count
 * @property {number} blockedRequests - Blocked requests count
 * @property {number} uniqueUsers - Unique users count
 * @property {number} activeUsers - Active users count
 * @property {number} blockedUsers - Blocked users count
 * @property {Object} config - Rate limiter configuration
 */

/**
 * @typedef {Object} RateLimitError
 * @property {string} message - Error message
 * @property {string} code - Error code
 * @property {number} [limit] - Request limit
 * @property {number} [windowMs] - Window size
 * @property {number} [retryAfter] - Retry after timestamp
 */

/**
 * Token Bucket Rate Limiter
 * Allows burst traffic while maintaining average rate
 */
class RateLimiter {
  /**
   * @param {RateLimiterOptions} [options={}] - Configuration options
   */
  constructor(options = {}) {
    this.windowMs = options.windowMs || config.rateLimiter.defaultWindowMs;
    this.maxRequests = options.maxRequests || config.rateLimiter.defaultMaxRequests;
    this.blockDuration = options.blockDuration || config.rateLimiter.defaultBlockDuration;
    
    // Storage for tracking requests
    /** @type {Map<string, UserRecord>} */
    this.storage = new Map();
    /** @type {Map<string, BlockInfo>} */
    this.blockedUsers = new Map();
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      uniqueUsers: 0
    };
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, Math.max(this.windowMs, config.rateLimiter.cleanupIntervalMin));
  }

  /**
   * Check if request is allowed
   * @param {string} identifier - User identifier (phone, IP, etc.)
   * @returns {Promise<boolean>} Whether request is allowed
   */
  async checkLimit(identifier) {
    this.stats.totalRequests++;
    
    // Check if user is blocked
    if (this.isBlocked(identifier)) {
      this.stats.blockedRequests++;
      const blockInfo = this.blockedUsers.get(identifier);
      const remainingTime = blockInfo.until - Date.now();
      
      // Отправляем метрику в Prometheus
      prometheusMetrics.recordRateLimiterOperation('phone', false);
      
      const error = new Error(`Rate limit exceeded. Blocked for ${Math.ceil(remainingTime / 1000)} seconds`);
      error.code = 'RATE_LIMIT_BLOCKED';
      error.retryAfter = blockInfo.until;
      throw error;
    }
    
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get or create user record
    let userRecord = this.storage.get(identifier);
    if (!userRecord) {
      userRecord = {
        requests: [],
        violations: 0
      };
      this.storage.set(identifier, userRecord);
      this.stats.uniqueUsers = this.storage.size;
    }
    
    // Remove old requests outside the window
    userRecord.requests = userRecord.requests.filter(time => time > windowStart);
    
    // Check rate limit
    if (userRecord.requests.length >= this.maxRequests) {
      this.stats.blockedRequests++;
      userRecord.violations++;
      
      // Block user after multiple violations
      if (userRecord.violations >= config.rateLimiter.violationsBeforeBlock) {
        this.blockUser(identifier);
      }
      
      // Отправляем метрику в Prometheus
      prometheusMetrics.recordRateLimiterOperation('phone', false);
      
      const error = new Error(`Rate limit exceeded: ${this.maxRequests} requests per ${this.windowMs / 1000} seconds`);
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.limit = this.maxRequests;
      error.windowMs = this.windowMs;
      error.retryAfter = Math.min(...userRecord.requests) + this.windowMs;
      throw error;
    }
    
    // Add current request
    userRecord.requests.push(now);
    userRecord.violations = Math.max(0, userRecord.violations - 1); // Decay violations
    this.stats.allowedRequests++;
    
    // Отправляем метрику в Prometheus
    prometheusMetrics.recordRateLimiterOperation('phone', true);
    
    return true;
  }

  /**
   * Check if user is blocked
   * @param {string} identifier - User identifier
   * @returns {boolean} True if blocked
   */
  isBlocked(identifier) {
    const blockInfo = this.blockedUsers.get(identifier);
    if (!blockInfo) return false;
    
    if (Date.now() > blockInfo.until) {
      this.blockedUsers.delete(identifier);
      return false;
    }
    
    return true;
  }

  /**
   * Block user for specified duration
   * @param {string} identifier - User identifier
   * @param {number} [duration=this.blockDuration] - Block duration in ms
   * @returns {void}
   */
  blockUser(identifier, duration = this.blockDuration) {
    const until = Date.now() + duration;
    this.blockedUsers.set(identifier, {
      since: Date.now(),
      until,
      reason: 'Multiple rate limit violations'
    });
    
    logger.warn(`User blocked for rate limit violations`, {
      identifier,
      duration: duration / 1000,
      until: new Date(until)
    });
  }

  /**
   * Unblock user
   * @param {string} identifier - User identifier
   * @returns {boolean} True if unblocked
   */
  unblockUser(identifier) {
    return this.blockedUsers.delete(identifier);
  }

  /**
   * Get remaining requests for user
   * @param {string} identifier - User identifier
   * @returns {number} Remaining requests count
   */
  getRemainingRequests(identifier) {
    const userRecord = this.storage.get(identifier);
    if (!userRecord) return this.maxRequests;
    
    const windowStart = Date.now() - this.windowMs;
    const activeRequests = userRecord.requests.filter(time => time > windowStart);
    
    return Math.max(0, this.maxRequests - activeRequests.length);
  }

  /**
   * Cleanup old records
   * @private
   * @returns {void}
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleaned = 0;
    
    // Clean request records
    for (const [identifier, userRecord] of this.storage.entries()) {
      userRecord.requests = userRecord.requests.filter(time => time > windowStart);
      
      // Remove empty records
      if (userRecord.requests.length === 0 && userRecord.violations === 0) {
        this.storage.delete(identifier);
        cleaned++;
      }
    }
    
    // Clean expired blocks
    for (const [identifier, blockInfo] of this.blockedUsers.entries()) {
      if (now > blockInfo.until) {
        this.blockedUsers.delete(identifier);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} records`);
    }
    
    this.stats.uniqueUsers = this.storage.size;
  }

  /**
   * Get current statistics
   * @returns {RateLimiterStats} Current statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeUsers: this.storage.size,
      blockedUsers: this.blockedUsers.size,
      config: {
        windowMs: this.windowMs,
        maxRequests: this.maxRequests,
        blockDuration: this.blockDuration
      }
    };
  }

  /**
   * Reset statistics
   * @returns {void}
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      uniqueUsers: this.storage.size
    };
  }

  /**
   * Clear all data
   * @returns {void}
   */
  clear() {
    this.storage.clear();
    this.blockedUsers.clear();
    this.resetStats();
  }

  /**
   * Stop the rate limiter
   * @returns {void}
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * @typedef {Object} LimitCheckResult
 * @property {string} name - Limiter name
 * @property {boolean} allowed - Whether request was allowed
 * @property {string} [error] - Error message if not allowed
 * @property {number} [retryAfter] - Retry after timestamp
 */

/**
 * Composite rate limiter for multiple limits
 */
class CompositeRateLimiter {
  constructor() {
    /** @type {Map<string, RateLimiter>} */
    this.limiters = new Map();
  }

  /**
   * Add a rate limiter
   * @param {string} name - Limiter name
   * @param {RateLimiterOptions} options - Limiter options
   * @returns {RateLimiter} Created limiter
   */
  addLimiter(name, options) {
    const limiter = new RateLimiter(options);
    this.limiters.set(name, limiter);
    return limiter;
  }

  /**
   * Check all limits
   * @param {string} identifier - User identifier
   * @returns {Promise<LimitCheckResult[]>} Check results
   * @throws {RateLimitError} When any limit is exceeded
   */
  async checkLimits(identifier) {
    const results = [];
    
    for (const [name, limiter] of this.limiters) {
      try {
        await limiter.checkLimit(identifier);
        results.push({ name, allowed: true });
      } catch (error) {
        results.push({ 
          name, 
          allowed: false, 
          error: error.message,
          retryAfter: error.retryAfter 
        });
        
        // If any limiter blocks, throw the error
        throw error;
      }
    }
    
    return results;
  }

  /**
   * Get all stats
   * @returns {Object<string, RateLimiterStats>} Stats map
   */
  getAllStats() {
    const stats = {};
    for (const [name, limiter] of this.limiters) {
      stats[name] = limiter.getStats();
    }
    return stats;
  }

  /**
   * Stop all limiters
   * @returns {void}
   */
  stopAll() {
    for (const limiter of this.limiters.values()) {
      limiter.stop();
    }
  }
}

// Export classes
module.exports = {
  RateLimiter,
  CompositeRateLimiter
};