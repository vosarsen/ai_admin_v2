/**
 * Integration Tests for StaffRepository
 *
 * Tests against REAL Timeweb PostgreSQL database.
 * Uses production data (company 962302 has staff data from sync).
 * Creates test data for mutation tests and cleans up after.
 *
 * Requirements:
 * - Timeweb PostgreSQL must be accessible
 * - Schema must be created (from Phase 0.8)
 * - Run with: npm run test:integration
 *
 * IMPORTANT: This tests the COLUMN NAMES are correct:
 * - yclients_id (NOT staff_id or id for external ID)
 * - company_id, name, is_active, etc.
 */

const StaffRepository = require('../../../src/repositories/StaffRepository');
const postgres = require('../../../src/database/postgres');

describe('StaffRepository Integration Tests', () => {
  let staffRepo;
  const TEST_COMPANY_ID = 962302;
  const TEST_YCLIENTS_ID = 99999999; // Fake YClients ID for test data

  beforeAll(() => {
    staffRepo = new StaffRepository(postgres);
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await postgres.query(
      'DELETE FROM staff WHERE yclients_id = $1',
      [TEST_YCLIENTS_ID]
    );
  });

  afterEach(async () => {
    // Clean up test data
    await postgres.query(
      'DELETE FROM staff WHERE yclients_id = $1',
      [TEST_YCLIENTS_ID]
    );
  });

  afterAll(async () => {
    // Ensure cleanup
    await postgres.query(
      'DELETE FROM staff WHERE yclients_id = $1',
      [TEST_YCLIENTS_ID]
    );
  });

  describe('Schema Column Verification', () => {
    test('should use yclients_id column for external ID', async () => {
      const result = await postgres.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'staff' AND column_name = 'yclients_id'`
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].column_name).toBe('yclients_id');
    });

    test('should have all required columns', async () => {
      const result = await postgres.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'staff'
         ORDER BY ordinal_position`
      );

      const columnNames = result.rows.map(r => r.column_name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('yclients_id');
      expect(columnNames).toContain('company_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('is_active');
    });
  });

  describe('findAll()', () => {
    test('should find all active staff for company', async () => {
      const staff = await staffRepo.findAll(TEST_COMPANY_ID, false);

      expect(Array.isArray(staff)).toBe(true);
      expect(staff.length).toBeGreaterThan(0);

      // All should be active
      staff.forEach(member => {
        expect(member.is_active).toBe(true);
        expect(member.company_id).toBe(TEST_COMPANY_ID);
      });
    });

    test('should include inactive staff when requested', async () => {
      // Insert inactive test staff
      await postgres.query(
        `INSERT INTO staff (yclients_id, company_id, name, is_active)
         VALUES ($1, $2, 'Inactive Test Staff', false)`,
        [TEST_YCLIENTS_ID, TEST_COMPANY_ID]
      );

      const allStaff = await staffRepo.findAll(TEST_COMPANY_ID, true);
      const activeOnly = await staffRepo.findAll(TEST_COMPANY_ID, false);

      expect(allStaff.length).toBeGreaterThanOrEqual(activeOnly.length);

      // Inactive test staff should be in allStaff but not activeOnly
      expect(allStaff.find(s => s.yclients_id === TEST_YCLIENTS_ID)).toBeTruthy();
      expect(activeOnly.find(s => s.yclients_id === TEST_YCLIENTS_ID)).toBeFalsy();
    });

    test('should order by name ASC', async () => {
      const staff = await staffRepo.findAll(TEST_COMPANY_ID, true);

      if (staff.length > 1) {
        for (let i = 0; i < staff.length - 1; i++) {
          const currentName = staff[i].name || '';
          const nextName = staff[i + 1].name || '';
          expect(currentName.localeCompare(nextName)).toBeLessThanOrEqual(0);
        }
      }
    });

    test('should return empty array for non-existent company', async () => {
      const staff = await staffRepo.findAll(999999, false);

      expect(Array.isArray(staff)).toBe(true);
      expect(staff.length).toBe(0);
    });

    test('should return staff with all required fields', async () => {
      const staff = await staffRepo.findAll(TEST_COMPANY_ID, false);

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
      const allStaff = await staffRepo.findAll(TEST_COMPANY_ID, false);
      expect(allStaff.length).toBeGreaterThan(0);

      const productionStaff = allStaff[0];

      // Find by ID
      const found = await staffRepo.findById(
        productionStaff.yclients_id,
        TEST_COMPANY_ID
      );

      expect(found).not.toBeNull();
      expect(found.id).toBe(productionStaff.id);
      expect(found.yclients_id).toBe(productionStaff.yclients_id);
      expect(found.name).toBe(productionStaff.name);
    });

    test('should return null for non-existent yclients_id', async () => {
      const staff = await staffRepo.findById(9999999, TEST_COMPANY_ID);

      expect(staff).toBeNull();
    });

    test('should return null for wrong company_id', async () => {
      const allStaff = await staffRepo.findAll(TEST_COMPANY_ID, false);
      const productionStaff = allStaff[0];

      const staff = await staffRepo.findById(productionStaff.yclients_id, 999999);

      expect(staff).toBeNull();
    });
  });

  describe('bulkUpsert()', () => {
    test('should insert new staff members', async () => {
      const newStaff = [
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Test Staff 1',
          specialization: 'Barber',
          is_active: true,
          is_bookable: true
        },
        {
          yclients_id: TEST_YCLIENTS_ID + 1,
          company_id: TEST_COMPANY_ID,
          name: 'Test Staff 2',
          specialization: 'Stylist',
          is_active: true,
          is_bookable: true
        }
      ];

      const result = await staffRepo.bulkUpsert(newStaff);

      expect(result).toBeTruthy();
      expect(result.length).toBe(2);

      // Verify inserted
      const fetched = await staffRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);
      expect(fetched).not.toBeNull();
      expect(fetched.name).toBe('Test Staff 1');

      // Clean up extra test staff
      await postgres.query(
        'DELETE FROM staff WHERE yclients_id = $1',
        [TEST_YCLIENTS_ID + 1]
      );
    });

    test('should update existing staff on conflict', async () => {
      // Insert initial
      await staffRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Original Name',
          specialization: 'Barber',
          is_active: true
        }
      ]);

      // Update
      await staffRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Updated Name',
          specialization: 'Senior Barber',
          is_active: true
        }
      ]);

      // Verify update
      const fetched = await staffRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);
      expect(fetched.name).toBe('Updated Name');
      expect(fetched.specialization).toBe('Senior Barber');
    });
  });

  describe('syncBulkUpsert() - for sync scripts', () => {
    test('should batch insert staff for sync', async () => {
      const staff = [];
      for (let i = 0; i < 3; i++) {
        staff.push({
          yclients_id: TEST_YCLIENTS_ID + i,
          company_id: TEST_COMPANY_ID,
          name: `Test Staff ${i}`,
          is_active: true
        });
      }

      const result = await staffRepo.syncBulkUpsert(staff);

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(result.duration).toBeDefined();

      // Clean up
      for (let i = 0; i < 3; i++) {
        await postgres.query(
          'DELETE FROM staff WHERE yclients_id = $1',
          [TEST_YCLIENTS_ID + i]
        );
      }
    });
  });

  describe('Production Data Verification', () => {
    test('should have access to production staff', async () => {
      const staff = await staffRepo.findAll(TEST_COMPANY_ID, true);

      expect(staff.length).toBeGreaterThan(0);

      console.log(`Production staff total: ${staff.length}`);
    });

    test('should find staff with specializations', async () => {
      const staff = await staffRepo.findAll(TEST_COMPANY_ID, false);

      // Check if staff have specialization field
      const withSpecialization = staff.filter(s => s.specialization);

      console.log(`Staff with specialization: ${withSpecialization.length}/${staff.length}`);
    });

    test('should find specific staff member (Bari)', async () => {
      // Look for staff named Bari (actual production staff)
      const staff = await staffRepo.findAll(TEST_COMPANY_ID, false);
      const bari = staff.find(s => s.name && s.name.toLowerCase().includes('бари'));

      if (bari) {
        console.log(`Found Bari: yclients_id=${bari.yclients_id}, name=${bari.name}`);
        expect(bari.yclients_id).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle staff with NULL specialization', async () => {
      await staffRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Test Staff',
          specialization: null,
          is_active: true
        }
      ]);

      const fetched = await staffRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);

      expect(fetched.specialization).toBeNull();
    });

    test('should handle Russian characters in name', async () => {
      await staffRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Бари Саргсян',
          specialization: 'Парикмахер-универсал',
          is_active: true
        }
      ]);

      const fetched = await staffRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);

      expect(fetched.name).toBe('Бари Саргсян');
      expect(fetched.specialization).toBe('Парикмахер-универсал');
    });

    test('should handle is_active toggle', async () => {
      // Insert active
      await staffRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Test Staff',
          is_active: true
        }
      ]);

      let fetched = await staffRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);
      expect(fetched.is_active).toBe(true);

      // Update to inactive
      await staffRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Test Staff',
          is_active: false
        }
      ]);

      fetched = await staffRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);
      expect(fetched.is_active).toBe(false);
    });
  });
});
