/**
 * AppointmentsCacheRepository Integration Tests
 *
 * Tests appointments cache repository methods against production Timeweb PostgreSQL
 * Ensures webhook appointment caching works correctly
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- AppointmentsCacheRepository.test.js
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const AppointmentsCacheRepository = require('../../src/repositories/AppointmentsCacheRepository');
const { TEST_MARKERS } = require('../helpers/db-helper');
const postgres = require('../../src/database/postgres');

describe('AppointmentsCacheRepository Integration Tests', () => {
  let repo;

  // Test data - use yclients_record_id range 9900000+ for tests
  const TEST_RECORD_BASE = 9900000;
  const TEST_COMPANY_ID = parseInt(TEST_MARKERS.TEST_COMPANY_IDS[0]);
  const TEST_PHONE = `${TEST_MARKERS.TEST_PHONE_PREFIX}001`;

  beforeAll(async () => {
    repo = new AppointmentsCacheRepository(postgres);

    // Clean up any previous test data
    await postgres.query(
      `DELETE FROM appointments_cache WHERE yclients_record_id >= $1`,
      [TEST_RECORD_BASE]
    );

    console.log('Test environment prepared');
  });

  afterAll(async () => {
    // Cleanup test data
    await postgres.query(
      `DELETE FROM appointments_cache WHERE yclients_record_id >= $1`,
      [TEST_RECORD_BASE]
    );

    console.log('Test data cleaned up');
  });

  describe('insert()', () => {
    test('should successfully insert new appointment', async () => {
      const recordId = TEST_RECORD_BASE + 1;
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow

      const appointment = await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        client_id: 12345,
        client_phone: TEST_PHONE,
        service_id: 100,
        staff_id: 200,
        appointment_datetime: futureDate,
        cost: 1500,
        status: 'confirmed',
        raw_data: { test: 'data' }
      });

      expect(appointment).not.toBeNull();
      expect(appointment.id).toBeDefined();
      expect(appointment.yclients_record_id).toBe(recordId);
      expect(appointment.company_id).toBe(TEST_COMPANY_ID);
      expect(appointment.client_phone).toBe(TEST_PHONE);
      expect(appointment.cost).toBe('1500.00');
      expect(appointment.status).toBe('confirmed');
      expect(appointment.deleted).toBe(false);
      expect(appointment.is_cancelled).toBe(false);
    });

    test('should extract client_phone from raw_data if not provided', async () => {
      const recordId = TEST_RECORD_BASE + 2;

      const appointment = await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        raw_data: {
          client: {
            phone: '79001234567'
          }
        }
      });

      expect(appointment.client_phone).toBe('79001234567');
    });

    test('should upsert on conflict (update existing)', async () => {
      const recordId = TEST_RECORD_BASE + 3;

      // First insert
      await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        status: 'confirmed',
        cost: 1000
      });

      // Second insert should update
      const updated = await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        status: 'waiting',
        cost: 1500
      });

      expect(updated.status).toBe('waiting');
      expect(updated.cost).toBe('1500.00');

      // Verify only one record exists
      const count = await postgres.query(
        'SELECT COUNT(*) FROM appointments_cache WHERE yclients_record_id = $1',
        [recordId]
      );
      expect(parseInt(count.rows[0].count)).toBe(1);
    });

    test('should use default values for optional fields', async () => {
      const recordId = TEST_RECORD_BASE + 4;

      const appointment = await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID
      });

      expect(appointment.cost).toBe('0.00');
      expect(appointment.status).toBe('confirmed');
    });
  });

  describe('findByRecordId()', () => {
    test('should find existing appointment', async () => {
      const recordId = TEST_RECORD_BASE + 10;

      await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        status: 'confirmed'
      });

      const found = await repo.findByRecordId(recordId);

      expect(found).not.toBeNull();
      expect(found.yclients_record_id).toBe(recordId);
    });

    test('should return null for non-existing record', async () => {
      const found = await repo.findByRecordId(9999999);
      expect(found).toBeNull();
    });
  });

  describe('updateByRecordId()', () => {
    test('should update appointment fields', async () => {
      const recordId = TEST_RECORD_BASE + 20;

      await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        status: 'confirmed',
        cost: 1000
      });

      const updated = await repo.updateByRecordId(recordId, {
        status: 'waiting',
        cost: 1500
      });

      expect(updated.status).toBe('waiting');
      expect(updated.cost).toBe('1500.00');
      expect(updated.updated_at).toBeDefined();
    });

    test('should handle raw_data JSON serialization', async () => {
      const recordId = TEST_RECORD_BASE + 21;

      await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID
      });

      const updated = await repo.updateByRecordId(recordId, {
        raw_data: { updated: true, timestamp: Date.now() }
      });

      expect(updated.raw_data.updated).toBe(true);
    });

    test('should return null for non-existing record', async () => {
      const result = await repo.updateByRecordId(9999999, { status: 'cancelled' });
      expect(result).toBeNull();
    });
  });

  describe('markCancelled()', () => {
    test('should mark appointment as cancelled', async () => {
      const recordId = TEST_RECORD_BASE + 30;

      await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        status: 'confirmed'
      });

      const cancelled = await repo.markCancelled(recordId, 'Client requested');

      expect(cancelled.is_cancelled).toBe(true);
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellation_reason).toBe('Client requested');
    });

    test('should work without reason', async () => {
      const recordId = TEST_RECORD_BASE + 31;

      await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID
      });

      const cancelled = await repo.markCancelled(recordId);

      expect(cancelled.is_cancelled).toBe(true);
      expect(cancelled.cancellation_reason).toBeNull();
    });
  });

  describe('softDelete()', () => {
    test('should soft delete appointment', async () => {
      const recordId = TEST_RECORD_BASE + 40;

      await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID
      });

      const deleted = await repo.softDelete(recordId);

      expect(deleted.deleted).toBe(true);
      expect(deleted.updated_at).toBeDefined();

      // Verify record still exists
      const found = await repo.findByRecordId(recordId);
      expect(found).not.toBeNull();
      expect(found.deleted).toBe(true);
    });
  });

  describe('findActive()', () => {
    beforeAll(async () => {
      // Create test data
      const baseId = TEST_RECORD_BASE + 50;

      // Active appointment
      await repo.insert({
        yclients_record_id: baseId,
        company_id: TEST_COMPANY_ID,
        status: 'confirmed'
      });

      // Cancelled appointment
      await repo.insert({
        yclients_record_id: baseId + 1,
        company_id: TEST_COMPANY_ID,
        is_cancelled: true,
        status: 'cancelled'
      });

      // Deleted appointment
      const deleted = await repo.insert({
        yclients_record_id: baseId + 2,
        company_id: TEST_COMPANY_ID
      });
      await repo.softDelete(deleted.yclients_record_id);
    });

    test('should return only active appointments (not deleted, not cancelled)', async () => {
      const active = await repo.findActive(TEST_COMPANY_ID);

      expect(Array.isArray(active)).toBe(true);

      // All returned should be active
      active.forEach(apt => {
        expect(apt.deleted).toBe(false);
        expect(apt.is_cancelled).toBe(false);
      });
    });

    test('should filter by company_id', async () => {
      const active = await repo.findActive(TEST_COMPANY_ID);

      active.forEach(apt => {
        expect(apt.company_id).toBe(TEST_COMPANY_ID);
      });
    });

    test('should return all active if company_id is null', async () => {
      const active = await repo.findActive();

      expect(Array.isArray(active)).toBe(true);
      // Should return all active appointments (multiple companies)
    });
  });

  describe('findFutureActive()', () => {
    beforeAll(async () => {
      const baseId = TEST_RECORD_BASE + 60;
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Future appointment
      await repo.insert({
        yclients_record_id: baseId,
        company_id: TEST_COMPANY_ID,
        appointment_datetime: tomorrow,
        status: 'confirmed'
      });

      // Past appointment
      await repo.insert({
        yclients_record_id: baseId + 1,
        company_id: TEST_COMPANY_ID,
        appointment_datetime: yesterday,
        status: 'confirmed'
      });

      // Future but deleted
      const deleted = await repo.insert({
        yclients_record_id: baseId + 2,
        company_id: TEST_COMPANY_ID,
        appointment_datetime: tomorrow
      });
      await repo.softDelete(deleted.yclients_record_id);
    });

    test('should return only future active appointments', async () => {
      const future = await repo.findFutureActive();

      expect(Array.isArray(future)).toBe(true);

      const now = new Date();
      future.forEach(apt => {
        expect(apt.deleted).toBe(false);
        expect(new Date(apt.appointment_datetime).getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000); // 1s tolerance
      });
    });

    test('should order by appointment_datetime ASC', async () => {
      const future = await repo.findFutureActive();

      if (future.length > 1) {
        for (let i = 0; i < future.length - 1; i++) {
          const current = new Date(future[i].appointment_datetime).getTime();
          const next = new Date(future[i + 1].appointment_datetime).getTime();
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });
  });

  describe('Booking Lifecycle Flow', () => {
    test('should support full booking lifecycle', async () => {
      const recordId = TEST_RECORD_BASE + 100;
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      // 1. Create booking
      const created = await repo.insert({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        appointment_datetime: futureDate,
        status: 'confirmed'
      });
      expect(created).not.toBeNull();
      expect(created.status).toBe('confirmed');

      // 2. Update (reschedule)
      const rescheduled = await repo.updateByRecordId(recordId, {
        appointment_datetime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      });
      expect(rescheduled.appointment_datetime).not.toBe(created.appointment_datetime);

      // 3. Verify in active list
      const active = await repo.findActive(TEST_COMPANY_ID);
      const found = active.find(a => a.yclients_record_id === recordId);
      expect(found).toBeDefined();

      // 4. Cancel
      const cancelled = await repo.markCancelled(recordId, 'Client no-show');
      expect(cancelled.is_cancelled).toBe(true);

      // 5. Verify not in active list anymore
      const activeAfter = await repo.findActive(TEST_COMPANY_ID);
      const notFound = activeAfter.find(a => a.yclients_record_id === recordId);
      expect(notFound).toBeUndefined();
    });
  });
});
