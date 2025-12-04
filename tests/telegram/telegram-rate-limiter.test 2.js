/**
 * Telegram Rate Limiter Unit Tests
 *
 * Tests for token bucket rate limiting implementation
 *
 * Run with: npm test -- tests/telegram/telegram-rate-limiter.test.js
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

const { TelegramRateLimiter } = require('../../src/integrations/telegram/telegram-rate-limiter');
const { TelegramRateLimitError } = require('../../src/utils/telegram-errors');

describe('TelegramRateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    // Create fresh instance for each test
    rateLimiter = new TelegramRateLimiter({
      globalLimit: 30,
      globalWindow: 1000,
      perChatLimit: 1,
      perChatWindow: 1000
    });
  });

  afterEach(() => {
    rateLimiter.shutdown();
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      const limiter = new TelegramRateLimiter();

      expect(limiter.globalLimit).toBe(30);
      expect(limiter.globalWindow).toBe(1000);
      expect(limiter.perChatLimit).toBe(1);
      expect(limiter.perChatWindow).toBe(1000);
      expect(limiter.globalTokens).toBe(30);

      limiter.shutdown();
    });

    test('should initialize with custom values', () => {
      const limiter = new TelegramRateLimiter({
        globalLimit: 10,
        globalWindow: 2000,
        perChatLimit: 5,
        perChatWindow: 5000
      });

      expect(limiter.globalLimit).toBe(10);
      expect(limiter.globalWindow).toBe(2000);
      expect(limiter.perChatLimit).toBe(5);
      expect(limiter.perChatWindow).toBe(5000);

      limiter.shutdown();
    });

    test('should initialize metrics', () => {
      const metrics = rateLimiter.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.allowedRequests).toBe(0);
      expect(metrics.rateLimitedRequests).toBe(0);
      expect(metrics.globalLimitHits).toBe(0);
      expect(metrics.perChatLimitHits).toBe(0);
    });
  });

  describe('checkLimit()', () => {
    test('should allow first request', () => {
      const result = rateLimiter.checkLimit(12345);

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    test('should block second request to same chat within window', () => {
      rateLimiter.checkLimit(12345); // First request
      const result = rateLimiter.checkLimit(12345); // Second request

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('per_chat_limit');
      expect(result.retryAfter).toBeDefined();
    });

    test('should allow requests to different chats', () => {
      const result1 = rateLimiter.checkLimit(11111);
      const result2 = rateLimiter.checkLimit(22222);
      const result3 = rateLimiter.checkLimit(33333);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });

    test('should block when global limit is exhausted', () => {
      // Exhaust global limit (30 requests)
      for (let i = 0; i < 30; i++) {
        rateLimiter.checkLimit(i); // Different chats to avoid per-chat limit
      }

      const result = rateLimiter.checkLimit(99999);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('global_limit');
    });

    test('should update metrics correctly', () => {
      rateLimiter.checkLimit(11111); // Allowed
      rateLimiter.checkLimit(11111); // Blocked (per-chat)
      rateLimiter.checkLimit(22222); // Allowed

      const metrics = rateLimiter.getMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.allowedRequests).toBe(2);
      expect(metrics.rateLimitedRequests).toBe(1);
      expect(metrics.perChatLimitHits).toBe(1);
    });
  });

  describe('acquire()', () => {
    test('should not throw for allowed request', () => {
      expect(() => rateLimiter.acquire(12345)).not.toThrow();
    });

    test('should throw TelegramRateLimitError for blocked request', () => {
      rateLimiter.acquire(12345); // First request

      expect(() => rateLimiter.acquire(12345)).toThrow(TelegramRateLimitError);
    });

    test('should include retryAfter in error', () => {
      rateLimiter.acquire(12345);

      try {
        rateLimiter.acquire(12345);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TelegramRateLimitError);
        expect(error.retryAfter).toBeDefined();
        expect(error.details.chatId).toBe(12345);
      }
    });
  });

  describe('waitForSlot()', () => {
    test('should return true immediately for first request', async () => {
      const result = await rateLimiter.waitForSlot(12345, 1000);

      expect(result).toBe(true);
    });

    test('should timeout if slot not available', async () => {
      // Use very short window for test
      const fastLimiter = new TelegramRateLimiter({
        perChatLimit: 1,
        perChatWindow: 5000 // 5 seconds
      });

      fastLimiter.acquire(12345);

      const start = Date.now();
      const result = await fastLimiter.waitForSlot(12345, 100); // 100ms timeout
      const elapsed = Date.now() - start;

      expect(result).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200);

      fastLimiter.shutdown();
    });

    test('should wait and acquire slot when available', async () => {
      // Use very short window for test
      const fastLimiter = new TelegramRateLimiter({
        perChatLimit: 1,
        perChatWindow: 100 // 100ms window
      });

      fastLimiter.acquire(12345);

      const start = Date.now();
      const result = await fastLimiter.waitForSlot(12345, 500);
      const elapsed = Date.now() - start;

      expect(result).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(100);

      fastLimiter.shutdown();
    });
  });

  describe('token refill', () => {
    test('should refill tokens over time', async () => {
      // Use fast refill for testing
      const fastLimiter = new TelegramRateLimiter({
        globalLimit: 10,
        globalWindow: 100, // 100ms
        perChatLimit: 1,
        perChatWindow: 100
      });

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        fastLimiter.checkLimit(i);
      }

      // Should be blocked
      expect(fastLimiter.checkLimit(99).allowed).toBe(false);

      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed now
      expect(fastLimiter.checkLimit(100).allowed).toBe(true);

      fastLimiter.shutdown();
    });
  });

  describe('cleanup()', () => {
    test('should remove stale chat buckets', () => {
      rateLimiter.checkLimit(11111);
      rateLimiter.checkLimit(22222);

      expect(rateLimiter.chatBuckets.size).toBe(2);

      // Manually set lastRefill to past
      const bucket = rateLimiter.chatBuckets.get(11111);
      bucket.lastRefill = Date.now() - (15 * 60 * 1000); // 15 minutes ago

      rateLimiter.cleanup();

      expect(rateLimiter.chatBuckets.size).toBe(1);
      expect(rateLimiter.chatBuckets.has(11111)).toBe(false);
      expect(rateLimiter.chatBuckets.has(22222)).toBe(true);
    });
  });

  describe('getMetrics()', () => {
    test('should return all metrics', () => {
      rateLimiter.checkLimit(11111);
      rateLimiter.checkLimit(11111); // Blocked

      const metrics = rateLimiter.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.allowedRequests).toBe(1);
      expect(metrics.rateLimitedRequests).toBe(1);
      expect(metrics.globalTokens).toBeDefined();
      expect(metrics.activeChatBuckets).toBe(1);
      expect(metrics.hitRate).toBe('50.00%');
    });

    test('should show 0% hit rate with no requests', () => {
      const metrics = rateLimiter.getMetrics();

      expect(metrics.hitRate).toBe('0%');
    });
  });

  describe('resetMetrics()', () => {
    test('should reset all metrics to zero', () => {
      rateLimiter.checkLimit(11111);
      rateLimiter.checkLimit(11111);

      rateLimiter.resetMetrics();

      const metrics = rateLimiter.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.allowedRequests).toBe(0);
      expect(metrics.rateLimitedRequests).toBe(0);
    });
  });

  describe('shutdown()', () => {
    test('should clear interval and buckets', () => {
      rateLimiter.checkLimit(11111);

      expect(rateLimiter.chatBuckets.size).toBe(1);
      expect(rateLimiter.cleanupInterval).not.toBeNull();

      rateLimiter.shutdown();

      expect(rateLimiter.chatBuckets.size).toBe(0);
      expect(rateLimiter.cleanupInterval).toBeNull();
    });
  });

  describe('concurrent requests', () => {
    test('should handle concurrent requests correctly', async () => {
      const results = await Promise.all([
        Promise.resolve(rateLimiter.checkLimit(11111)),
        Promise.resolve(rateLimiter.checkLimit(22222)),
        Promise.resolve(rateLimiter.checkLimit(33333)),
        Promise.resolve(rateLimiter.checkLimit(44444)),
        Promise.resolve(rateLimiter.checkLimit(55555))
      ]);

      // All should be allowed (different chats)
      expect(results.every(r => r.allowed)).toBe(true);
    });

    test('should block concurrent requests to same chat', async () => {
      const results = [];

      // First request
      results.push(rateLimiter.checkLimit(12345));

      // Concurrent requests to same chat
      results.push(rateLimiter.checkLimit(12345));
      results.push(rateLimiter.checkLimit(12345));

      expect(results[0].allowed).toBe(true);
      expect(results[1].allowed).toBe(false);
      expect(results[2].allowed).toBe(false);
    });
  });
});
