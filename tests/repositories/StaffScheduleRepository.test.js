/**
 * StaffScheduleRepository Integration Tests
 *
 * Tests staff schedule-specific repository methods against production Timeweb PostgreSQL
 * Uses production data (company 962302 has schedule data)
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- StaffScheduleRepository.test.js
 */

const { describe, test, expect, beforeAll } = require('@jest/globals');
const StaffScheduleRepository = require('../../src/repositories/StaffScheduleRepository');
const postgres = require('../../src/database/postgres');

describe('StaffScheduleRepository Integration Tests', () => {
  let repo;
  const PRODUCTION_COMPANY_ID = 962302; // Has real schedule data

  beforeAll(async () => {
    repo = new StaffScheduleRepository(postgres);
  });

  describe('findSchedules()', () => {
    test('should find schedules for company', async () => {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const schedules = await repo.findSchedules({
        companyId: PRODUCTION_COMPANY_ID,
        dateFrom: today.toISOString().split('T')[0],
        dateTo: futureDate.toISOString().split('T')[0]
      });

      expect(Array.isArray(schedules)).toBe(true);

      if (schedules.length > 0) {
        const schedule = schedules[0];
        expect(schedule).toHaveProperty('id');
        expect(schedule).toHaveProperty('yclients_staff_id');
        expect(schedule).toHaveProperty('date');
        expect(schedule).toHaveProperty('company_id');
        expect(schedule.company_id).toBe(PRODUCTION_COMPANY_ID);

        console.log(`Schedules found: ${schedules.length}`);
      } else {
        console.log('No schedules found for date range (OK for testing)');
      }
    });

    test('should filter by staffId', async () => {
      // Get some schedules first
      const allSchedules = await repo.findSchedules({
        companyId: PRODUCTION_COMPANY_ID
      });

      if (allSchedules.length > 0) {
        const staffId = allSchedules[0].yclients_staff_id;

        const staffSchedules = await repo.findSchedules({
          companyId: PRODUCTION_COMPANY_ID,
          staffId
        });

        expect(Array.isArray(staffSchedules)).toBe(true);
        // All should belong to the same staff
        staffSchedules.forEach(schedule => {
          expect(schedule.yclients_staff_id).toBe(staffId);
        });

        console.log(`Schedules for staff ${staffId}: ${staffSchedules.length}`);
      }
    });

    test('should filter by isWorking', async () => {
      const schedules = await repo.findSchedules({
        companyId: PRODUCTION_COMPANY_ID,
        isWorking: true
      });

      expect(Array.isArray(schedules)).toBe(true);

      // All should have is_working = true
      schedules.forEach(schedule => {
        expect(schedule.is_working).toBe(true);
      });
    });

    test('should order by date ASC', async () => {
      const schedules = await repo.findSchedules({
        companyId: PRODUCTION_COMPANY_ID
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
      const schedules = await repo.findSchedules({
        companyId: 999999
      });

      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBe(0);
    });
  });

  describe('findSchedule()', () => {
    test('should find specific schedule by staff, date, and company', async () => {
      // Get some schedules first
      const allSchedules = await repo.findSchedules({
        companyId: PRODUCTION_COMPANY_ID
      });

      if (allSchedules.length > 0) {
        const schedule = allSchedules[0];

        const found = await repo.findSchedule(
          schedule.yclients_staff_id,
          schedule.date,
          PRODUCTION_COMPANY_ID
        );

        expect(found).not.toBeNull();
        expect(found.id).toBe(schedule.id);
        expect(found.yclients_staff_id).toBe(schedule.yclients_staff_id);
        expect(found.date).toBe(schedule.date);
      }
    });

    test('should return null for non-existent schedule', async () => {
      const schedule = await repo.findSchedule(
        9999999,
        '2099-12-31',
        PRODUCTION_COMPANY_ID
      );

      expect(schedule).toBeNull();
    });
  });

  describe('Production Data Verification', () => {
    test('should have access to production schedules', async () => {
      const today = new Date();
      const past = new Date();
      past.setDate(past.getDate() - 30);

      const schedules = await repo.findSchedules({
        companyId: PRODUCTION_COMPANY_ID,
        dateFrom: past.toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      });

      console.log(`Production schedules (last 30 days): ${schedules.length}`);
    });
  });
});
