/**
 * WebhookEventsRepository Integration Tests
 *
 * Tests webhook event repository methods against production Timeweb PostgreSQL
 * Ensures event deduplication and tracking works correctly
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- WebhookEventsRepository.test.js
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const WebhookEventsRepository = require('../../src/repositories/WebhookEventsRepository');
const { TEST_MARKERS } = require('../helpers/db-helper');
const postgres = require('../../src/database/postgres');

describe('WebhookEventsRepository Integration Tests', () => {
  let repo;

  // Test data
  const TEST_EVENT_PREFIX = 'test_event_';
  const TEST_COMPANY_ID = parseInt(TEST_MARKERS.TEST_COMPANY_IDS[0]);

  beforeAll(async () => {
    repo = new WebhookEventsRepository(postgres);

    // Clean up any previous test data
    await postgres.query(
      `DELETE FROM webhook_events WHERE event_id LIKE $1`,
      [`${TEST_EVENT_PREFIX}%`]
    );

    console.log('Test environment prepared');
  });

  afterAll(async () => {
    // Cleanup test data
    await postgres.query(
      `DELETE FROM webhook_events WHERE event_id LIKE $1`,
      [`${TEST_EVENT_PREFIX}%`]
    );

    console.log('Test data cleaned up');
  });

  describe('insert()', () => {
    test('should successfully insert a new webhook event', async () => {
      const eventId = `${TEST_EVENT_PREFIX}${Date.now()}_insert`;

      const event = await repo.insert({
        event_id: eventId,
        event_type: 'record_created',
        company_id: TEST_COMPANY_ID,
        record_id: 12345,
        payload: { test: 'data', action: 'create' }
      });

      expect(event).not.toBeNull();
      expect(event.id).toBeDefined();
      expect(event.event_id).toBe(eventId);
      expect(event.event_type).toBe('record_created');
      expect(event.company_id).toBe(TEST_COMPANY_ID);
      expect(event.record_id).toBe(12345);
      expect(event.payload).toEqual({ test: 'data', action: 'create' });
      expect(event.created_at).toBeDefined();
      expect(event.processed_at).toBeNull();
    });

    test('should insert event without record_id (optional)', async () => {
      const eventId = `${TEST_EVENT_PREFIX}${Date.now()}_no_record`;

      const event = await repo.insert({
        event_id: eventId,
        event_type: 'company_updated',
        company_id: TEST_COMPANY_ID,
        payload: { test: 'data' }
      });

      expect(event).not.toBeNull();
      expect(event.record_id).toBeNull();
    });

    test('should throw error for duplicate event_id', async () => {
      const eventId = `${TEST_EVENT_PREFIX}${Date.now()}_duplicate`;

      // First insert should succeed
      await repo.insert({
        event_id: eventId,
        event_type: 'record_created',
        company_id: TEST_COMPANY_ID,
        payload: { first: true }
      });

      // Second insert should fail due to UNIQUE constraint
      await expect(repo.insert({
        event_id: eventId,
        event_type: 'record_updated',
        company_id: TEST_COMPANY_ID,
        payload: { second: true }
      })).rejects.toThrow();
    });
  });

  describe('exists()', () => {
    test('should return true for existing event', async () => {
      const eventId = `${TEST_EVENT_PREFIX}${Date.now()}_exists`;

      await repo.insert({
        event_id: eventId,
        event_type: 'record_created',
        company_id: TEST_COMPANY_ID,
        payload: {}
      });

      const exists = await repo.exists(eventId);
      expect(exists).toBe(true);
    });

    test('should return false for non-existing event', async () => {
      const exists = await repo.exists('non_existing_event_id_12345');
      expect(exists).toBe(false);
    });
  });

  describe('markProcessed()', () => {
    test('should mark event as processed', async () => {
      const eventId = `${TEST_EVENT_PREFIX}${Date.now()}_mark`;

      // Create event
      await repo.insert({
        event_id: eventId,
        event_type: 'record_created',
        company_id: TEST_COMPANY_ID,
        payload: {}
      });

      // Verify not processed yet
      const before = await postgres.query(
        'SELECT processed_at FROM webhook_events WHERE event_id = $1',
        [eventId]
      );
      expect(before.rows[0].processed_at).toBeNull();

      // Mark as processed
      await repo.markProcessed(eventId);

      // Verify processed
      const after = await postgres.query(
        'SELECT processed_at FROM webhook_events WHERE event_id = $1',
        [eventId]
      );
      expect(after.rows[0].processed_at).not.toBeNull();
    });

    test('should not throw for non-existing event', async () => {
      // markProcessed should silently do nothing for non-existing events
      await expect(repo.markProcessed('non_existing_event_xyz')).resolves.not.toThrow();
    });
  });

  describe('Event Deduplication Flow', () => {
    test('should support full deduplication workflow', async () => {
      const eventId = `${TEST_EVENT_PREFIX}${Date.now()}_flow`;

      // 1. Check event doesn't exist
      const existsBefore = await repo.exists(eventId);
      expect(existsBefore).toBe(false);

      // 2. Insert event
      const event = await repo.insert({
        event_id: eventId,
        event_type: 'record_created',
        company_id: TEST_COMPANY_ID,
        record_id: 99999,
        payload: { test: 'flow' }
      });
      expect(event).not.toBeNull();

      // 3. Check event now exists
      const existsAfter = await repo.exists(eventId);
      expect(existsAfter).toBe(true);

      // 4. Process event
      await repo.markProcessed(eventId);

      // 5. Verify processed timestamp set
      const result = await postgres.query(
        'SELECT processed_at FROM webhook_events WHERE event_id = $1',
        [eventId]
      );
      expect(result.rows[0].processed_at).not.toBeNull();
    });
  });
});
