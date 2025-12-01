/**
 * Integration Tests for BookingRepository
 *
 * Tests against REAL Timeweb PostgreSQL database.
 * Uses production data (company 962302 has booking data from sync).
 * Creates test data for mutation tests and cleans up after.
 *
 * Requirements:
 * - Timeweb PostgreSQL must be accessible
 * - Schema must be created (from Phase 0.8)
 * - Run with: npm run test:integration
 *
 * IMPORTANT: This tests the COLUMN NAMES are correct:
 * - yclients_record_id (NOT record_id)
 * - staff_id (YES, this is correct for bookings table!)
 * - company_id, client_phone, datetime, etc.
 *
 * NOTE: bookings.staff_id IS correct (different from staff_schedules.yclients_staff_id)
 */

const BookingRepository = require('../../../src/repositories/BookingRepository');
const postgres = require('../../../src/database/postgres');

describe('BookingRepository Integration Tests', () => {
  let bookingRepo;
  const TEST_COMPANY_ID = 962302;
  const TEST_RECORD_ID = 999999999; // Fake record ID for test data (max int ~2.1B)
  const TEST_PHONE = '79990000001';

  beforeAll(() => {
    bookingRepo = new BookingRepository(postgres);
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await postgres.query(
      'DELETE FROM bookings WHERE yclients_record_id = $1',
      [TEST_RECORD_ID]
    );
    await postgres.query(
      'DELETE FROM bookings WHERE client_phone = $1',
      [TEST_PHONE]
    );
  });

  afterEach(async () => {
    // Clean up test data
    await postgres.query(
      'DELETE FROM bookings WHERE yclients_record_id = $1',
      [TEST_RECORD_ID]
    );
    await postgres.query(
      'DELETE FROM bookings WHERE client_phone = $1',
      [TEST_PHONE]
    );
  });

  afterAll(async () => {
    // Ensure cleanup
    await postgres.query(
      'DELETE FROM bookings WHERE yclients_record_id = $1',
      [TEST_RECORD_ID]
    );
    await postgres.query(
      'DELETE FROM bookings WHERE client_phone = $1',
      [TEST_PHONE]
    );
  });

  describe('Schema Column Verification', () => {
    test('should use yclients_record_id column (NOT record_id)', async () => {
      const result = await postgres.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'bookings' AND column_name = 'yclients_record_id'`
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('yclients_record_id');
    });

    test('should use staff_id column (correct for bookings)', async () => {
      // NOTE: bookings table uses staff_id (not yclients_staff_id)
      // This is DIFFERENT from staff_schedules which uses yclients_staff_id
      const result = await postgres.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'bookings' AND column_name = 'staff_id'`
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('staff_id');
    });

    test('should have all required columns', async () => {
      const result = await postgres.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'bookings'
         ORDER BY ordinal_position`
      );

      const columnNames = result.rows.map(r => r.column_name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('yclients_record_id');
      expect(columnNames).toContain('company_id');
      expect(columnNames).toContain('client_phone');
      expect(columnNames).toContain('staff_id');
      expect(columnNames).toContain('datetime');
      expect(columnNames).toContain('status');
    });
  });

  describe('findByRecordId()', () => {
    test('should find booking by YClients record ID', async () => {
      // Insert test booking
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test Client',
        staff_id: 1,
        staff_name: 'Test Staff',
        services: ['Test Service'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'active'
      });

      const result = await bookingRepo.findByRecordId(TEST_RECORD_ID);

      expect(result).toBeTruthy();
      expect(result.yclients_record_id).toBe(TEST_RECORD_ID);
      expect(result.client_phone).toBe(TEST_PHONE);
    });

    test('should return null for non-existent record', async () => {
      const result = await bookingRepo.findByRecordId(888888888);

      expect(result).toBeNull();
    });
  });

  describe('findByPhone()', () => {
    test('should find bookings by phone number', async () => {
      // Insert test bookings
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test Client',
        staff_id: 1,
        staff_name: 'Test Staff',
        services: ['Test Service'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'active'
      });

      const results = await bookingRepo.findByPhone(TEST_PHONE);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].client_phone).toBe(TEST_PHONE);
    });

    test('should return empty array for non-existent phone', async () => {
      const results = await bookingRepo.findByPhone('70000000000');

      expect(results).toEqual([]);
    });

    test('should respect limit parameter', async () => {
      // Insert multiple bookings
      for (let i = 0; i < 3; i++) {
        await bookingRepo.upsert({
          yclients_record_id: TEST_RECORD_ID + i,
          company_id: TEST_COMPANY_ID,
          client_phone: TEST_PHONE,
          client_name: 'Test Client',
          staff_id: 1,
          staff_name: 'Test Staff',
          services: [`Service ${i}`],
          datetime: `2099-12-${30 - i}T12:00:00+03:00`,
          status: 'active'
        });
      }

      const results = await bookingRepo.findByPhone(TEST_PHONE, { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);

      // Clean up extra records
      for (let i = 1; i < 3; i++) {
        await postgres.query(
          'DELETE FROM bookings WHERE yclients_record_id = $1',
          [TEST_RECORD_ID + i]
        );
      }
    });
  });

  describe('findUpcoming()', () => {
    test('should find upcoming active bookings', async () => {
      // Insert future booking
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test Client',
        staff_id: 1,
        staff_name: 'Test Staff',
        services: ['Test Service'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'active'
      });

      const results = await bookingRepo.findUpcoming(TEST_PHONE);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].status).toBe('active');
    });

    test('should NOT return cancelled bookings', async () => {
      // Insert cancelled booking
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test Client',
        staff_id: 1,
        staff_name: 'Test Staff',
        services: ['Test Service'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'cancelled'
      });

      const results = await bookingRepo.findUpcoming(TEST_PHONE);

      expect(results.length).toBe(0);
    });

    test('should NOT return past bookings', async () => {
      // Insert past booking
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test Client',
        staff_id: 1,
        staff_name: 'Test Staff',
        services: ['Test Service'],
        datetime: '2020-01-01T12:00:00+03:00',
        status: 'active'
      });

      const results = await bookingRepo.findUpcoming(TEST_PHONE);

      // Should not include past booking
      expect(results.find(b => b.yclients_record_id === TEST_RECORD_ID)).toBeFalsy();
    });
  });

  describe('upsert()', () => {
    test('should insert new booking', async () => {
      const newBooking = {
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'New Client',
        client_yclients_id: 12345,
        staff_id: 1,
        staff_name: 'Staff Name',
        services: ['Service 1', 'Service 2'],
        datetime: '2099-12-31T14:00:00+03:00',
        status: 'active'
      };

      const result = await bookingRepo.upsert(newBooking);

      expect(result).toBeTruthy();
      expect(result.yclients_record_id).toBe(TEST_RECORD_ID);
      expect(result.client_name).toBe('New Client');
      expect(result.services).toEqual(['Service 1', 'Service 2']);
    });

    test('should update existing booking on conflict', async () => {
      // Insert initial
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Original Name',
        staff_id: 1,
        staff_name: 'Staff',
        services: ['Service 1'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'active'
      });

      // Update
      const updated = await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Updated Name',
        staff_id: 2,
        staff_name: 'New Staff',
        services: ['Service 1', 'Service 2'],
        datetime: '2099-12-31T15:00:00+03:00',
        status: 'active'
      });

      expect(updated.client_name).toBe('Updated Name');
      expect(updated.staff_id).toBe(2);
      expect(updated.services).toEqual(['Service 1', 'Service 2']);
    });

    test('should require yclients_record_id', async () => {
      await expect(bookingRepo.upsert({
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE
      })).rejects.toThrow('yclients_record_id is required');
    });

    test('should require company_id', async () => {
      await expect(bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        client_phone: TEST_PHONE
      })).rejects.toThrow('company_id is required');
    });
  });

  describe('updateStatus()', () => {
    test('should update booking status', async () => {
      // Insert booking
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test Client',
        staff_id: 1,
        staff_name: 'Staff',
        services: ['Service'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'active'
      });

      // Update status
      await bookingRepo.updateStatus(TEST_RECORD_ID, 'cancelled');

      // Verify
      const fetched = await bookingRepo.findByRecordId(TEST_RECORD_ID);
      expect(fetched.status).toBe('cancelled');
    });

    test('should reject invalid status', async () => {
      await expect(bookingRepo.updateStatus(TEST_RECORD_ID, 'invalid'))
        .rejects.toThrow('Invalid status');
    });

    test('should accept valid statuses', async () => {
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test',
        staff_id: 1,
        staff_name: 'Staff',
        services: ['Service'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'active'
      });

      // Test all valid statuses
      await bookingRepo.updateStatus(TEST_RECORD_ID, 'completed');
      let fetched = await bookingRepo.findByRecordId(TEST_RECORD_ID);
      expect(fetched.status).toBe('completed');

      await bookingRepo.updateStatus(TEST_RECORD_ID, 'cancelled');
      fetched = await bookingRepo.findByRecordId(TEST_RECORD_ID);
      expect(fetched.status).toBe('cancelled');

      await bookingRepo.updateStatus(TEST_RECORD_ID, 'active');
      fetched = await bookingRepo.findByRecordId(TEST_RECORD_ID);
      expect(fetched.status).toBe('active');
    });
  });

  describe('findByDateRange()', () => {
    test('should find bookings in date range', async () => {
      // Insert bookings in different dates
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test',
        staff_id: 1,
        staff_name: 'Staff',
        services: ['Service'],
        datetime: '2099-06-15T12:00:00+03:00',
        status: 'active'
      });

      const results = await bookingRepo.findByDateRange({
        company_id: TEST_COMPANY_ID,
        startDate: '2099-06-01',
        endDate: '2099-06-30'
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.find(b => b.yclients_record_id === TEST_RECORD_ID)).toBeTruthy();
    });

    test('should filter by status', async () => {
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test',
        staff_id: 1,
        staff_name: 'Staff',
        services: ['Service'],
        datetime: '2099-06-15T12:00:00+03:00',
        status: 'cancelled'
      });

      const activeOnly = await bookingRepo.findByDateRange({
        company_id: TEST_COMPANY_ID,
        startDate: '2099-06-01',
        endDate: '2099-06-30',
        status: 'active'
      });

      expect(activeOnly.find(b => b.yclients_record_id === TEST_RECORD_ID)).toBeFalsy();
    });
  });

  describe('bulkUpsert()', () => {
    test('should insert multiple bookings', async () => {
      const bookings = [
        {
          yclients_record_id: TEST_RECORD_ID,
          company_id: TEST_COMPANY_ID,
          client_phone: TEST_PHONE,
          client_name: 'Client 1',
          staff_id: 1,
          staff_name: 'Staff',
          services: ['Service 1'],
          datetime: '2099-12-31T10:00:00+03:00',
          status: 'active'
        },
        {
          yclients_record_id: TEST_RECORD_ID + 1,
          company_id: TEST_COMPANY_ID,
          client_phone: TEST_PHONE,
          client_name: 'Client 2',
          staff_id: 1,
          staff_name: 'Staff',
          services: ['Service 2'],
          datetime: '2099-12-31T11:00:00+03:00',
          status: 'active'
        }
      ];

      const results = await bookingRepo.bulkUpsert(bookings);

      expect(results.length).toBe(2);

      // Clean up extra record
      await postgres.query(
        'DELETE FROM bookings WHERE yclients_record_id = $1',
        [TEST_RECORD_ID + 1]
      );
    });
  });

  describe('Production Data Verification', () => {
    test('should have access to production bookings', async () => {
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const bookings = await bookingRepo.findByDateRange({
        company_id: TEST_COMPANY_ID,
        startDate: today.toISOString().split('T')[0],
        endDate: nextMonth.toISOString().split('T')[0]
      });

      console.log(`Production bookings (next 30 days): ${bookings.length}`);
    });
  });

  describe('Edge Cases', () => {
    test('should handle services as array', async () => {
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Test',
        staff_id: 1,
        staff_name: 'Staff',
        services: ['Service 1', 'Service 2', 'Service 3'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'active'
      });

      const fetched = await bookingRepo.findByRecordId(TEST_RECORD_ID);

      expect(Array.isArray(fetched.services)).toBe(true);
      expect(fetched.services.length).toBe(3);
    });

    test('should handle Russian characters', async () => {
      await bookingRepo.upsert({
        yclients_record_id: TEST_RECORD_ID,
        company_id: TEST_COMPANY_ID,
        client_phone: TEST_PHONE,
        client_name: 'Ирина Петровна',
        staff_id: 1,
        staff_name: 'Бари Саргсян',
        services: ['СТРИЖКА | СЧАСТЛИВЫЕ ЧАСЫ'],
        datetime: '2099-12-31T12:00:00+03:00',
        status: 'active'
      });

      const fetched = await bookingRepo.findByRecordId(TEST_RECORD_ID);

      expect(fetched.client_name).toBe('Ирина Петровна');
      expect(fetched.staff_name).toBe('Бари Саргсян');
      expect(fetched.services[0]).toContain('СТРИЖКА');
    });
  });
});
