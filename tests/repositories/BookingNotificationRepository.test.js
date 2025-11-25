/**
 * BookingNotificationRepository Integration Tests
 *
 * Tests notification tracking repository methods against production Timeweb PostgreSQL
 * Ensures duplicate notification prevention works correctly
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- BookingNotificationRepository.test.js
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const BookingNotificationRepository = require('../../src/repositories/BookingNotificationRepository');
const { TEST_MARKERS } = require('../helpers/db-helper');
const postgres = require('../../src/database/postgres');

describe('BookingNotificationRepository Integration Tests', () => {
  let repo;

  // Test data
  const TEST_RECORD_ID = 9900001;
  const TEST_COMPANY_ID = parseInt(TEST_MARKERS.TEST_COMPANY_IDS[0]);
  const TEST_PHONE = `${TEST_MARKERS.TEST_PHONE_PREFIX}001`;

  beforeAll(async () => {
    repo = new BookingNotificationRepository(postgres);

    // Clean up any previous test data
    await postgres.query(
      `DELETE FROM booking_notifications
       WHERE phone LIKE $1 OR yclients_record_id >= 9900000`,
      [`${TEST_MARKERS.TEST_PHONE_PREFIX}%`]
    );

    console.log('Test environment prepared');
  });

  afterAll(async () => {
    // Cleanup test data
    await postgres.query(
      `DELETE FROM booking_notifications
       WHERE phone LIKE $1 OR yclients_record_id >= 9900000`,
      [`${TEST_MARKERS.TEST_PHONE_PREFIX}%`]
    );

    console.log('Test data cleaned up');
  });

  describe('create()', () => {
    test('should require yclients_record_id', async () => {
      await expect(repo.create({
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_day_before'
      })).rejects.toThrow('yclients_record_id is required');
    });

    test('should require company_id', async () => {
      await expect(repo.create({
        yclients_record_id: TEST_RECORD_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_day_before'
      })).rejects.toThrow('company_id is required');
    });

    test('should require phone', async () => {
      await expect(repo.create({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        notification_type: 'reminder_day_before'
      })).rejects.toThrow('phone is required');
    });

    test('should require notification_type', async () => {
      await expect(repo.create({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE
      })).rejects.toThrow('notification_type is required');
    });

    test('should successfully create notification', async () => {
      const notification = await repo.create({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_day_before',
        message: 'Test reminder message'
      });

      expect(notification).not.toBeNull();
      expect(notification.id).toBeDefined();
      expect(notification.yclients_record_id).toBe(TEST_RECORD_ID);
      expect(notification.company_id).toBe(TEST_COMPANY_ID);
      expect(notification.phone).toBe(TEST_PHONE);
      expect(notification.notification_type).toBe('reminder_day_before');
      expect(notification.message).toBe('Test reminder message');
      expect(notification.status).toBe('sent');
      expect(notification.notification_date).toBeDefined();
    });

    test('should return null for duplicate (same record, type, company, date)', async () => {
      // First create should succeed
      const first = await repo.create({
        yclients_record_id: TEST_RECORD_ID + 1,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_2hours',
        message: 'First reminder'
      });

      expect(first).not.toBeNull();

      // Second create with same key should return null (duplicate)
      const duplicate = await repo.create({
        yclients_record_id: TEST_RECORD_ID + 1,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_2hours',
        message: 'Duplicate reminder'
      });

      expect(duplicate).toBeNull();
    });

    test('should allow same record with different notification type', async () => {
      const recordId = TEST_RECORD_ID + 2;

      const dayBefore = await repo.create({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_day_before',
        message: 'Day before reminder'
      });

      const twoHours = await repo.create({
        yclients_record_id: recordId,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_2hours',
        message: '2 hours reminder'
      });

      expect(dayBefore).not.toBeNull();
      expect(twoHours).not.toBeNull();
      expect(dayBefore.notification_type).toBe('reminder_day_before');
      expect(twoHours.notification_type).toBe('reminder_2hours');
    });
  });

  describe('findRecent()', () => {
    beforeAll(async () => {
      // Create test notifications for findRecent tests
      await repo.create({
        yclients_record_id: TEST_RECORD_ID + 10,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'booking_created',
        message: 'Booking created'
      });

      await repo.create({
        yclients_record_id: TEST_RECORD_ID + 10,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_day_before',
        message: 'Day before reminder'
      });
    });

    test('should find all recent notifications for record', async () => {
      const notifications = await repo.findRecent(TEST_RECORD_ID + 10);

      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter by notification types', async () => {
      const notifications = await repo.findRecent(
        TEST_RECORD_ID + 10,
        24 * 60 * 60 * 1000,
        ['booking_created']
      );

      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBe(1);
      expect(notifications[0].notification_type).toBe('booking_created');
    });

    test('should return empty array for non-existent record', async () => {
      const notifications = await repo.findRecent(9999999);

      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBe(0);
    });

    test('should order by sent_at DESC', async () => {
      const notifications = await repo.findRecent(TEST_RECORD_ID + 10);

      if (notifications.length > 1) {
        for (let i = 0; i < notifications.length - 1; i++) {
          const current = new Date(notifications[i].sent_at).getTime();
          const next = new Date(notifications[i + 1].sent_at).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });

  describe('isDuplicate()', () => {
    beforeAll(async () => {
      await repo.create({
        yclients_record_id: TEST_RECORD_ID + 20,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'booking_cancelled',
        message: 'Booking cancelled'
      });
    });

    test('should return true for existing notification', async () => {
      const isDup = await repo.isDuplicate(
        TEST_RECORD_ID + 20,
        'booking_cancelled'
      );

      expect(isDup).toBe(true);
    });

    test('should return false for different type', async () => {
      const isDup = await repo.isDuplicate(
        TEST_RECORD_ID + 20,
        'reminder_day_before'
      );

      expect(isDup).toBe(false);
    });

    test('should return false for non-existent record', async () => {
      const isDup = await repo.isDuplicate(9999999, 'booking_cancelled');

      expect(isDup).toBe(false);
    });
  });

  describe('findSentToday()', () => {
    beforeAll(async () => {
      await repo.create({
        yclients_record_id: TEST_RECORD_ID + 30,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'booking_changed',
        message: 'Booking changed'
      });
    });

    test('should find notifications sent today', async () => {
      const notifications = await repo.findSentToday(TEST_RECORD_ID + 30);

      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBeGreaterThan(0);
    });

    test('should filter by notification types', async () => {
      const notifications = await repo.findSentToday(
        TEST_RECORD_ID + 30,
        ['booking_changed']
      );

      expect(notifications.length).toBe(1);
      expect(notifications[0].notification_type).toBe('booking_changed');
    });

    test('should return empty array for non-existent record', async () => {
      const notifications = await repo.findSentToday(9999999);

      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBe(0);
    });
  });

  describe('countByType()', () => {
    beforeAll(async () => {
      // Create multiple notifications for count test
      for (let i = 0; i < 3; i++) {
        await repo.create({
          yclients_record_id: TEST_RECORD_ID + 40 + i,
          company_id: TEST_COMPANY_ID,
          phone: TEST_PHONE,
          notification_type: 'reminder_day_before',
          message: `Count test ${i}`
        });
      }
    });

    test('should return notification counts grouped by type', async () => {
      const counts = await repo.countByType(TEST_COMPANY_ID);

      expect(Array.isArray(counts)).toBe(true);

      // Find reminder_day_before type
      const reminderCount = counts.find(c => c.notification_type === 'reminder_day_before');
      expect(reminderCount).toBeDefined();
      expect(parseInt(reminderCount.count)).toBeGreaterThanOrEqual(3);
    });

    test('should order by count DESC', async () => {
      const counts = await repo.countByType(TEST_COMPANY_ID);

      if (counts.length > 1) {
        for (let i = 0; i < counts.length - 1; i++) {
          const current = parseInt(counts[i].count);
          const next = parseInt(counts[i + 1].count);
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });

  describe('UNIQUE Constraint Verification', () => {
    test('should enforce unique (record_id, type, company_id, date) at DB level', async () => {
      const uniqueRecordId = TEST_RECORD_ID + 100;

      // First insert
      const first = await repo.create({
        yclients_record_id: uniqueRecordId,
        company_id: TEST_COMPANY_ID,
        phone: TEST_PHONE,
        notification_type: 'reminder_day_before',
        message: 'First notification'
      });

      expect(first).not.toBeNull();

      // Verify direct SQL insert would fail
      await expect(postgres.query(
        `INSERT INTO booking_notifications
         (yclients_record_id, company_id, phone, notification_type, notification_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
        [uniqueRecordId, TEST_COMPANY_ID, TEST_PHONE, 'reminder_day_before']
      )).rejects.toThrow();
    });
  });
});
