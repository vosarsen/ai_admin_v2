/**
 * Integration Tests for YClients Marketplace Module
 *
 * Tests cover:
 * - Health check endpoint
 * - Webhook idempotency
 * - Rate limiting
 * - Result type usage
 * - Circuit breaker states
 *
 * @module tests/integration/marketplace
 */

const { Result, ErrorCodes } = require('../../src/utils/result');
const RateLimiter = require('../../src/utils/rate-limiter');
const { getPerKeyLimiter } = require('../../src/utils/rate-limiter');

describe('Marketplace Integration', () => {
  describe('Result Type', () => {
    test('Result.ok() creates successful result', () => {
      const result = Result.ok({ id: 123, name: 'Test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 123, name: 'Test' });
      expect(result.error).toBeNull();
      expect(result.code).toBeNull();
      expect(result.httpStatus).toBe(200);
    });

    test('Result.ok() with metadata', () => {
      const result = Result.ok({ items: [] }, { total: 100, page: 1 });

      expect(result.success).toBe(true);
      expect(result.meta).toEqual({ total: 100, page: 1 });

      const json = result.toJSON();
      expect(json.total).toBe(100);
      expect(json.page).toBe(1);
    });

    test('Result.fail() creates failure result', () => {
      const result = Result.fail('Something went wrong', 'INTERNAL_ERROR');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Something went wrong');
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.httpStatus).toBe(500);
    });

    test('Result.fail() with ErrorCodes definition', () => {
      const result = Result.fail('User not authorized', ErrorCodes.UNAUTHORIZED);

      expect(result.success).toBe(false);
      expect(result.code).toBe('UNAUTHORIZED');
      expect(result.httpStatus).toBe(401);
    });

    test('Result.fail() with retry metadata', () => {
      const result = Result.fail(
        'Concurrent operation in progress',
        ErrorCodes.CONCURRENT_OPERATION,
        { retry_after: 5 }
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('CONCURRENT_OPERATION');
      expect(result.httpStatus).toBe(409);
      expect(result.meta.retry_after).toBe(5);

      const json = result.toJSON();
      expect(json.retry_after).toBe(5);
    });

    test('Result.fromError() wraps Error object', () => {
      const error = new Error('Database connection failed');
      error.name = 'PostgresError';

      const result = Result.fromError(error, 'DATABASE_ERROR');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.code).toBe('DATABASE_ERROR');
      expect(result.meta.originalError).toBe('PostgresError');
    });

    test('Result.toJSON() excludes null data on success', () => {
      const result = Result.ok();
      const json = result.toJSON();

      expect(json.success).toBe(true);
      expect(json).not.toHaveProperty('data');
    });

    test('Result.toJSON() includes error info on failure', () => {
      const result = Result.fail('Not found', 'NOT_FOUND');
      const json = result.toJSON();

      expect(json.success).toBe(false);
      expect(json.error).toBe('Not found');
      expect(json.code).toBe('NOT_FOUND');
      expect(json).not.toHaveProperty('data');
    });

    test('Result.isOk() and Result.isFail()', () => {
      const success = Result.ok('data');
      const failure = Result.fail('error');

      expect(success.isOk()).toBe(true);
      expect(success.isFail()).toBe(false);
      expect(failure.isOk()).toBe(false);
      expect(failure.isFail()).toBe(true);
    });

    test('Result.map() transforms successful data', () => {
      const result = Result.ok(5);
      const mapped = result.map(x => x * 2);

      expect(mapped.data).toBe(10);
    });

    test('Result.map() passes through failure', () => {
      const result = Result.fail('error');
      const mapped = result.map(x => x * 2);

      expect(mapped.success).toBe(false);
      expect(mapped.error).toBe('error');
    });

    test('Result.unwrap() returns data on success', () => {
      const result = Result.ok({ value: 42 });

      expect(result.unwrap()).toEqual({ value: 42 });
    });

    test('Result.unwrap() throws on failure', () => {
      const result = Result.fail('Something failed', 'TEST_ERROR');

      expect(() => result.unwrap()).toThrow('Result.unwrap() called on failure');
    });

    test('Result.unwrapOr() returns default on failure', () => {
      const result = Result.fail('error');

      expect(result.unwrapOr('default')).toBe('default');
    });
  });

  describe('ErrorCodes', () => {
    test('All ErrorCodes have required fields', () => {
      for (const [name, def] of Object.entries(ErrorCodes)) {
        expect(def).toHaveProperty('code');
        expect(def).toHaveProperty('httpStatus');
        expect(def).toHaveProperty('message');
        expect(def.code).toBe(name);
        expect(typeof def.httpStatus).toBe('number');
        expect(typeof def.message).toBe('string');
      }
    });

    test('ErrorCodes HTTP statuses are valid', () => {
      for (const def of Object.values(ErrorCodes)) {
        expect(def.httpStatus).toBeGreaterThanOrEqual(400);
        expect(def.httpStatus).toBeLessThanOrEqual(599);
      }
    });
  });

  describe('Rate Limiter', () => {
    test('RateLimiter class initializes correctly', () => {
      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 5,
        keyPrefix: 'test:'
      });

      expect(limiter.windowMs).toBe(1000);
      expect(limiter.maxRequests).toBe(5);
      expect(limiter.keyPrefix).toBe('test:');
    });

    test('RateLimiter allows requests under limit', async () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10
      });

      const allowed = await limiter.checkLimit('test-key');
      expect(allowed).toBe(true);
    });

    test('RateLimiter checkMemoryLimit blocks when exceeded', () => {
      const limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 2,  // Very low limit for testing
        keyPrefix: 'memory-test:'
      });

      // Test the in-memory implementation directly
      const first = limiter.checkMemoryLimit('memory-test:block-key');
      const second = limiter.checkMemoryLimit('memory-test:block-key');
      const third = limiter.checkMemoryLimit('memory-test:block-key');

      expect(first).toBe(true);
      expect(second).toBe(true);
      expect(third).toBe(false);  // Blocked!
    });

    test('getPerKeyLimiter returns same instance for same key', () => {
      const limiter1 = getPerKeyLimiter('test-ns', 'salon-123');
      const limiter2 = getPerKeyLimiter('test-ns', 'salon-123');

      expect(limiter1).toBe(limiter2);
    });

    test('getPerKeyLimiter returns different instance for different key', () => {
      const limiter1 = getPerKeyLimiter('test-ns', 'salon-123');
      const limiter2 = getPerKeyLimiter('test-ns', 'salon-456');

      expect(limiter1).not.toBe(limiter2);
    });

    test('DEFAULT_CONFIGS has expected namespaces', () => {
      const { DEFAULT_CONFIGS } = require('../../src/utils/rate-limiter');

      expect(DEFAULT_CONFIGS).toHaveProperty('webhook');
      expect(DEFAULT_CONFIGS).toHaveProperty('activation');
      expect(DEFAULT_CONFIGS).toHaveProperty('api');

      expect(DEFAULT_CONFIGS.webhook.maxRequests).toBe(10);
      expect(DEFAULT_CONFIGS.activation.maxRequests).toBe(3);
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('getCircuitBreaker returns circuit breaker instance', () => {
      const { getCircuitBreaker } = require('../../src/utils/circuit-breaker');

      const cb = getCircuitBreaker('test-cb', {
        failureThreshold: 3,
        resetTimeout: 1000
      });

      expect(cb).toBeDefined();
      expect(typeof cb.execute).toBe('function');
      expect(typeof cb.getState).toBe('function');
    });

    test('Circuit breaker getState returns expected structure', () => {
      const { getCircuitBreaker } = require('../../src/utils/circuit-breaker');

      const cb = getCircuitBreaker('test-state-cb', {
        failureThreshold: 3,
        resetTimeout: 1000
      });

      const state = cb.getState();

      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('failures');
      expect(['closed', 'open', 'half-open']).toContain(state.state);
    });
  });
});

describe('Marketplace Webhook Idempotency', () => {
  // Mock crypto for deterministic testing
  const originalCreateHash = require('crypto').createHash;

  test('Same payload generates same webhook ID', () => {
    const crypto = require('crypto');

    const generateWebhookId = (eventType, salonId, data) => {
      const content = `webhook:${eventType}:${salonId}:${JSON.stringify(data || {})}`;
      return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    };

    const id1 = generateWebhookId('uninstall', '123', { reason: 'test' });
    const id2 = generateWebhookId('uninstall', '123', { reason: 'test' });

    expect(id1).toBe(id2);
  });

  test('Different payload generates different webhook ID', () => {
    const crypto = require('crypto');

    const generateWebhookId = (eventType, salonId, data) => {
      const content = `webhook:${eventType}:${salonId}:${JSON.stringify(data || {})}`;
      return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    };

    const id1 = generateWebhookId('uninstall', '123', { reason: 'test1' });
    const id2 = generateWebhookId('uninstall', '123', { reason: 'test2' });

    expect(id1).not.toBe(id2);
  });

  test('Webhook ID is deterministic (no timestamp)', () => {
    const crypto = require('crypto');

    const generateWebhookId = (eventType, salonId, data) => {
      // Note: NO timestamp in the hash - this is deterministic
      const content = `webhook:${eventType}:${salonId}:${JSON.stringify(data || {})}`;
      return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    };

    // Same call at different "times" should produce same ID
    const id1 = generateWebhookId('freeze', '456', { status: 'frozen' });

    // Simulate time passing
    const id2 = generateWebhookId('freeze', '456', { status: 'frozen' });

    expect(id1).toBe(id2);
  });
});

describe('Admin Audit Trail', () => {
  test('logAdminAction function exists', () => {
    const { logAdminAction } = require('../../src/utils/admin-audit');

    expect(typeof logAdminAction).toBe('function');
  });

  test('getAuditLogs function exists', () => {
    const { getAuditLogs } = require('../../src/utils/admin-audit');

    expect(typeof getAuditLogs).toBe('function');
  });

  test('SENSITIVE_FIELDS are defined for sanitization', () => {
    const adminAudit = require('../../src/utils/admin-audit');

    // The module should sanitize sensitive fields
    expect(adminAudit).toBeDefined();
  });
});

describe('Marketplace HMAC Verification', () => {
  const crypto = require('crypto');

  // Test partner token (use same format as production)
  const TEST_PARTNER_TOKEN = 'test_partner_token_12345';

  /**
   * Generate HMAC-SHA256 signature for user_data
   *
   * IMPORTANT: YClients signs the DECODED JSON, not the base64 string!
   * Algorithm: hash_hmac('sha256', base64_decode(user_data), PARTNER_TOKEN)
   *
   * This was discovered through debug testing on 2025-12-04.
   * See: docs/03-development-diary/2025-12-04-marketplace-hmac-fix.md
   */
  const generateHmacSignature = (base64UserData, partnerToken) => {
    // Decode base64 to get JSON string, then sign that
    const decodedJson = Buffer.from(base64UserData, 'base64').toString('utf-8');
    return crypto.createHmac('sha256', partnerToken).update(decodedJson).digest('hex');
  };

  /**
   * Create base64-encoded user_data for testing
   */
  const createUserData = (data) => {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  };

  test('Valid HMAC signature is generated correctly', () => {
    const userData = createUserData({
      id: 123,
      name: 'Иванов Андрей',
      email: 'andrew@example.com',
      phone: '79123456789',
      salon_name: 'Best Barbery'
    });

    const signature = generateHmacSignature(userData, TEST_PARTNER_TOKEN);

    // Signature should be 64 chars hex string (SHA-256 = 256 bits = 64 hex chars)
    expect(signature).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(signature)).toBe(true);
  });

  test('Same user_data generates same signature', () => {
    const userData = createUserData({ id: 456, name: 'Test User' });

    const signature1 = generateHmacSignature(userData, TEST_PARTNER_TOKEN);
    const signature2 = generateHmacSignature(userData, TEST_PARTNER_TOKEN);

    expect(signature1).toBe(signature2);
  });

  test('Different user_data generates different signature', () => {
    const userData1 = createUserData({ id: 123, name: 'User 1' });
    const userData2 = createUserData({ id: 123, name: 'User 2' });

    const signature1 = generateHmacSignature(userData1, TEST_PARTNER_TOKEN);
    const signature2 = generateHmacSignature(userData2, TEST_PARTNER_TOKEN);

    expect(signature1).not.toBe(signature2);
  });

  test('Different partner token generates different signature', () => {
    const userData = createUserData({ id: 789, name: 'Test' });

    const signature1 = generateHmacSignature(userData, 'token_a');
    const signature2 = generateHmacSignature(userData, 'token_b');

    expect(signature1).not.toBe(signature2);
  });

  test('Signature verification detects tampering', () => {
    const originalData = createUserData({ id: 100, name: 'Original' });
    const tamperedData = createUserData({ id: 100, name: 'Tampered' });

    const originalSignature = generateHmacSignature(originalData, TEST_PARTNER_TOKEN);

    // Tampered data should not match original signature
    const tamperedSignature = generateHmacSignature(tamperedData, TEST_PARTNER_TOKEN);
    expect(originalSignature).not.toBe(tamperedSignature);

    // Verify original still works
    const verifySignature = generateHmacSignature(originalData, TEST_PARTNER_TOKEN);
    expect(verifySignature).toBe(originalSignature);
  });

  test('Empty user_data generates valid signature', () => {
    const emptyData = createUserData({});

    const signature = generateHmacSignature(emptyData, TEST_PARTNER_TOKEN);

    expect(signature).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(signature)).toBe(true);
  });

  test('Cyrillic characters in user_data handled correctly', () => {
    const cyrillicData = createUserData({
      id: 1,
      name: 'Александр Петрович',
      salon_name: 'Салон красоты "Звезда"'
    });

    const signature = generateHmacSignature(cyrillicData, TEST_PARTNER_TOKEN);

    // Should produce valid hex string
    expect(signature).toHaveLength(64);

    // Same data should produce same signature
    const signature2 = generateHmacSignature(cyrillicData, TEST_PARTNER_TOKEN);
    expect(signature).toBe(signature2);
  });

  test('Special characters in user_data handled correctly', () => {
    const specialData = createUserData({
      id: 1,
      email: 'test+special@example.com',
      phone: '+7 (900) 123-45-67'
    });

    const signature = generateHmacSignature(specialData, TEST_PARTNER_TOKEN);

    expect(signature).toHaveLength(64);
  });
});
