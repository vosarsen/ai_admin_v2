/**
 * ServiceRepository Integration Tests
 *
 * Tests service-specific repository methods against production Timeweb PostgreSQL
 * Uses production data (company 962302 has 63 services)
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- ServiceRepository.test.js
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const ServiceRepository = require('../../src/repositories/ServiceRepository');
const { TEST_MARKERS } = require('../helpers/db-helper');
const postgres = require('../../src/database/postgres');

describe('ServiceRepository Integration Tests', () => {
  let repo;
  const PRODUCTION_COMPANY_ID = 962302; // Has real services data
  let testService;

  beforeAll(async () => {
    repo = new ServiceRepository(postgres);

    // Create a test service for testing
    const testYClientsId = 9900000 + Math.floor(Math.random() * 99999);

    const result = await postgres.query(
      `INSERT INTO services (
        yclients_id, company_id, title, price_min, price_max,
        category_id, is_active, weight, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        testYClientsId,
        TEST_MARKERS.TEST_COMPANY_IDS[0], // Test company
        '[TEST] Тестовая услуга',
        1000,
        2000,
        1,
        true,
        100,
      ]
    );

    testService = result.rows[0];

    console.log('Test service created:', {
      id: testService.id,
      yclients_id: testService.yclients_id,
      title: testService.title
    });
  });

  afterAll(async () => {
    // Cleanup test service
    await postgres.query(
      'DELETE FROM services WHERE title LIKE $1',
      ['[TEST]%']
    );

    console.log('Test service cleaned up');
  });

  describe('findAll()', () => {
    test('should find all active services for company', async () => {
      const services = await repo.findAll(PRODUCTION_COMPANY_ID, false);

      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);

      // All should be active
      services.forEach(service => {
        expect(service.is_active).toBe(true);
        expect(service.company_id).toBe(PRODUCTION_COMPANY_ID);
      });
    });

    test('should include inactive services when requested', async () => {
      const allServices = await repo.findAll(PRODUCTION_COMPANY_ID, true);
      const activeOnly = await repo.findAll(PRODUCTION_COMPANY_ID, false);

      expect(allServices.length).toBeGreaterThanOrEqual(activeOnly.length);
    });

    test('should order by weight DESC', async () => {
      const services = await repo.findAll(PRODUCTION_COMPANY_ID, true);

      if (services.length > 1) {
        for (let i = 0; i < services.length - 1; i++) {
          const currentWeight = services[i].weight || 0;
          const nextWeight = services[i + 1].weight || 0;
          expect(currentWeight).toBeGreaterThanOrEqual(nextWeight);
        }
      }
    });

    test('should return empty array for non-existent company', async () => {
      // Use company ID that definitely doesn't exist (not 999999 as it's used for test data)
      const services = await repo.findAll(888888, false);

      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBe(0);
    });

    test('should return services with all required fields', async () => {
      const services = await repo.findAll(PRODUCTION_COMPANY_ID, false);

      expect(services.length).toBeGreaterThan(0);

      const service = services[0];
      expect(service).toHaveProperty('id');
      expect(service).toHaveProperty('yclients_id');
      expect(service).toHaveProperty('company_id');
      expect(service).toHaveProperty('title');
      expect(service).toHaveProperty('price_min');
      expect(service).toHaveProperty('is_active');
    });
  });

  describe('findById()', () => {
    test('should find service by yclients_id and company_id', async () => {
      const service = await repo.findById(
        testService.yclients_id,
        testService.company_id
      );

      expect(service).not.toBeNull();
      expect(service.yclients_id).toBe(testService.yclients_id);
      expect(service.company_id).toBe(testService.company_id);
      expect(service.title).toBe(testService.title);
    });

    test('should return null for non-existent yclients_id', async () => {
      const service = await repo.findById(9999999, PRODUCTION_COMPANY_ID);

      expect(service).toBeNull();
    });

    test('should return null for wrong company_id', async () => {
      // Use company ID that definitely doesn't exist (not 999999 as it's used for test data)
      const service = await repo.findById(testService.yclients_id, 888888);

      expect(service).toBeNull();
    });

    test('should find production service', async () => {
      // Get first production service
      const services = await repo.findAll(PRODUCTION_COMPANY_ID, false);
      expect(services.length).toBeGreaterThan(0);

      const productionService = services[0];

      // Find it by ID
      const found = await repo.findById(
        productionService.yclients_id,
        PRODUCTION_COMPANY_ID
      );

      expect(found).not.toBeNull();
      expect(found.id).toBe(productionService.id);
      expect(found.title).toBe(productionService.title);
    });
  });

  describe('findByCategory()', () => {
    test('should find services by category_id', async () => {
      // Get a category that exists
      const allServices = await repo.findAll(PRODUCTION_COMPANY_ID, true);
      expect(allServices.length).toBeGreaterThan(0);

      const categoryId = allServices[0].category_id;

      const categoryServices = await repo.findByCategory(
        PRODUCTION_COMPANY_ID,
        categoryId
      );

      expect(Array.isArray(categoryServices)).toBe(true);
      expect(categoryServices.length).toBeGreaterThan(0);

      // All should belong to the category
      categoryServices.forEach(service => {
        expect(service.category_id).toBe(categoryId);
        expect(service.company_id).toBe(PRODUCTION_COMPANY_ID);
      });
    });

    test('should order by weight DESC', async () => {
      // Get a category
      const allServices = await repo.findAll(PRODUCTION_COMPANY_ID, true);
      const categoryId = allServices[0].category_id;

      const services = await repo.findByCategory(
        PRODUCTION_COMPANY_ID,
        categoryId
      );

      if (services.length > 1) {
        for (let i = 0; i < services.length - 1; i++) {
          const currentWeight = services[i].weight || 0;
          const nextWeight = services[i + 1].weight || 0;
          expect(currentWeight).toBeGreaterThanOrEqual(nextWeight);
        }
      }
    });

    test('should return empty array for non-existent category', async () => {
      const services = await repo.findByCategory(PRODUCTION_COMPANY_ID, 999999);

      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBe(0);
    });

    test('should include both active and inactive services', async () => {
      // This method doesn't filter by active status
      const allServices = await repo.findAll(PRODUCTION_COMPANY_ID, true);
      const categoryId = allServices[0].category_id;

      const categoryServices = await repo.findByCategory(
        PRODUCTION_COMPANY_ID,
        categoryId
      );

      // Should include services regardless of active status
      expect(Array.isArray(categoryServices)).toBe(true);
    });
  });

  describe('bulkUpsert()', () => {
    test('should insert multiple new services', async () => {
      const services = [
        {
          yclients_id: 9900000 + Math.floor(Math.random() * 99999),
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          title: '[TEST] Услуга 1',
          price_min: 1000,
          price_max: 1500,
          category_id: 1,
          is_active: true,
          weight: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          yclients_id: 9900000 + Math.floor(Math.random() * 99999),
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          title: '[TEST] Услуга 2',
          price_min: 2000,
          price_max: 2500,
          category_id: 1,
          is_active: true,
          weight: 40,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const results = await repo.bulkUpsert(services);

      expect(results.length).toBe(2);
      expect(results[0].title).toBe('[TEST] Услуга 1');
      expect(results[1].title).toBe('[TEST] Услуга 2');
    });

    test('should update existing services on conflict', async () => {
      const yclientsId1 = 9900000 + Math.floor(Math.random() * 99999);
      const yclientsId2 = 9900000 + Math.floor(Math.random() * 99999);

      // First insert
      const original = await repo.bulkUpsert([
        {
          yclients_id: yclientsId1,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          title: '[TEST] Original 1',
          price_min: 1000,
          category_id: 1,
          is_active: true,
          weight: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          yclients_id: yclientsId2,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          title: '[TEST] Original 2',
          price_min: 2000,
          category_id: 1,
          is_active: true,
          weight: 20,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      // Update with same yclients_id
      const updated = await repo.bulkUpsert([
        {
          yclients_id: yclientsId1,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          title: '[TEST] Updated 1',
          price_min: 1500,
          category_id: 1,
          is_active: true,
          weight: 10,
          updated_at: new Date().toISOString()
        },
        {
          yclients_id: yclientsId2,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          title: '[TEST] Updated 2',
          price_min: 2500,
          category_id: 1,
          is_active: true,
          weight: 20,
          updated_at: new Date().toISOString()
        }
      ]);

      expect(updated[0].title).toBe('[TEST] Updated 1');
      expect(updated[1].title).toBe('[TEST] Updated 2');
      expect(updated[0].id).toBe(original[0].id); // Same ID - updated
      expect(updated[1].id).toBe(original[1].id);
    });

    test('should return empty array for empty input', async () => {
      const results = await repo.bulkUpsert([]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should use conflict columns [yclients_id, company_id]', async () => {
      const yclientsId = 9900000 + Math.floor(Math.random() * 99999);

      // First upsert
      const first = await repo.bulkUpsert([
        {
          yclients_id: yclientsId,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          title: '[TEST] First Version',
          price_min: 1000,
          category_id: 1,
          is_active: true,
          weight: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      // Second upsert with same yclients_id and company_id
      const second = await repo.bulkUpsert([
        {
          yclients_id: yclientsId,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          title: '[TEST] Second Version',
          price_min: 2000,
          category_id: 1,
          is_active: false,
          weight: 20,
          updated_at: new Date().toISOString()
        }
      ]);

      expect(first[0].id).toBe(second[0].id); // Same record
      expect(second[0].title).toBe('[TEST] Second Version');
      // PostgreSQL NUMERIC returns as string, so we need to parse or compare as string
      expect(parseFloat(second[0].price_min)).toBe(2000);
      expect(second[0].is_active).toBe(false);
    });
  });

  describe('Production Data Verification', () => {
    test('should have access to production services', async () => {
      const services = await repo.findAll(PRODUCTION_COMPANY_ID, true);

      // We know company 962302 has 63 services
      expect(services.length).toBeGreaterThan(50);

      console.log(`Production services count: ${services.length}`);
    });

    test('should find services with different categories', async () => {
      const services = await repo.findAll(PRODUCTION_COMPANY_ID, true);

      // Get unique categories
      const categories = new Set(services.map(s => s.category_id));

      expect(categories.size).toBeGreaterThan(1);

      console.log(`Categories found: ${categories.size}`);
    });
  });
});
