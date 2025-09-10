/**
 * Rate Limiter Utility
 * Provides rate limiting functionality with Redis backend
 */

const redis = require('./redis-factory');
const logger = require('./logger');

class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000; // 1 minute default
        this.maxRequests = options.maxRequests || 100;
        this.keyPrefix = options.keyPrefix || 'ratelimit:';
        this.redisClient = null;
        this.inMemoryStore = new Map(); // Fallback for when Redis is unavailable
        
        this.initializeRedis();
    }

    /**
     * Initialize Redis connection
     */
    async initializeRedis() {
        try {
            this.redisClient = redis.getClient('rate-limiter');
            logger.debug('Rate limiter initialized with Redis');
        } catch (error) {
            logger.warn('Rate limiter falling back to in-memory store:', error.message);
        }
    }

    /**
     * Check if request is within rate limit
     */
    async checkLimit(key) {
        const fullKey = `${this.keyPrefix}${key}`;
        
        try {
            if (this.redisClient) {
                return await this.checkRedisLimit(fullKey);
            } else {
                return this.checkMemoryLimit(fullKey);
            }
        } catch (error) {
            logger.error('Rate limiter error:', error);
            // On error, allow the request (fail open)
            return true;
        }
    }

    /**
     * Check rate limit using Redis
     */
    async checkRedisLimit(key) {
        const multi = this.redisClient.multi();
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        // Remove old entries
        multi.zremrangebyscore(key, '-inf', windowStart);
        
        // Count current entries
        multi.zcard(key);
        
        // Add current request
        multi.zadd(key, now, `${now}-${Math.random()}`);
        
        // Set expiry
        multi.expire(key, Math.ceil(this.windowMs / 1000));
        
        const results = await multi.exec();
        const count = results[1][1]; // Get count from zcard result
        
        return count < this.maxRequests;
    }

    /**
     * Check rate limit using in-memory store
     */
    checkMemoryLimit(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        // Get or create entry
        let entry = this.inMemoryStore.get(key);
        if (!entry) {
            entry = [];
            this.inMemoryStore.set(key, entry);
        }
        
        // Filter out old timestamps
        entry = entry.filter(timestamp => timestamp > windowStart);
        
        // Check if under limit
        if (entry.length >= this.maxRequests) {
            this.inMemoryStore.set(key, entry);
            return false;
        }
        
        // Add current timestamp
        entry.push(now);
        this.inMemoryStore.set(key, entry);
        
        // Clean up old keys periodically
        this.cleanupMemoryStore();
        
        return true;
    }

    /**
     * Clean up old entries from memory store
     */
    cleanupMemoryStore() {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        for (const [key, timestamps] of this.inMemoryStore.entries()) {
            const filtered = timestamps.filter(t => t > windowStart);
            if (filtered.length === 0) {
                this.inMemoryStore.delete(key);
            } else {
                this.inMemoryStore.set(key, filtered);
            }
        }
    }

    /**
     * Reset rate limit for a key
     */
    async reset(key) {
        const fullKey = `${this.keyPrefix}${key}`;
        
        try {
            if (this.redisClient) {
                await this.redisClient.del(fullKey);
            } else {
                this.inMemoryStore.delete(fullKey);
            }
            return true;
        } catch (error) {
            logger.error('Failed to reset rate limit:', error);
            return false;
        }
    }

    /**
     * Get current count for a key
     */
    async getCount(key) {
        const fullKey = `${this.keyPrefix}${key}`;
        
        try {
            if (this.redisClient) {
                const now = Date.now();
                const windowStart = now - this.windowMs;
                return await this.redisClient.zcount(fullKey, windowStart, now);
            } else {
                const entry = this.inMemoryStore.get(fullKey) || [];
                const now = Date.now();
                const windowStart = now - this.windowMs;
                return entry.filter(t => t > windowStart).length;
            }
        } catch (error) {
            logger.error('Failed to get rate limit count:', error);
            return 0;
        }
    }

    /**
     * Get remaining requests for a key
     */
    async getRemaining(key) {
        const count = await this.getCount(key);
        return Math.max(0, this.maxRequests - count);
    }

    /**
     * Shutdown and cleanup
     */
    async shutdown() {
        this.inMemoryStore.clear();
        // Redis client will be closed by redis-factory
    }
}

module.exports = RateLimiter;