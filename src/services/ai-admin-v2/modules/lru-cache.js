const config = require('../config/modules-config');

/**
 * @typedef {Object} CacheItem
 * @property {*} value - Cached value
 * @property {number} expiry - Expiration timestamp
 */

/**
 * @typedef {Object} CacheStats
 * @property {number} size - Current cache size
 * @property {number} maxSize - Maximum cache size
 * @property {number} ttl - Time to live in ms
 * @property {Object} stats - Statistics object
 * @property {number} stats.hits - Cache hits count
 * @property {number} stats.misses - Cache misses count
 * @property {number} stats.sets - Cache sets count
 * @property {number} stats.deletes - Cache deletes count
 * @property {number} stats.cleanups - Cleanup operations count
 * @property {number} stats.evictions - Evictions count
 * @property {string} stats.hitRate - Hit rate percentage
 */

/**
 * Простая реализация LRU (Least Recently Used) кэша
 * с поддержкой TTL (Time To Live)
 */
class LRUCache {
  /**
   * @param {number} [maxSize] - Maximum cache size
   * @param {number} [ttl] - Time to live in milliseconds
   */
  constructor(maxSize = config.cache.defaultMaxSize, ttl = config.cache.defaultTTL) {
    this.maxSize = maxSize;
    this.ttl = ttl; // время жизни в миллисекундах
    /** @type {Map<string, CacheItem>} */
    this.cache = new Map();
    
    // Автоматическая очистка
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, config.cache.cleanupInterval);
    
    // Счетчики для мониторинга
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      cleanups: 0,
      evictions: 0
    };
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*|null} Cached value or null
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    // Проверяем не истек ли TTL
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // LRU: переместить в конец (самый свежий)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    this.stats.hits++;
    return item.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @returns {void}
   */
  set(key, value) {
    // Если максимальный размер 0, не сохраняем
    if (this.maxSize === 0) {
      this.stats.sets++;
      this.stats.evictions++;
      return;
    }
    
    // Удаляем если уже существует (для LRU порядка)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Проверяем размер кэша
    if (this.cache.size >= this.maxSize) {
      // Удаляем самый старый элемент (первый в Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
    
    // Добавляем в конец
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
    
    this.stats.sets++;
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    const result = this.cache.delete(key);
    if (result) {
      this.stats.deletes++;
    }
    return result;
  }

  /**
   * Clear all cache entries
   * @returns {void}
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.deletes += size;
  }

  /**
   * Периодическая очистка истекших элементов
   * @returns {number} Number of cleaned entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.stats.cleanups++;
      this.stats.evictions += cleaned;
    }
    
    return cleaned;
  }

  /**
   * Get cache statistics
   * @returns {CacheStats} Cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
      
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      stats: {
        ...this.stats,
        hitRate: `${hitRate}%`
      }
    };
  }
  
  /**
   * Метод для остановки автоматической очистки
   * @returns {void}
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

module.exports = LRUCache;