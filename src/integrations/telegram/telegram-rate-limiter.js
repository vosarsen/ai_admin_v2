/**
 * Telegram Rate Limiter
 *
 * Implements Telegram's rate limiting requirements:
 * - 1 message per second per chat
 * - 30 messages per second globally
 *
 * Uses token bucket algorithm for smooth rate limiting
 */

const Sentry = require('@sentry/node');
const logger = require('../../utils/logger').child({ module: 'telegram-rate-limiter' });
const { TelegramRateLimitError } = require('../../utils/telegram-errors');

class TelegramRateLimiter {
  constructor(options = {}) {
    // Global rate limit: 30 messages/second
    this.globalLimit = options.globalLimit || 30;
    this.globalWindow = options.globalWindow || 1000; // 1 second

    // Per-chat rate limit: 1 message/second
    this.perChatLimit = options.perChatLimit || 1;
    this.perChatWindow = options.perChatWindow || 1000; // 1 second

    // Token buckets
    this.globalTokens = this.globalLimit;
    this.globalLastRefill = Date.now();

    // Per-chat buckets: Map<chatId, { tokens, lastRefill }>
    this.chatBuckets = new Map();

    // Cleanup interval for stale chat buckets (every 5 minutes)
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);

    // Metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      rateLimitedRequests: 0,
      globalLimitHits: 0,
      perChatLimitHits: 0
    };
  }

  /**
   * Refill global tokens based on elapsed time
   */
  refillGlobalTokens() {
    const now = Date.now();
    const elapsed = now - this.globalLastRefill;
    const tokensToAdd = (elapsed / this.globalWindow) * this.globalLimit;

    this.globalTokens = Math.min(this.globalLimit, this.globalTokens + tokensToAdd);
    this.globalLastRefill = now;
  }

  /**
   * Get or create chat bucket
   */
  getChatBucket(chatId) {
    if (!this.chatBuckets.has(chatId)) {
      this.chatBuckets.set(chatId, {
        tokens: this.perChatLimit,
        lastRefill: Date.now()
      });
    }

    const bucket = this.chatBuckets.get(chatId);

    // Refill tokens based on elapsed time
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = (elapsed / this.perChatWindow) * this.perChatLimit;

    bucket.tokens = Math.min(this.perChatLimit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    return bucket;
  }

  /**
   * Check if request can proceed
   * @param {number|string} chatId - Telegram chat ID
   * @returns {{ allowed: boolean, retryAfter?: number, reason?: string }}
   */
  checkLimit(chatId) {
    this.metrics.totalRequests++;

    // Refill global tokens
    this.refillGlobalTokens();

    // Check global limit first
    if (this.globalTokens < 1) {
      this.metrics.rateLimitedRequests++;
      this.metrics.globalLimitHits++;

      const retryAfter = Math.ceil(this.globalWindow / this.globalLimit);

      logger.warn('Global rate limit hit', {
        chatId,
        globalTokens: this.globalTokens,
        retryAfter
      });

      return {
        allowed: false,
        retryAfter,
        reason: 'global_limit'
      };
    }

    // Check per-chat limit
    const chatBucket = this.getChatBucket(chatId);

    if (chatBucket.tokens < 1) {
      this.metrics.rateLimitedRequests++;
      this.metrics.perChatLimitHits++;

      const retryAfter = Math.ceil(this.perChatWindow / this.perChatLimit);

      logger.warn('Per-chat rate limit hit', {
        chatId,
        chatTokens: chatBucket.tokens,
        retryAfter
      });

      return {
        allowed: false,
        retryAfter,
        reason: 'per_chat_limit'
      };
    }

    // Consume tokens
    this.globalTokens -= 1;
    chatBucket.tokens -= 1;

    this.metrics.allowedRequests++;

    return { allowed: true };
  }

  /**
   * Acquire permission to send message (throws if rate limited)
   * @param {number|string} chatId - Telegram chat ID
   * @throws {TelegramRateLimitError} If rate limited
   */
  acquire(chatId) {
    const result = this.checkLimit(chatId);

    if (!result.allowed) {
      const error = new TelegramRateLimitError(
        `Rate limited: ${result.reason}`,
        result.retryAfter,
        { chatId, reason: result.reason }
      );

      Sentry.captureException(error, {
        level: 'warning',
        tags: {
          component: 'telegram-rate-limiter',
          reason: result.reason
        },
        extra: { chatId, retryAfter: result.retryAfter }
      });

      throw error;
    }
  }

  /**
   * Wait until rate limit allows sending
   * @param {number|string} chatId - Telegram chat ID
   * @param {number} maxWaitMs - Maximum time to wait (default 5 seconds)
   * @returns {Promise<boolean>} True if acquired, false if timed out
   */
  async waitForSlot(chatId, maxWaitMs = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = this.checkLimit(chatId);

      if (result.allowed) {
        return true;
      }

      // Wait before retry
      const waitTime = Math.min(result.retryAfter * 1000, maxWaitMs - (Date.now() - startTime));

      if (waitTime <= 0) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    return false;
  }

  /**
   * Clean up stale chat buckets (older than 10 minutes)
   */
  cleanup() {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    let cleaned = 0;

    for (const [chatId, bucket] of this.chatBuckets.entries()) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.chatBuckets.delete(chatId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up stale rate limit buckets', { cleaned });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      globalTokens: this.globalTokens,
      activeChatBuckets: this.chatBuckets.size,
      hitRate: this.metrics.totalRequests > 0
        ? ((this.metrics.rateLimitedRequests / this.metrics.totalRequests) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      rateLimitedRequests: 0,
      globalLimitHits: 0,
      perChatLimitHits: 0
    };
  }

  /**
   * Shutdown - cleanup interval
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.chatBuckets.clear();
  }
}

// Export singleton instance with default Telegram limits
const rateLimiter = new TelegramRateLimiter();

module.exports = rateLimiter;
module.exports.TelegramRateLimiter = TelegramRateLimiter;
