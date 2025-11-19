/**
 * WhatsApp Credentials Cache
 *
 * PURPOSE:
 * - Provides in-memory + file-based caching of Baileys credentials
 * - Enables 5-minute grace period during PostgreSQL outages
 * - Persists cache across service restarts
 *
 * CREATED: 2025-11-19 (Phase 2 - Task 3.1 & 3.1.1)
 * REFACTORED: 2025-11-19 (Priority 2 - Code review fix)
 *
 * USAGE:
 *   const cache = new CredentialsCache();
 *   await cache.initialize();
 *
 *   // Set credentials
 *   cache.set(companyId, creds, keys);
 *
 *   // Get credentials (returns null if expired)
 *   const cached = cache.get(companyId);
 *
 *   // Clear credentials
 *   cache.clear(companyId);
 *
 * FEATURES:
 * - In-memory Map storage for fast access
 * - 5-minute TTL with automatic expiry
 * - Periodic cleanup (every 60 seconds)
 * - File persistence (.baileys-cache.json)
 * - Atomic writes (temp file + rename)
 * - Secure permissions (0600 - owner only)
 * - Buffer revival from JSON
 * - Graceful degradation on errors
 *
 * ARCHITECTURE:
 * - Extracted from session-pool.js for better separation of concerns
 * - Reusable across different services
 * - Easier to unit test
 * - Clear single responsibility
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../../utils/logger');

class CredentialsCache {
    /**
     * Create credentials cache instance
     * @param {Object} options - Configuration options
     * @param {number} options.ttlMs - Time-to-live in milliseconds (default: 5 minutes)
     * @param {number} options.cleanupIntervalMs - Cleanup interval in ms (default: 60 seconds)
     * @param {string} options.cacheFilePath - Path to cache file (default: .baileys-cache.json)
     */
    constructor(options = {}) {
        this.cache = new Map();
        this.ttlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes
        this.cleanupIntervalMs = options.cleanupIntervalMs || 60 * 1000; // 60 seconds
        this.cacheFilePath = options.cacheFilePath || path.join(process.cwd(), '.baileys-cache.json');
        this.cleanupTimer = null;
    }

    /**
     * Initialize cache - load from file and start cleanup
     */
    async initialize() {
        await this.loadFromFile();
        this.startCleanup();
        logger.debug('✅ CredentialsCache initialized');
    }

    /**
     * Get cached credentials for company (if not expired)
     * @param {string} companyId - Company ID
     * @returns {Object|null} - Cached {creds, keys} or null if expired/missing
     */
    get(companyId) {
        const cached = this.cache.get(companyId);

        if (!cached) {
            return null;
        }

        const age = Date.now() - cached.timestamp;

        if (age > this.ttlMs) {
            logger.debug(`⏱️ Cache expired for company ${companyId} (age: ${Math.round(age / 1000)}s)`);
            this.cache.delete(companyId);
            return null;
        }

        logger.debug(`💾 Cache hit for company ${companyId} (age: ${Math.round(age / 1000)}s)`);
        return cached;
    }

    /**
     * Set cached credentials for company
     * @param {string} companyId - Company ID
     * @param {Object} creds - Credentials object (will be deep cloned)
     * @param {Object} keys - Keys interface (will be serialized to object)
     */
    set(companyId, creds, keys) {
        // Deep clone to prevent mutations
        const cachedCreds = JSON.parse(JSON.stringify(creds));

        // Store keys as plain object (not interface methods)
        const cachedKeys = {
            // We'll store a snapshot of keys, not the interface methods
            // The interface will be reconstructed when loading from cache
            _isCached: true,
            _timestamp: Date.now()
        };

        this.cache.set(companyId, {
            creds: cachedCreds,
            keys: cachedKeys,
            timestamp: Date.now()
        });

        logger.debug(`💾 Credentials cached for company ${companyId}`);

        // Persist cache to file (fire-and-forget)
        this.saveToFile().catch(err => {
            logger.error('Failed to save cache to file:', err);
        });
    }

    /**
     * Clear cached credentials for company
     * @param {string} companyId - Company ID
     */
    clear(companyId) {
        const had = this.cache.has(companyId);
        this.cache.delete(companyId);

        if (had) {
            logger.debug(`🗑️ Cleared credentials cache for company ${companyId}`);

            // Persist cache to file
            this.saveToFile().catch(err => {
                logger.error('Failed to save cache to file:', err);
            });
        }
    }

    /**
     * Clear all cached credentials
     */
    clearAll() {
        const size = this.cache.size;
        this.cache.clear();

        if (size > 0) {
            logger.info(`🗑️ Cleared all cache entries (${size} total)`);

            // Persist cache to file
            this.saveToFile().catch(err => {
                logger.error('Failed to save cache to file:', err);
            });
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getStats() {
        const now = Date.now();
        const entries = Array.from(this.cache.entries());

        return {
            total: entries.length,
            expired: entries.filter(([, cached]) => now - cached.timestamp > this.ttlMs).length,
            valid: entries.filter(([, cached]) => now - cached.timestamp <= this.ttlMs).length,
            oldestAge: entries.length > 0
                ? Math.max(...entries.map(([, cached]) => now - cached.timestamp))
                : 0
        };
    }

    /**
     * Start periodic cache cleanup (removes expired entries)
     */
    startCleanup() {
        this.cleanupTimer = setInterval(() => {
            this.cleanExpired();
        }, this.cleanupIntervalMs);

        logger.debug('Cache cleanup initialized (runs every 60s)');
    }

    /**
     * Stop periodic cleanup
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            logger.debug('Cache cleanup stopped');
        }
    }

    /**
     * Clean expired cache entries
     * Called periodically to prevent memory leaks
     */
    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;

        for (const [companyId, cached] of this.cache.entries()) {
            const age = now - cached.timestamp;

            if (age > this.ttlMs) {
                this.cache.delete(companyId);
                cleaned++;
                logger.debug(`🗑️ Cleaned expired cache for company ${companyId} (age: ${Math.round(age / 1000)}s)`);
            }
        }

        if (cleaned > 0) {
            logger.info(`🧹 Cleaned ${cleaned} expired cache entries`);

            // Persist cache to file after cleanup
            this.saveToFile().catch(err => {
                logger.error('Failed to save cache to file:', err);
            });
        }
    }

    /**
     * Revive Buffer objects from JSON
     * Buffers are serialized as {type: 'Buffer', data: [...]} by JSON.stringify
     * This function recursively converts them back to Buffer objects
     * @param {*} obj - Object to revive
     * @returns {*} - Object with Buffers revived
     */
    reviveBuffers(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        // Check if this is a serialized Buffer object
        if (obj.type === 'Buffer' && obj.data !== undefined) {
            // Handle array format: {type: 'Buffer', data: [1,2,3]}
            if (Array.isArray(obj.data)) {
                return Buffer.from(obj.data);
            }
            // Handle base64 string format: {type: 'Buffer', data: "base64=="}
            if (typeof obj.data === 'string') {
                return Buffer.from(obj.data, 'base64');
            }
        }

        // Recursively process arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this.reviveBuffers(item));
        }

        // Recursively process plain objects
        const revived = {};
        for (const [key, value] of Object.entries(obj)) {
            revived[key] = this.reviveBuffers(value);
        }
        return revived;
    }

    /**
     * Load credentials cache from file
     * Called on startup to restore cache from previous session
     */
    async loadFromFile() {
        try {
            // Check if file exists
            try {
                await fs.access(this.cacheFilePath);
            } catch {
                logger.debug('📂 No cache file found, starting with empty cache');
                return;
            }

            // Read and parse cache file
            const cacheData = await fs.readFile(this.cacheFilePath, 'utf8');
            const parsedCache = JSON.parse(cacheData);

            // Restore cache entries, validating TTL
            const now = Date.now();
            let loaded = 0;
            let expired = 0;

            for (const [companyId, cacheEntry] of Object.entries(parsedCache)) {
                const age = now - cacheEntry.timestamp;

                if (age <= this.ttlMs) {
                    // Cache still valid - restore it with Buffer revival
                    const revivedEntry = {
                        creds: this.reviveBuffers(cacheEntry.creds),
                        keys: cacheEntry.keys,
                        timestamp: cacheEntry.timestamp
                    };

                    this.cache.set(companyId, revivedEntry);
                    loaded++;
                    logger.info(`💾 Restored cache for company ${companyId} (age: ${Math.round(age / 1000)}s)`);
                } else {
                    // Cache expired - skip
                    expired++;
                    logger.debug(`⏱️ Skipped expired cache for company ${companyId} (age: ${Math.round(age / 1000)}s)`);
                }
            }

            logger.info(`✅ Cache loaded from file: ${loaded} valid, ${expired} expired`);
        } catch (error) {
            // Graceful degradation - log error but continue with empty cache
            logger.error('Failed to load cache from file:', error);
            logger.warn('⚠️ Starting with empty cache due to load error');
        }
    }

    /**
     * Save credentials cache to file
     * Called after cache updates to persist across restarts
     */
    async saveToFile() {
        try {
            // Convert Map to plain object for JSON serialization
            const cacheObject = {};
            for (const [companyId, cacheEntry] of this.cache.entries()) {
                cacheObject[companyId] = cacheEntry;
            }

            // Atomic write: write to temp file, then rename
            const tempPath = `${this.cacheFilePath}.tmp`;
            await fs.writeFile(tempPath, JSON.stringify(cacheObject, null, 2), 'utf8');

            // Set restrictive permissions (only owner can read/write)
            await fs.chmod(tempPath, 0o600);

            // Atomic rename
            await fs.rename(tempPath, this.cacheFilePath);

            logger.debug(`💾 Cache saved to file: ${Object.keys(cacheObject).length} entries`);
        } catch (error) {
            // Non-critical error - cache still works in-memory
            logger.error('Failed to save cache to file:', error);
            logger.warn('⚠️ Cache file save failed, continuing with in-memory only');
        }
    }

    /**
     * Shutdown cache - stop cleanup and optionally save to file
     * @param {boolean} saveBeforeShutdown - Whether to save cache before shutdown (default: true)
     */
    async shutdown(saveBeforeShutdown = true) {
        this.stopCleanup();

        if (saveBeforeShutdown) {
            await this.saveToFile();
        }

        logger.info('CredentialsCache shutdown complete');
    }
}

module.exports = CredentialsCache;
