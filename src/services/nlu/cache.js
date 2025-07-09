// src/services/nlu/cache.js
const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Simple in-memory cache for NLU results
 */
class NLUCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Generate cache key from message and context
   * @param {string} message - User message
   * @param {Object} context - Context object
   * @returns {string} Cache key
   */
  generateKey(message, context) {
    const normalizedMessage = message.toLowerCase().trim();
    const contextKey = `${context.companyId}:${context.phone}`;
    
    // Create hash for consistent key length
    const hash = crypto
      .createHash('md5')
      .update(`${normalizedMessage}:${contextKey}`)
      .digest('hex');
    
    return hash;
  }

  /**
   * Get cached result
   * @param {string} key - Cache key
   * @returns {Object|null} Cached result or null
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if entry is expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    logger.debug('NLU cache hit', { key, hitRate: this.getHitRate() });
    
    // Return deep copy to prevent mutation
    return JSON.parse(JSON.stringify(entry.value));
  }

  /**
   * Set cache entry
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {number} ttl - Optional TTL override
   */
  set(key, value, ttl = this.ttl) {
    // Enforce max size before adding new entry
    while (this.cache.size >= this.maxSize) {
      this._evictOldest();
    }
    
    const entry = {
      value: JSON.parse(JSON.stringify(value)), // Deep copy
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    };
    
    this.cache.set(key, entry);
    logger.debug('NLU cache set', { key, ttl, cacheSize: this.cache.size });
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('NLU cache cleared', { entriesCleared: size });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: hitRate.toFixed(2) + '%'
    };
  }

  /**
   * Get hit rate as decimal
   * @returns {number} Hit rate (0-1)
   */
  getHitRate() {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Remove expired entries
   */
  cleanExpired() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.debug('NLU cache cleaned', { entriesRemoved: removed });
    }
    
    return removed;
  }

  /**
   * Evict oldest entry
   * @private
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }
}

module.exports = NLUCache;