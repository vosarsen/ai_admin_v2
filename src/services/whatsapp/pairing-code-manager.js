/**
 * WhatsApp Pairing Code Manager
 * Manages pairing code generation and validation
 */

const logger = require('../../utils/logger');
const { createRedisClient } = require('../../utils/redis-factory');
const EventEmitter = require('events');

class PairingCodeManager extends EventEmitter {
  constructor() {
    super();

    this.codes = new Map(); // companyId -> { code, phoneNumber, expiresAt }
    this.redis = null;
    this.codeExpiry = 60000; // 60 seconds

    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    try {
      this.redis = createRedisClient('pairing-codes');
      logger.info('Pairing Code Manager initialized with Redis');
    } catch (error) {
      logger.warn('Pairing Code Manager using in-memory storage:', error.message);
    }
  }

  /**
   * Store pairing code
   */
  async storePairingCode(companyId, code, phoneNumber) {
    const expiresAt = Date.now() + this.codeExpiry;
    const data = {
      code,
      phoneNumber,
      expiresAt,
      createdAt: Date.now()
    };

    // Store in memory
    this.codes.set(companyId, data);

    // Store in Redis if available
    if (this.redis) {
      try {
        const key = `pairing:${companyId}`;
        await this.redis.setex(
          key,
          Math.ceil(this.codeExpiry / 1000),
          JSON.stringify(data)
        );
      } catch (error) {
        logger.error('Failed to store pairing code in Redis:', error);
      }
    }

    // Emit event
    this.emit('code-generated', {
      companyId,
      code,
      phoneNumber,
      expiresAt
    });

    // Schedule cleanup
    setTimeout(() => {
      this.cleanupCode(companyId);
    }, this.codeExpiry);

    return data;
  }

  /**
   * Get pairing code
   */
  async getPairingCode(companyId) {
    // Check memory first
    let data = this.codes.get(companyId);

    // Check Redis if not in memory
    if (!data && this.redis) {
      try {
        const key = `pairing:${companyId}`;
        const stored = await this.redis.get(key);
        if (stored) {
          data = JSON.parse(stored);
        }
      } catch (error) {
        logger.error('Failed to get pairing code from Redis:', error);
      }
    }

    // Check if expired
    if (data && data.expiresAt < Date.now()) {
      this.cleanupCode(companyId);
      return null;
    }

    return data;
  }

  /**
   * Validate pairing code
   */
  async validatePairingCode(companyId, code) {
    const data = await this.getPairingCode(companyId);

    if (!data) {
      return { valid: false, reason: 'No code found or expired' };
    }

    if (data.code !== code) {
      return { valid: false, reason: 'Invalid code' };
    }

    return { valid: true, phoneNumber: data.phoneNumber };
  }

  /**
   * Clean up expired code
   */
  async cleanupCode(companyId) {
    // Remove from memory
    this.codes.delete(companyId);

    // Remove from Redis
    if (this.redis) {
      try {
        const key = `pairing:${companyId}`;
        await this.redis.del(key);
      } catch (error) {
        logger.error('Failed to cleanup pairing code from Redis:', error);
      }
    }

    // Emit event
    this.emit('code-expired', { companyId });
  }

  /**
   * Generate pairing code with session
   */
  async generateWithSession(session, companyId, phoneNumber) {
    try {
      // Use Baileys to request pairing code
      const code = await session.requestPairingCode(phoneNumber);

      // Format code (add dashes for readability)
      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

      // Store the code
      await this.storePairingCode(companyId, formattedCode, phoneNumber);

      logger.info(`✅ Pairing code generated for company ${companyId}: ${formattedCode}`);

      return formattedCode;
    } catch (error) {
      logger.error(`Failed to generate pairing code for ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active codes (for monitoring)
   */
  getActiveCodes() {
    const now = Date.now();
    const active = [];

    for (const [companyId, data] of this.codes) {
      if (data.expiresAt > now) {
        active.push({
          companyId,
          phoneNumber: data.phoneNumber,
          remainingTime: Math.ceil((data.expiresAt - now) / 1000)
        });
      }
    }

    return active;
  }

  /**
   * Clear all codes (for cleanup)
   */
  async clearAll() {
    // Clear memory
    this.codes.clear();

    // Clear Redis
    if (this.redis) {
      try {
        const keys = await this.redis.keys('pairing:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.error('Failed to clear pairing codes from Redis:', error);
      }
    }
  }
}

module.exports = new PairingCodeManager();