/**
 * Map with TTL (Time To Live) support
 * Automatically removes expired entries
 */
class TTLMap extends Map {
  constructor(ttl = 3600000, checkInterval = 60000) { // default: 1 hour TTL, check every minute
    super();
    this.ttl = ttl;
    this.checkInterval = checkInterval;
    this.timestamps = new Map();

    // Start cleanup interval
    this.cleanupTimer = setInterval(() => this.cleanup(), checkInterval);
  }

  /**
   * Set value with TTL
   */
  set(key, value, customTTL = null) {
    super.set(key, value);
    this.timestamps.set(key, {
      created: Date.now(),
      ttl: customTTL || this.ttl
    });
    return this;
  }

  /**
   * Get value if not expired
   */
  get(key) {
    const timestamp = this.timestamps.get(key);

    if (!timestamp) {
      return undefined;
    }

    const age = Date.now() - timestamp.created;

    if (age > timestamp.ttl) {
      // Expired - remove it
      this.delete(key);
      return undefined;
    }

    return super.get(key);
  }

  /**
   * Delete key and its timestamp
   */
  delete(key) {
    this.timestamps.delete(key);
    return super.delete(key);
  }

  /**
   * Clear all entries
   */
  clear() {
    this.timestamps.clear();
    return super.clear();
  }

  /**
   * Check if key exists and not expired
   */
  has(key) {
    const value = this.get(key); // This will auto-delete if expired
    return value !== undefined;
  }

  /**
   * Get all non-expired entries
   */
  entries() {
    this.cleanup(); // Clean before returning
    return super.entries();
  }

  /**
   * Get all non-expired keys
   */
  keys() {
    this.cleanup();
    return super.keys();
  }

  /**
   * Get all non-expired values
   */
  values() {
    this.cleanup();
    return super.values();
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, timestamp] of this.timestamps) {
      const age = now - timestamp.created;

      if (age > timestamp.ttl) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      this.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.debug(`TTLMap: Cleaned ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Update TTL for existing key
   */
  updateTTL(key, newTTL) {
    const timestamp = this.timestamps.get(key);
    if (timestamp) {
      timestamp.ttl = newTTL;
    }
  }

  /**
   * Get remaining TTL for key
   */
  getTTL(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return 0;

    const age = Date.now() - timestamp.created;
    const remaining = timestamp.ttl - age;

    return remaining > 0 ? remaining : 0;
  }

  /**
   * Get statistics
   */
  getStats() {
    this.cleanup();

    return {
      size: this.size,
      totalKeys: this.timestamps.size,
      oldestEntry: this.getOldestEntry(),
      newestEntry: this.getNewestEntry()
    };
  }

  /**
   * Get oldest entry
   */
  getOldestEntry() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const [key, timestamp] of this.timestamps) {
      if (timestamp.created < oldestTime) {
        oldestTime = timestamp.created;
        oldest = { key, age: Date.now() - timestamp.created };
      }
    }

    return oldest;
  }

  /**
   * Get newest entry
   */
  getNewestEntry() {
    let newest = null;
    let newestTime = 0;

    for (const [key, timestamp] of this.timestamps) {
      if (timestamp.created > newestTime) {
        newestTime = timestamp.created;
        newest = { key, age: Date.now() - timestamp.created };
      }
    }

    return newest;
  }

  /**
   * Stop cleanup interval
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

module.exports = TTLMap;