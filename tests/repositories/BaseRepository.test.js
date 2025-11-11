/**
 * BaseRepository Integration Tests
 *
 * Tests against production Timeweb PostgreSQL database.
 * Uses TEST_MARKERS to ensure safe test data cleanup.
 *
 * Run with: npm run test:repositories
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const BaseRepository = require('../../src/repositories/BaseRepository');
const postgres = require('../../src/database/postgres');
const {
  TEST_MARKERS,
  cleanupTestData,
  createTestClient,
  getDatabaseStats
} = require('../helpers/db-helper');

describe('BaseRepository Integration Tests', () => {
  let repo;
  let testClient;

  beforeAll(async () => {
    // Initialize repository
    repo = new BaseRepository(postgres);

    // Clean up any leftover test data
    await cleanupTestData({ dryRun: false });

    // Create a test client for use in tests
    testClient = await createTestClient({
      name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} BaseRepository Test`,
      phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}001`
    });
  });

  afterAll(async () => {
    // Clean up test data after all tests
    await cleanupTestData({ dryRun: false });
  });

  describe('findOne()', () => {
    test('should find existing client by phone', async () => {
      const client = await repo.findOne('clients', {
        phone: testClient.phone
      });

      expect(client).not.toBeNull();
      expect(client.phone).toBe(testClient.phone);
      expect(client.name).toContain(TEST_MARKERS.TEST_CLIENT_NAME_MARKER);
    });

    test('should return null when client not found', async () => {
      const client = await repo.findOne('clients', {
        phone: '89686484488999999' // Non-existent test phone
      });

      expect(client).toBeNull();
    });

    test('should support complex filters with gte operator', async () => {
      const client = await repo.findOne('clients', {
        phone: testClient.phone,
        created_at: { gte: '2025-01-01' }
      });

      expect(client).not.toBeNull();
      expect(client.phone).toBe(testClient.phone);
    });

    test('should support ilike operator for case-insensitive search', async () => {
      const client = await repo.findOne('clients', {
        name: { ilike: '%test%' }
      });

      expect(client).not.toBeNull();
      expect(client.name.toLowerCase()).toContain('test');
    });
  });

  describe('findMany()', () => {
    test('should find multiple test clients', async () => {
      // Create additional test client
      const testClient2 = await createTestClient({
        phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}002`
      });

      const clients = await repo.findMany('clients', {
        phone: { ilike: `${TEST_MARKERS.TEST_PHONE_PREFIX}%` }
      });

      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBeGreaterThanOrEqual(2);
      expect(clients.every(c => c.phone.startsWith(TEST_MARKERS.TEST_PHONE_PREFIX))).toBe(true);
    });

    test('should return empty array when no results', async () => {
      const clients = await repo.findMany('clients', {
        phone: '89686484488999999'
      });

      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBe(0);
    });

    test('should support orderBy option', async () => {
      const clients = await repo.findMany(
        'clients',
        { phone: { ilike: `${TEST_MARKERS.TEST_PHONE_PREFIX}%` } },
        { orderBy: 'phone', order: 'asc' }
      );

      expect(clients.length).toBeGreaterThan(0);

      // Verify ascending order
      for (let i = 1; i < clients.length; i++) {
        expect(clients[i].phone >= clients[i - 1].phone).toBe(true);
      }
    });

    test('should support limit option', async () => {
      const clients = await repo.findMany(
        'clients',
        { phone: { ilike: `${TEST_MARKERS.TEST_PHONE_PREFIX}%` } },
        { limit: 1 }
      );

      expect(clients.length).toBe(1);
    });

    test('should support offset option', async () => {
      const allClients = await repo.findMany('clients', {
        phone: { ilike: `${TEST_MARKERS.TEST_PHONE_PREFIX}%` }
      });

      if (allClients.length > 1) {
        const offsetClients = await repo.findMany(
          'clients',
          { phone: { ilike: `${TEST_MARKERS.TEST_PHONE_PREFIX}%` } },
          { offset: 1, limit: 1 }
        );

        expect(offsetClients.length).toBe(1);
        expect(offsetClients[0].id).not.toBe(allClients[0].id);
      }
    });

    test('should support in operator', async () => {
      const clients = await repo.findMany('clients', {
        phone: { in: [testClient.phone, `${TEST_MARKERS.TEST_PHONE_PREFIX}002`] }
      });

      expect(clients.length).toBeGreaterThan(0);
      expect(clients.every(c =>
        c.phone === testClient.phone || c.phone === `${TEST_MARKERS.TEST_PHONE_PREFIX}002`
      )).toBe(true);
    });
  });

  describe('upsert()', () => {
    test('should insert new client', async () => {
      const newPhone = `${TEST_MARKERS.TEST_PHONE_PREFIX}100`;
      const testYClientsId = 9900000 + Math.floor(Math.random() * 99999);

      const newClient = await repo.upsert(
        'clients',
        {
          phone: newPhone,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Upsert Test`,
          email: `test-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          yclients_id: testYClientsId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        ['yclients_id']  // Use yclients_id as conflict column (has unique index)
      );

      expect(newClient).toBeDefined();
      expect(newClient.phone).toBe(newPhone);
      expect(newClient.name).toContain('Upsert Test');

      // Verify it was actually inserted
      const found = await repo.findOne('clients', { phone: newPhone });
      expect(found).not.toBeNull();
      expect(found.id).toBe(newClient.id);
    });

    test('should update existing client on conflict', async () => {
      const phone = `${TEST_MARKERS.TEST_PHONE_PREFIX}101`;
      const companyId = TEST_MARKERS.TEST_COMPANY_IDS[0];
      const testYClientsId = 9900000 + Math.floor(Math.random() * 99999);

      // First insert
      const client1 = await repo.upsert(
        'clients',
        {
          phone,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Original`,
          email: `test-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
          company_id: companyId,
          yclients_id: testYClientsId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        ['yclients_id']
      );

      expect(client1.name).toContain('Original');
      const originalId = client1.id;

      // Second upsert (should update)
      const client2 = await repo.upsert(
        'clients',
        {
          phone,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Updated`,
          email: `test-updated-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
          company_id: companyId,
          yclients_id: testYClientsId, // Same yclients_id → UPDATE
          created_at: client1.created_at, // Keep original created_at
          updated_at: new Date().toISOString()
        },
        ['yclients_id']
      );

      expect(client2.id).toBe(originalId); // Same ID (updated, not inserted)
      expect(client2.name).toContain('Updated');
      expect(client2.email).toContain('updated');
    });

    test('should return upserted record with all fields', async () => {
      const phone = `${TEST_MARKERS.TEST_PHONE_PREFIX}102`;
      const testYClientsId = 9900000 + Math.floor(Math.random() * 99999);

      const client = await repo.upsert(
        'clients',
        {
          phone,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Full Fields`,
          email: `test-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          yclients_id: testYClientsId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        ['yclients_id']
      );

      // Verify all fields are returned
      expect(client).toHaveProperty('id');
      expect(client).toHaveProperty('phone');
      expect(client).toHaveProperty('name');
      expect(client).toHaveProperty('email');
      expect(client).toHaveProperty('company_id');
      expect(client).toHaveProperty('created_at');
      expect(client).toHaveProperty('updated_at');
    });
  });

  describe('bulkUpsert()', () => {
    test('should insert multiple new clients', async () => {
      const testYClientsId1 = 9900000 + Math.floor(Math.random() * 99999);
      const testYClientsId2 = 9900000 + Math.floor(Math.random() * 99999);

      const bulkData = [
        {
          phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}200`,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Bulk 1`,
          email: `bulk1-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          yclients_id: testYClientsId1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}201`,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Bulk 2`,
          email: `bulk2-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          yclients_id: testYClientsId2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const results = await repo.bulkUpsert('clients', bulkData, ['yclients_id']);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0].phone).toBe(`${TEST_MARKERS.TEST_PHONE_PREFIX}200`);
      expect(results[1].phone).toBe(`${TEST_MARKERS.TEST_PHONE_PREFIX}201`);
    });

    test('should update existing clients on conflict', async () => {
      const phone = `${TEST_MARKERS.TEST_PHONE_PREFIX}202`;
      const companyId = TEST_MARKERS.TEST_COMPANY_IDS[0];
      const testYClientsId = 9900000 + Math.floor(Math.random() * 99999);

      // First bulk insert
      const initial = await repo.bulkUpsert(
        'clients',
        [{
          phone,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Bulk Original`,
          email: `bulk-original-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
          company_id: companyId,
          yclients_id: testYClientsId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        ['yclients_id']
      );

      const originalId = initial[0].id;

      // Second bulk upsert (should update)
      const updated = await repo.bulkUpsert(
        'clients',
        [{
          phone,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Bulk Updated`,
          email: `bulk-updated-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
          company_id: companyId,
          yclients_id: testYClientsId, // Same yclients_id → UPDATE
          created_at: initial[0].created_at,
          updated_at: new Date().toISOString()
        }],
        ['yclients_id']
      );

      expect(updated[0].id).toBe(originalId); // Same ID
      expect(updated[0].name).toContain('Updated');
    });

    test('should return empty array when given empty array', async () => {
      const results = await repo.bulkUpsert('clients', [], ['phone', 'company_id']);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should handle batch size limit', async () => {
      // Create array exceeding max batch size (500)
      const largeBatch = Array.from({ length: 501 }, (_, i) => ({
        phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}${i}`,
        name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Bulk ${i}`,
        email: `bulk${i}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
        company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Should throw error
      await expect(
        repo.bulkUpsert('clients', largeBatch, ['phone', 'company_id'])
      ).rejects.toThrow('exceeds maximum');
    });
  });

  describe('withTransaction()', () => {
    test('should commit transaction on success', async () => {
      const phone = `${TEST_MARKERS.TEST_PHONE_PREFIX}300`;
      const testYClientsId = 9900000 + Math.floor(Math.random() * 99999);

      const result = await repo.withTransaction(async (client) => {
        // Insert client within transaction
        const clientResult = await client.query(
          `INSERT INTO clients (phone, name, email, company_id, yclients_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING *`,
          [
            phone,
            `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Transaction Test`,
            `trans-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
            TEST_MARKERS.TEST_COMPANY_IDS[0],
            testYClientsId
          ]
        );

        return clientResult.rows[0];
      });

      // Verify data was committed
      const found = await repo.findOne('clients', { phone });
      expect(found).not.toBeNull();
      expect(found.id).toBe(result.id);
    });

    test('should rollback transaction on error', async () => {
      const phone = `${TEST_MARKERS.TEST_PHONE_PREFIX}301`;
      const testYClientsId = 9900000 + Math.floor(Math.random() * 99999);

      try {
        await repo.withTransaction(async (client) => {
          // Insert client
          await client.query(
            `INSERT INTO clients (phone, name, email, company_id, yclients_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
              phone,
              `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Rollback Test`,
              `rollback-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
              TEST_MARKERS.TEST_COMPANY_IDS[0],
              testYClientsId
            ]
          );

          // Throw error to trigger rollback
          throw new Error('Intentional error for rollback test');
        });
      } catch (error) {
        expect(error.message).toContain('Intentional error');
      }

      // Verify data was NOT committed (rolled back)
      const found = await repo.findOne('clients', { phone });
      expect(found).toBeNull();
    });

    test('should handle multiple operations in transaction', async () => {
      const phone1 = `${TEST_MARKERS.TEST_PHONE_PREFIX}302`;
      const phone2 = `${TEST_MARKERS.TEST_PHONE_PREFIX}303`;
      const testYClientsId1 = 9900000 + Math.floor(Math.random() * 99999);
      const testYClientsId2 = 9900000 + Math.floor(Math.random() * 99999);

      const results = await repo.withTransaction(async (client) => {
        // Insert first client
        const client1 = await client.query(
          `INSERT INTO clients (phone, name, email, company_id, yclients_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING *`,
          [
            phone1,
            `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Multi 1`,
            `multi1-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
            TEST_MARKERS.TEST_COMPANY_IDS[0],
            testYClientsId1
          ]
        );

        // Insert second client
        const client2 = await client.query(
          `INSERT INTO clients (phone, name, email, company_id, yclients_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING *`,
          [
            phone2,
            `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Multi 2`,
            `multi2-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
            TEST_MARKERS.TEST_COMPANY_IDS[0],
            testYClientsId2
          ]
        );

        return [client1.rows[0], client2.rows[0]];
      });

      // Verify both were committed
      const found1 = await repo.findOne('clients', { phone: phone1 });
      const found2 = await repo.findOne('clients', { phone: phone2 });

      expect(found1).not.toBeNull();
      expect(found2).not.toBeNull();
      expect(results.length).toBe(2);
    });
  });

  describe('_buildWhere() filters', () => {
    test('should support neq (not equal) operator', async () => {
      const clients = await repo.findMany('clients', {
        phone: { neq: '00000000000' },
        name: { ilike: `%${TEST_MARKERS.TEST_CLIENT_NAME_MARKER}%` }
      });

      expect(clients.length).toBeGreaterThan(0);
      expect(clients.every(c => c.phone !== '00000000000')).toBe(true);
    });

    test('should support null check', async () => {
      // Find clients with null yclients_id
      const clients = await repo.findMany('clients', {
        yclients_id: null,
        phone: { ilike: `${TEST_MARKERS.TEST_PHONE_PREFIX}%` }
      });

      // At least some test clients should have null yclients_id
      expect(Array.isArray(clients)).toBe(true);
    });

    test('should support lte (less than or equal) operator', async () => {
      const futureDate = new Date('2099-12-31').toISOString();

      const clients = await repo.findMany('clients', {
        created_at: { lte: futureDate },
        phone: { ilike: `${TEST_MARKERS.TEST_PHONE_PREFIX}%` }
      });

      expect(clients.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid table name', async () => {
      await expect(
        repo.findOne('invalid_table_name_that_does_not_exist', { id: 1 })
      ).rejects.toThrow();
    });

    test('should throw error for invalid column name', async () => {
      await expect(
        repo.findOne('clients', { invalid_column_xyz: 'value' })
      ).rejects.toThrow();
    });

    test('should throw error for empty upsert data', async () => {
      await expect(
        repo.upsert('clients', {}, ['phone'])
      ).rejects.toThrow('cannot be empty');
    });

    test('should throw error for IN operator with empty array', async () => {
      await expect(
        repo.findMany('clients', { phone: { in: [] } })
      ).rejects.toThrow('non-empty array');
    });
  });

  describe('Database Stats', () => {
    test('should verify test data is marked correctly', async () => {
      const stats = await getDatabaseStats();

      expect(stats.test_clients).toBeGreaterThan(0);
      expect(stats.total_clients).toBeGreaterThanOrEqual(stats.test_clients);

      console.log('Test data statistics:', {
        total_clients: stats.total_clients,
        test_clients: stats.test_clients,
        test_contexts: stats.test_contexts
      });
    });
  });
});
