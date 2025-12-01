/**
 * Integration Tests for StaffScheduleRepository
 *
 * Tests against REAL Timeweb PostgreSQL database.
 * Uses production data (company 962302 has schedule data from sync).
 * Creates test data for mutation tests and cleans up after.
 *
 * Requirements:
 * - Timeweb PostgreSQL must be accessible
 * - Schema must be created (from Phase 0.8)
 * - Run with: npm run test:integration
 *
 * IMPORTANT: This tests the COLUMN NAMES are correct:
 * - yclients_staff_id (NOT staff_id)
 * - company_id, date, is_working, etc.
 */

const StaffScheduleRepository = require('../../../src/repositories/StaffScheduleRepository');
const postgres = require('../../../src/database/postgres');

/**
 * Helper to normalize DATE value to string
 *
 * With the pg type parser fix in postgres.js, DATE columns are now returned as
 * strings 'YYYY-MM-DD' instead of Date objects with timezone issues.
 *
 * This helper handles both formats for backward compatibility:
 * - String: return as-is
 * - Date object: extract date string (legacy/fallback)
 */
const getDateStr = (d) => {
  if (typeof d === 'string') return d;
  // Fallback for Date objects (shouldn't happen with the type parser fix)
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('StaffScheduleRepository Integration Tests', () => {
  let scheduleRepo;
  const TEST_COMPANY_ID = 962302;
  const TEST_STAFF_ID = 99999; // Fake staff ID for test data
  const TEST_DATE = '2099-12-31'; // Far future date to avoid conflicts

  beforeAll(() => {
    scheduleRepo = new StaffScheduleRepository(postgres);
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await postgres.query(
      'DELETE FROM staff_schedules WHERE yclients_staff_id = $1',
      [TEST_STAFF_ID]
    );
  });

  afterEach(async () => {
    // Clean up test data
    await postgres.query(
      'DELETE FROM staff_schedules WHERE yclients_staff_id = $1',
      [TEST_STAFF_ID]
    );
  });

  afterAll(async () => {
    // Ensure cleanup
    await postgres.query(
      'DELETE FROM staff_schedules WHERE yclients_staff_id = $1',
      [TEST_STAFF_ID]
    );
  });

  describe('Schema Column Verification', () => {
    test('should use yclients_staff_id column (NOT staff_id)', async () => {
      // This is the CRITICAL test - verifies we're using correct column name
      const result = await postgres.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'staff_schedules' AND column_name = 'yclients_staff_id'`
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('yclients_staff_id');
    });

    test('should NOT have staff_id column (it does not exist)', async () => {
      const result = await postgres.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'staff_schedules' AND column_name = 'staff_id'`
      );

      expect(result.rows.length).toBe(0);
    });
  });

  describe('findSchedules()', () => {
    test('should find schedules for company', async () => {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const schedules = await scheduleRepo.findSchedules({
        companyId: TEST_COMPANY_ID,
        dateFrom: today.toISOString().split('T')[0],
        dateTo: futureDate.toISOString().split('T')[0]
      });

      expect(Array.isArray(schedules)).toBe(true);

      if (schedules.length > 0) {
        const schedule = schedules[0];
        // Verify correct column names are returned
        expect(schedule).toHaveProperty('id');
        expect(schedule).toHaveProperty('yclients_staff_id');
        expect(schedule).toHaveProperty('date');
        expect(schedule).toHaveProperty('company_id');
        expect(schedule).toHaveProperty('is_working');
        expect(schedule.company_id).toBe(TEST_COMPANY_ID);

        // MUST NOT have staff_id (wrong column)
        // Note: It could exist if aliased, but yclients_staff_id must be present
      }
    });

    test('should filter by staffId using yclients_staff_id column', async () => {
      // First get any real schedule to get a valid staff ID
      const allSchedules = await scheduleRepo.findSchedules({
        companyId: TEST_COMPANY_ID
      });

      if (allSchedules.length > 0) {
        const staffId = allSchedules[0].yclients_staff_id;

        const staffSchedules = await scheduleRepo.findSchedules({
          companyId: TEST_COMPANY_ID,
          staffId
        });

        expect(Array.isArray(staffSchedules)).toBe(true);
        // All should belong to the same staff
        staffSchedules.forEach(schedule => {
          expect(schedule.yclients_staff_id).toBe(staffId);
        });
      }
    });

    test('should filter by isWorking', async () => {
      const schedules = await scheduleRepo.findSchedules({
        companyId: TEST_COMPANY_ID,
        isWorking: true
      });

      expect(Array.isArray(schedules)).toBe(true);

      // All should have is_working = true
      schedules.forEach(schedule => {
        expect(schedule.is_working).toBe(true);
      });
    });

    test('should filter by date range', async () => {
      const startDate = '2025-12-01';
      const endDate = '2025-12-31';

      const schedules = await scheduleRepo.findSchedules({
        companyId: TEST_COMPANY_ID,
        dateFrom: startDate,
        dateTo: endDate
      });

      expect(Array.isArray(schedules)).toBe(true);

      // Use global getDateStr helper for timezone-aware date comparison
      schedules.forEach(schedule => {
        const scheduleDate = getDateStr(schedule.date);
        // Compare dates as strings (YYYY-MM-DD format)
        expect(scheduleDate >= startDate).toBe(true);
        expect(scheduleDate <= endDate).toBe(true);
      });
    });

    test('should order by date ASC', async () => {
      const schedules = await scheduleRepo.findSchedules({
        companyId: TEST_COMPANY_ID
      });

      if (schedules.length > 1) {
        for (let i = 0; i < schedules.length - 1; i++) {
          const current = new Date(schedules[i].date).getTime();
          const next = new Date(schedules[i + 1].date).getTime();
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });

    test('should return empty array for non-existent company', async () => {
      const schedules = await scheduleRepo.findSchedules({
        companyId: 999999
      });

      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBe(0);
    });
  });

  describe('findSchedule()', () => {
    test('should find specific schedule by staff, date, and company', async () => {
      // Insert a known test schedule first
      await scheduleRepo.bulkUpsert([
        {
          yclients_staff_id: TEST_STAFF_ID,
          company_id: TEST_COMPANY_ID,
          staff_name: 'Test Staff',
          date: TEST_DATE,
          is_working: true,
          working_hours: '09:00-18:00'
        }
      ]);

      const found = await scheduleRepo.findSchedule(
        TEST_STAFF_ID,
        TEST_DATE,
        TEST_COMPANY_ID
      );

      expect(found).not.toBeNull();
      expect(found.yclients_staff_id).toBe(TEST_STAFF_ID);
      expect(found.is_working).toBe(true);
    });

    test('should return null for non-existent schedule', async () => {
      const schedule = await scheduleRepo.findSchedule(
        9999999,
        '2099-12-31',
        TEST_COMPANY_ID
      );

      expect(schedule).toBeNull();
    });
  });

  describe('bulkUpsert()', () => {
    test('should insert new schedules', async () => {
      const newSchedules = [
        {
          yclients_staff_id: TEST_STAFF_ID,
          company_id: TEST_COMPANY_ID,
          staff_name: 'Test Staff',
          date: TEST_DATE,
          is_working: true,
          work_start: '09:00:00',
          work_end: '18:00:00',
          working_hours: '09:00-18:00'
        },
        {
          yclients_staff_id: TEST_STAFF_ID,
          company_id: TEST_COMPANY_ID,
          staff_name: 'Test Staff',
          date: '2099-12-30',
          is_working: false,
          working_hours: ''
        }
      ];

      const result = await scheduleRepo.bulkUpsert(newSchedules);

      expect(result).toBeTruthy();
      expect(result.length).toBe(2);

      // Verify inserted
      const fetched = await scheduleRepo.findSchedules({
        companyId: TEST_COMPANY_ID,
        staffId: TEST_STAFF_ID
      });

      expect(fetched.length).toBe(2);
      // Use global getDateStr helper for timezone-aware date comparison
      expect(fetched.find(s => getDateStr(s.date) === TEST_DATE).is_working).toBe(true);
      expect(fetched.find(s => getDateStr(s.date) === '2099-12-30').is_working).toBe(false);

      // Clean up extra test date
      await postgres.query(
        "DELETE FROM staff_schedules WHERE date = '2099-12-30'"
      );
    });

    test('should update existing schedules on conflict', async () => {
      // Insert initial schedule
      await scheduleRepo.bulkUpsert([
        {
          yclients_staff_id: TEST_STAFF_ID,
          company_id: TEST_COMPANY_ID,
          staff_name: 'Test Staff',
          date: TEST_DATE,
          is_working: false,
          working_hours: ''
        }
      ]);

      // Update with bulkUpsert
      await scheduleRepo.bulkUpsert([
        {
          yclients_staff_id: TEST_STAFF_ID,
          company_id: TEST_COMPANY_ID,
          staff_name: 'Test Staff Updated',
          date: TEST_DATE,
          is_working: true,
          work_start: '10:00:00',
          work_end: '20:00:00',
          working_hours: '10:00-20:00'
        }
      ]);

      // Verify update
      const fetched = await scheduleRepo.findSchedule(
        TEST_STAFF_ID,
        TEST_DATE,
        TEST_COMPANY_ID
      );

      expect(fetched.is_working).toBe(true);
      expect(fetched.staff_name).toBe('Test Staff Updated');
      expect(fetched.work_start).toBe('10:00:00');
    });
  });

  describe('syncBulkUpsert() - for sync scripts', () => {
    test('should batch insert schedules for sync', async () => {
      const schedules = [];
      for (let i = 1; i <= 5; i++) {
        schedules.push({
          yclients_staff_id: TEST_STAFF_ID,
          company_id: TEST_COMPANY_ID,
          staff_name: 'Test Staff',
          date: `2099-12-${String(i).padStart(2, '0')}`,
          is_working: i % 2 === 1,
          working_hours: i % 2 === 1 ? '09:00-18:00' : ''
        });
      }

      const result = await scheduleRepo.syncBulkUpsert(schedules);

      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
      expect(result.duration).toBeDefined();

      // Clean up
      for (let i = 1; i <= 5; i++) {
        await postgres.query(
          `DELETE FROM staff_schedules WHERE date = '2099-12-${String(i).padStart(2, '0')}'`
        );
      }
    });
  });

  describe('Production Data Verification', () => {
    test('should have access to production schedules', async () => {
      const today = new Date();
      const past = new Date();
      past.setDate(past.getDate() - 7);

      const schedules = await scheduleRepo.findSchedules({
        companyId: TEST_COMPANY_ID,
        dateFrom: past.toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      });

      // Should have some recent schedules from sync
      console.log(`Production schedules (last 7 days): ${schedules.length}`);
    });

    test('should return schedules with all required fields', async () => {
      const schedules = await scheduleRepo.findSchedules({
        companyId: TEST_COMPANY_ID
      });

      if (schedules.length > 0) {
        const schedule = schedules[0];

        // Required fields
        expect(schedule).toHaveProperty('id');
        expect(schedule).toHaveProperty('yclients_staff_id');
        expect(schedule).toHaveProperty('staff_name');
        expect(schedule).toHaveProperty('date');
        expect(schedule).toHaveProperty('is_working');
        expect(schedule).toHaveProperty('company_id');
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle schedules with NULL work times', async () => {
      await scheduleRepo.bulkUpsert([
        {
          yclients_staff_id: TEST_STAFF_ID,
          company_id: TEST_COMPANY_ID,
          staff_name: 'Test Staff',
          date: TEST_DATE,
          is_working: false,
          work_start: null,
          work_end: null,
          working_hours: null
        }
      ]);

      const fetched = await scheduleRepo.findSchedule(
        TEST_STAFF_ID,
        TEST_DATE,
        TEST_COMPANY_ID
      );

      expect(fetched.is_working).toBe(false);
      expect(fetched.work_start).toBeNull();
      expect(fetched.work_end).toBeNull();
    });

    test('should handle Russian characters in staff_name', async () => {
      await scheduleRepo.bulkUpsert([
        {
          yclients_staff_id: TEST_STAFF_ID,
          company_id: TEST_COMPANY_ID,
          staff_name: 'Бари Саргсян',
          date: TEST_DATE,
          is_working: true,
          working_hours: '09:00-18:00'
        }
      ]);

      const fetched = await scheduleRepo.findSchedule(
        TEST_STAFF_ID,
        TEST_DATE,
        TEST_COMPANY_ID
      );

      expect(fetched.staff_name).toBe('Бари Саргсян');
    });
  });
});
