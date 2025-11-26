/**
 * MarketplaceEventsRepository Integration Tests
 *
 * Tests marketplace event repository methods against production Timeweb PostgreSQL
 * Ensures event logging for YClients marketplace integrations works correctly
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- MarketplaceEventsRepository.test.js
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const MarketplaceEventsRepository = require('../../src/repositories/MarketplaceEventsRepository');
const { TEST_MARKERS } = require('../helpers/db-helper');
const postgres = require('../../src/database/postgres');

describe('MarketplaceEventsRepository Integration Tests', () => {
  let repo;

  // Test data - use salon_id range 9900000+ for tests
  const TEST_SALON_ID = 9900001;
  const TEST_COMPANY_ID = parseInt(TEST_MARKERS.TEST_COMPANY_IDS[0]);

  beforeAll(async () => {
    repo = new MarketplaceEventsRepository(postgres);

    // Clean up any previous test data
    await postgres.query(
      `DELETE FROM marketplace_events WHERE salon_id >= 9900000`
    );

    console.log('Test environment prepared');
  });

  afterAll(async () => {
    // Cleanup test data
    await postgres.query(
      `DELETE FROM marketplace_events WHERE salon_id >= 9900000`
    );

    console.log('Test data cleaned up');
  });

  describe('insert()', () => {
    test('should successfully insert marketplace event with company_id', async () => {
      const event = await repo.insert({
        company_id: TEST_COMPANY_ID,
        salon_id: TEST_SALON_ID,
        event_type: 'install',
        event_data: { version: '1.0', tariff: 'premium' }
      });

      expect(event).not.toBeNull();
      expect(event.id).toBeDefined();
      expect(event.company_id).toBe(TEST_COMPANY_ID.toString());
      expect(event.salon_id).toBe(TEST_SALON_ID);
      expect(event.event_type).toBe('install');
      expect(event.event_data).toEqual({ version: '1.0', tariff: 'premium' });
      expect(event.created_at).toBeDefined();
    });

    test('should insert event without company_id (new salon)', async () => {
      const event = await repo.insert({
        salon_id: TEST_SALON_ID + 1,
        event_type: 'install',
        event_data: { new_salon: true }
      });

      expect(event).not.toBeNull();
      expect(event.company_id).toBeNull();
      expect(event.salon_id).toBe(TEST_SALON_ID + 1);
    });

    test('should insert event without event_data (optional)', async () => {
      const event = await repo.insert({
        salon_id: TEST_SALON_ID + 2,
        event_type: 'uninstall'
      });

      expect(event).not.toBeNull();
      expect(event.event_data).toBeNull();
    });

    test('should insert multiple events for same salon', async () => {
      const salonId = TEST_SALON_ID + 10;

      const install = await repo.insert({
        salon_id: salonId,
        event_type: 'install',
        event_data: { step: 1 }
      });

      const payment = await repo.insert({
        salon_id: salonId,
        event_type: 'payment',
        event_data: { step: 2 }
      });

      expect(install).not.toBeNull();
      expect(payment).not.toBeNull();
      expect(install.id).not.toBe(payment.id);
    });
  });

  describe('findLatestByType()', () => {
    beforeAll(async () => {
      const salonId = TEST_SALON_ID + 20;

      // Create multiple events of same type
      await repo.insert({
        salon_id: salonId,
        event_type: 'payment',
        event_data: { amount: 100, order: 1 }
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await repo.insert({
        salon_id: salonId,
        event_type: 'payment',
        event_data: { amount: 200, order: 2 }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      await repo.insert({
        salon_id: salonId,
        event_type: 'payment',
        event_data: { amount: 300, order: 3 }
      });

      // Different type
      await repo.insert({
        salon_id: salonId,
        event_type: 'freeze'
      });
    });

    test('should find latest event of specific type', async () => {
      const latest = await repo.findLatestByType(TEST_SALON_ID + 20, 'payment');

      expect(latest).not.toBeNull();
      expect(latest.event_type).toBe('payment');
      expect(latest.event_data.order).toBe(3); // Latest should be order: 3
    });

    test('should return null for non-existing type', async () => {
      const result = await repo.findLatestByType(TEST_SALON_ID + 20, 'non_existing_type');
      expect(result).toBeNull();
    });

    test('should return null for non-existing salon', async () => {
      const result = await repo.findLatestByType(9999999, 'payment');
      expect(result).toBeNull();
    });
  });

  describe('findBySalonId()', () => {
    beforeAll(async () => {
      const salonId = TEST_SALON_ID + 30;

      await repo.insert({ salon_id: salonId, event_type: 'install' });
      await repo.insert({ salon_id: salonId, event_type: 'payment' });
      await repo.insert({ salon_id: salonId, event_type: 'freeze' });
    });

    test('should find all events for a salon', async () => {
      const events = await repo.findBySalonId(TEST_SALON_ID + 30);

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(3);
    });

    test('should order by created_at DESC', async () => {
      const events = await repo.findBySalonId(TEST_SALON_ID + 30);

      if (events.length > 1) {
        for (let i = 0; i < events.length - 1; i++) {
          const current = new Date(events[i].created_at).getTime();
          const next = new Date(events[i + 1].created_at).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    test('should return empty array for non-existing salon', async () => {
      const events = await repo.findBySalonId(9999999);
      expect(events).toEqual([]);
    });

    test('should support limit option', async () => {
      const events = await repo.findBySalonId(TEST_SALON_ID + 30, { limit: 2 });
      expect(events.length).toBe(2);
    });
  });

  describe('Marketplace Event Flow', () => {
    test('should support full marketplace lifecycle', async () => {
      const salonId = TEST_SALON_ID + 100;

      // 1. Install
      const install = await repo.insert({
        salon_id: salonId,
        event_type: 'install',
        event_data: { tariff: 'basic' }
      });
      expect(install).not.toBeNull();

      // 2. Payment
      const payment = await repo.insert({
        salon_id: salonId,
        event_type: 'payment',
        event_data: { amount: 990 }
      });
      expect(payment).not.toBeNull();

      // 3. Check latest payment
      const latestPayment = await repo.findLatestByType(salonId, 'payment');
      expect(latestPayment.event_data.amount).toBe(990);

      // 4. Uninstall
      const uninstall = await repo.insert({
        salon_id: salonId,
        event_type: 'uninstall',
        event_data: { reason: 'test complete' }
      });
      expect(uninstall).not.toBeNull();

      // 5. Get full history
      const history = await repo.findBySalonId(salonId);
      expect(history.length).toBe(3);
      expect(history[0].event_type).toBe('uninstall'); // Most recent first
    });
  });
});
