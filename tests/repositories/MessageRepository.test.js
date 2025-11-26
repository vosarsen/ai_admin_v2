/**
 * MessageRepository Integration Tests
 *
 * Tests message repository methods against production Timeweb PostgreSQL
 * Ensures message activity checking works correctly for notification deduplication
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- MessageRepository.test.js
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const MessageRepository = require('../../src/repositories/MessageRepository');
const { TEST_MARKERS } = require('../helpers/db-helper');
const postgres = require('../../src/database/postgres');

describe('MessageRepository Integration Tests', () => {
  let repo;

  // Test data
  const TEST_PHONE = `${TEST_MARKERS.TEST_PHONE_PREFIX}msg`;
  const TEST_COMPANY_ID = parseInt(TEST_MARKERS.TEST_COMPANY_IDS[0]);

  beforeAll(async () => {
    repo = new MessageRepository(postgres);

    // Clean up any previous test data
    await postgres.query(
      `DELETE FROM messages WHERE phone LIKE $1`,
      [`${TEST_MARKERS.TEST_PHONE_PREFIX}%`]
    );

    console.log('Test environment prepared');
  });

  afterAll(async () => {
    // Cleanup test data
    await postgres.query(
      `DELETE FROM messages WHERE phone LIKE $1`,
      [`${TEST_MARKERS.TEST_PHONE_PREFIX}%`]
    );

    console.log('Test data cleaned up');
  });

  // Helper to insert test message
  async function insertTestMessage(phone, direction = 'incoming', minutesAgo = 0) {
    const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000);

    await postgres.query(
      `INSERT INTO messages (phone, company_id, direction, content, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [phone, TEST_COMPANY_ID, direction, 'Test message', createdAt]
    );
  }

  describe('findRecent()', () => {
    beforeAll(async () => {
      // Create test messages with different timestamps
      await insertTestMessage(`${TEST_PHONE}1`, 'incoming', 2);  // 2 minutes ago
      await insertTestMessage(`${TEST_PHONE}1`, 'incoming', 10); // 10 minutes ago
      await insertTestMessage(`${TEST_PHONE}1`, 'outgoing', 1);  // 1 minute ago (outgoing)
      await insertTestMessage(`${TEST_PHONE}2`, 'incoming', 30); // Different phone, 30 min ago
    });

    test('should find recent incoming messages', async () => {
      const since = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const messages = await repo.findRecent(`${TEST_PHONE}1`, since);

      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(1); // Only 1 incoming within 5 min
      expect(messages[0].direction).toBe('incoming');
    });

    test('should accept Date object for since parameter', async () => {
      const since = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      const messages = await repo.findRecent(`${TEST_PHONE}1`, since);

      expect(messages.length).toBe(2); // Both incoming messages within 15 min
    });

    test('should accept ISO string for since parameter', async () => {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const messages = await repo.findRecent(`${TEST_PHONE}1`, since);

      expect(messages.length).toBe(2);
    });

    test('should only return incoming messages', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const messages = await repo.findRecent(`${TEST_PHONE}1`, since);

      messages.forEach(msg => {
        expect(msg.direction).toBe('incoming');
      });
    });

    test('should return empty array for non-existing phone', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const messages = await repo.findRecent('non_existing_phone', since);

      expect(messages).toEqual([]);
    });

    test('should limit to 1 result', async () => {
      const since = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const messages = await repo.findRecent(`${TEST_PHONE}1`, since);

      expect(messages.length).toBeLessThanOrEqual(1);
    });

    test('should order by created_at DESC (most recent first)', async () => {
      // This test verifies the query returns the MOST RECENT message
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const messages = await repo.findRecent(`${TEST_PHONE}1`, since);

      if (messages.length > 0) {
        // Should be the 2-minute-ago message, not 10-minute-ago
        const msgTime = new Date(messages[0].created_at).getTime();
        const twoMinAgo = Date.now() - 3 * 60 * 1000; // Allow 3 min for test timing
        expect(msgTime).toBeGreaterThan(twoMinAgo);
      }
    });
  });

  describe('hasRecentActivity()', () => {
    beforeAll(async () => {
      // Create message 3 minutes ago
      await insertTestMessage(`${TEST_PHONE}3`, 'incoming', 3);
    });

    test('should return true when recent activity exists', async () => {
      const hasActivity = await repo.hasRecentActivity(`${TEST_PHONE}3`, 5); // Check 5 min
      expect(hasActivity).toBe(true);
    });

    test('should return false when no recent activity', async () => {
      const hasActivity = await repo.hasRecentActivity(`${TEST_PHONE}3`, 1); // Check only 1 min
      expect(hasActivity).toBe(false);
    });

    test('should return false for non-existing phone', async () => {
      const hasActivity = await repo.hasRecentActivity('non_existing_phone', 60);
      expect(hasActivity).toBe(false);
    });

    test('should use default 5 minutes if not specified', async () => {
      // Message is 3 minutes ago, default 5 min window should find it
      const hasActivity = await repo.hasRecentActivity(`${TEST_PHONE}3`);
      expect(hasActivity).toBe(true);
    });

    test('should handle edge case of 0 minutes', async () => {
      const hasActivity = await repo.hasRecentActivity(`${TEST_PHONE}3`, 0);
      expect(hasActivity).toBe(false);
    });
  });

  describe('Notification Deduplication Flow', () => {
    test('should support notification skip decision flow', async () => {
      const phone = `${TEST_PHONE}flow`;

      // Scenario 1: No recent activity - should send notification
      const shouldSend1 = !(await repo.hasRecentActivity(phone, 5));
      expect(shouldSend1).toBe(true);

      // Client sends message
      await insertTestMessage(phone, 'incoming', 0); // Just now

      // Scenario 2: Recent activity - should skip notification
      const shouldSend2 = !(await repo.hasRecentActivity(phone, 5));
      expect(shouldSend2).toBe(false);

      // Wait time passes (simulated by old message)
      await postgres.query(
        `DELETE FROM messages WHERE phone = $1`,
        [phone]
      );
      await insertTestMessage(phone, 'incoming', 10); // 10 minutes ago

      // Scenario 3: Activity outside window - should send notification
      const shouldSend3 = !(await repo.hasRecentActivity(phone, 5));
      expect(shouldSend3).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should execute findRecent quickly', async () => {
      const start = Date.now();
      const since = new Date(Date.now() - 5 * 60 * 1000);

      await repo.findRecent(`${TEST_PHONE}1`, since);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should be < 100ms
    });

    test('should execute hasRecentActivity quickly', async () => {
      const start = Date.now();

      await repo.hasRecentActivity(`${TEST_PHONE}1`, 5);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should be < 100ms
    });
  });
});
