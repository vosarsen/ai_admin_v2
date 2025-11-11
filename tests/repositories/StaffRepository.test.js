/**
 * StaffRepository Integration Tests
 *
 * Tests staff-specific repository methods against production Timeweb PostgreSQL
 * Uses production data (company 962302 has staff members)
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- StaffRepository.test.js
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const StaffRepository = require('../../src/repositories/StaffRepository');
const postgres = require('../../src/database/postgres');

describe('StaffRepository Integration Tests', () => {
  let repo;
  const PRODUCTION_COMPANY_ID = 962302; // Has real staff data

  beforeAll(async () => {
    repo = new StaffRepository(postgres);
  });

  describe('findAll()', () => {
    test('should find all active staff for company', async () => {
      const staff = await repo.findAll(PRODUCTION_COMPANY_ID, false);

      expect(Array.isArray(staff)).toBe(true);
      expect(staff.length).toBeGreaterThan(0);

      // All should be active (is_active=true means not fired)
      staff.forEach(member => {
        expect(member.is_active).toBe(true);
        expect(member.company_id).toBe(PRODUCTION_COMPANY_ID);
      });

      console.log(`Active staff count: ${staff.length}`);
    });

    test('should include inactive staff when requested', async () => {
      const allStaff = await repo.findAll(PRODUCTION_COMPANY_ID, true);
      const activeOnly = await repo.findAll(PRODUCTION_COMPANY_ID, false);

      expect(allStaff.length).toBeGreaterThanOrEqual(activeOnly.length);

      console.log(`Total staff: ${allStaff.length}, Active: ${activeOnly.length}`);
    });

    test('should order by name ASC', async () => {
      const staff = await repo.findAll(PRODUCTION_COMPANY_ID, true);

      if (staff.length > 1) {
        for (let i = 0; i < staff.length - 1; i++) {
          const currentName = staff[i].name || '';
          const nextName = staff[i + 1].name || '';
          expect(currentName.localeCompare(nextName)).toBeLessThanOrEqual(0);
        }
      }
    });

    test('should return empty array for non-existent company', async () => {
      const staff = await repo.findAll(999999, false);

      expect(Array.isArray(staff)).toBe(true);
      expect(staff.length).toBe(0);
    });

    test('should return staff with all required fields', async () => {
      const staff = await repo.findAll(PRODUCTION_COMPANY_ID, false);

      expect(staff.length).toBeGreaterThan(0);

      const member = staff[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('yclients_id');
      expect(member).toHaveProperty('company_id');
      expect(member).toHaveProperty('name');
      expect(member).toHaveProperty('is_active');
    });
  });

  describe('findById()', () => {
    test('should find staff by yclients_id and company_id', async () => {
      // Get first production staff member
      const allStaff = await repo.findAll(PRODUCTION_COMPANY_ID, false);
      expect(allStaff.length).toBeGreaterThan(0);

      const productionStaff = allStaff[0];

      // Find by ID
      const found = await repo.findById(
        productionStaff.yclients_id,
        PRODUCTION_COMPANY_ID
      );

      expect(found).not.toBeNull();
      expect(found.id).toBe(productionStaff.id);
      expect(found.yclients_id).toBe(productionStaff.yclients_id);
      expect(found.name).toBe(productionStaff.name);
    });

    test('should return null for non-existent yclients_id', async () => {
      const staff = await repo.findById(9999999, PRODUCTION_COMPANY_ID);

      expect(staff).toBeNull();
    });

    test('should return null for wrong company_id', async () => {
      const allStaff = await repo.findAll(PRODUCTION_COMPANY_ID, false);
      const productionStaff = allStaff[0];

      const staff = await repo.findById(productionStaff.yclients_id, 999999);

      expect(staff).toBeNull();
    });
  });

  describe('Production Data Verification', () => {
    test('should have access to production staff', async () => {
      const staff = await repo.findAll(PRODUCTION_COMPANY_ID, true);

      expect(staff.length).toBeGreaterThan(0);

      console.log(`Production staff total: ${staff.length}`);
    });

    test('should find staff with specializations', async () => {
      const staff = await repo.findAll(PRODUCTION_COMPANY_ID, false);

      // Check if staff have specialization field
      const withSpecialization = staff.filter(s => s.specialization);

      console.log(`Staff with specialization: ${withSpecialization.length}/${staff.length}`);
    });
  });
});
