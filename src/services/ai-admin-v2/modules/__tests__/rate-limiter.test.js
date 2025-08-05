const { RateLimiter, CompositeRateLimiter } = require('../rate-limiter');

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      windowMs: 1000, // 1 second
      maxRequests: 3,
      blockDuration: 2000 // 2 seconds
    });
  });

  afterEach(() => {
    limiter.stop();
  });

  describe('Basic rate limiting', () => {
    test('should allow requests within limit', async () => {
      const identifier = 'user1';

      for (let i = 0; i < 3; i++) {
        const allowed = await limiter.checkLimit(identifier);
        expect(allowed).toBe(true);
      }

      expect(limiter.getStats().allowedRequests).toBe(3);
    });

    test('should block requests exceeding limit', async () => {
      const identifier = 'user1';

      // First 3 requests should pass
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit(identifier);
      }

      // 4th request should fail
      await expect(limiter.checkLimit(identifier))
        .rejects
        .toThrow('Rate limit exceeded');

      expect(limiter.getStats().blockedRequests).toBe(1);
    });

    test('should reset after window expires', async () => {
      const identifier = 'user1';

      // Max out requests
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit(identifier);
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should allow new requests
      const allowed = await limiter.checkLimit(identifier);
      expect(allowed).toBe(true);
    });
  });

  describe('User blocking', () => {
    test('should block user after multiple violations', async () => {
      const identifier = 'user1';

      // Create 3 violations
      for (let violation = 0; violation < 3; violation++) {
        // Max out requests
        for (let i = 0; i < 3; i++) {
          await limiter.checkLimit(identifier);
        }

        // Try to exceed - this creates a violation
        try {
          await limiter.checkLimit(identifier);
        } catch (e) {}

        // If not the last violation, wait for window reset
        if (violation < 2) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }
      }

      // Try once more - user should be blocked after 3 violations
      await expect(limiter.checkLimit(identifier))
        .rejects
        .toThrow('Blocked');
    });

    test('should unblock user after block duration', async () => {
      const identifier = 'user1';

      // Block user directly
      limiter.blockUser(identifier, 100); // 100ms block

      // Should be blocked
      await expect(limiter.checkLimit(identifier))
        .rejects
        .toThrow('Blocked');

      // Wait for unblock
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed now
      const allowed = await limiter.checkLimit(identifier);
      expect(allowed).toBe(true);
    });

    test('should manually unblock user', () => {
      const identifier = 'user1';

      limiter.blockUser(identifier);
      expect(limiter.isBlocked(identifier)).toBe(true);

      limiter.unblockUser(identifier);
      expect(limiter.isBlocked(identifier)).toBe(false);
    });
  });

  describe('Remaining requests', () => {
    test('should correctly calculate remaining requests', async () => {
      const identifier = 'user1';

      expect(limiter.getRemainingRequests(identifier)).toBe(3);

      await limiter.checkLimit(identifier);
      expect(limiter.getRemainingRequests(identifier)).toBe(2);

      await limiter.checkLimit(identifier);
      expect(limiter.getRemainingRequests(identifier)).toBe(1);

      await limiter.checkLimit(identifier);
      expect(limiter.getRemainingRequests(identifier)).toBe(0);
    });
  });

  describe('Cleanup', () => {
    test('should clean up old records', async () => {
      const identifier = 'user1';

      await limiter.checkLimit(identifier);
      expect(limiter.storage.size).toBe(1);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger cleanup
      limiter.cleanup();

      // Empty records should be removed
      expect(limiter.storage.size).toBe(0);
    });

    test('should clean up expired blocks', () => {
      const identifier = 'user1';

      // Create expired block
      limiter.blockedUsers.set(identifier, {
        since: Date.now() - 10000,
        until: Date.now() - 5000,
        reason: 'test'
      });

      limiter.cleanup();

      expect(limiter.blockedUsers.size).toBe(0);
    });
  });

  describe('Statistics', () => {
    test('should track statistics correctly', async () => {
      const user1 = 'user1';
      const user2 = 'user2';

      // User 1: 2 allowed, 1 blocked
      await limiter.checkLimit(user1);
      await limiter.checkLimit(user1);
      await limiter.checkLimit(user1);
      try {
        await limiter.checkLimit(user1);
      } catch (e) {}

      // User 2: 1 allowed
      await limiter.checkLimit(user2);

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(5);
      expect(stats.allowedRequests).toBe(4);
      expect(stats.blockedRequests).toBe(1);
      expect(stats.activeUsers).toBe(2);
    });

    test('should reset statistics', async () => {
      await limiter.checkLimit('user1');

      limiter.resetStats();

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.allowedRequests).toBe(0);
      expect(stats.blockedRequests).toBe(0);
    });
  });

  describe('Clear functionality', () => {
    test('should clear all data', async () => {
      await limiter.checkLimit('user1');
      limiter.blockUser('user2');

      limiter.clear();

      expect(limiter.storage.size).toBe(0);
      expect(limiter.blockedUsers.size).toBe(0);
      expect(limiter.getStats().totalRequests).toBe(0);
    });
  });
});

describe('CompositeRateLimiter', () => {
  let composite;

  beforeEach(() => {
    composite = new CompositeRateLimiter();
  });

  afterEach(() => {
    composite.stopAll();
  });

  test('should check multiple limits', async () => {
    // Add two limiters with different configs
    composite.addLimiter('perSecond', { windowMs: 1000, maxRequests: 2 });
    composite.addLimiter('perMinute', { windowMs: 60000, maxRequests: 10 });

    const identifier = 'user1';

    // First 2 requests should pass both limits
    await composite.checkLimits(identifier);
    await composite.checkLimits(identifier);

    // 3rd request should fail the per-second limit
    await expect(composite.checkLimits(identifier))
      .rejects
      .toThrow('Rate limit exceeded');
  });

  test('should get all stats', async () => {
    composite.addLimiter('limiter1', { windowMs: 1000, maxRequests: 2 });
    composite.addLimiter('limiter2', { windowMs: 5000, maxRequests: 5 });

    await composite.checkLimits('user1');

    const stats = composite.getAllStats();
    expect(stats).toHaveProperty('limiter1');
    expect(stats).toHaveProperty('limiter2');
    expect(stats.limiter1.totalRequests).toBe(1);
    expect(stats.limiter2.totalRequests).toBe(1);
  });

  test('should stop all limiters', () => {
    const limiter1 = composite.addLimiter('limiter1', {});
    const limiter2 = composite.addLimiter('limiter2', {});

    composite.stopAll();

    expect(limiter1.cleanupInterval).toBeNull();
    expect(limiter2.cleanupInterval).toBeNull();
  });
});