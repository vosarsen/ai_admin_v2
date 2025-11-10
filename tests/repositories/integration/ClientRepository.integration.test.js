/**
 * Integration Tests for ClientRepository
 *
 * Tests against REAL Timeweb PostgreSQL database.
 * Creates and cleans up test data.
 *
 * Requirements:
 * - Timeweb PostgreSQL must be accessible
 * - Schema must be created (from Phase 0.8)
 * - Run with: npm run test:integration
 */

const { ClientRepository } = require('../../../src/repositories');
const postgres = require('../../../src/database/postgres');

describe('ClientRepository Integration Tests', () => {
  let clientRepo;
  const TEST_YCLIENTS_ID = 99999;
  const TEST_COMPANY_ID = 962302;

  beforeAll(() => {
    clientRepo = new ClientRepository(postgres);
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await postgres.query(
      'DELETE FROM clients WHERE yclients_id = $1',
      [TEST_YCLIENTS_ID]
    );
  });

  afterEach(async () => {
    // Clean up test data
    await postgres.query(
      'DELETE FROM clients WHERE yclients_id = $1',
      [TEST_YCLIENTS_ID]
    );
  });

  afterAll(async () => {
    // Ensure cleanup
    await postgres.query(
      'DELETE FROM clients WHERE yclients_id = $1',
      [TEST_YCLIENTS_ID]
    );
  });

  describe('findByPhone()', () => {
    test('should find client by phone number', async () => {
      // Insert test client
      await clientRepo.upsert({
        yclients_id: TEST_YCLIENTS_ID,
        company_id: TEST_COMPANY_ID,
        name: 'Test Client',
        phone: '89999999999',
        created_at: new Date().toISOString()
      });

      const result = await clientRepo.findByPhone('89999999999');

      expect(result).toBeTruthy();
      expect(result.phone).toBe('89999999999');
      expect(result.name).toBe('Test Client');
      expect(result.yclients_id).toBe(TEST_YCLIENTS_ID);
    });

    test('should return null for non-existent phone', async () => {
      const result = await clientRepo.findByPhone('80000000000');

      expect(result).toBeNull();
    });
  });

  describe('findById()', () => {
    test('should find client by yclients_id and company_id', async () => {
      await clientRepo.upsert({
        yclients_id: TEST_YCLIENTS_ID,
        company_id: TEST_COMPANY_ID,
        name: 'Test Client by ID',
        phone: '89999999999'
      });

      const result = await clientRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);

      expect(result).toBeTruthy();
      expect(result.yclients_id).toBe(TEST_YCLIENTS_ID);
      expect(result.company_id).toBe(TEST_COMPANY_ID);
      expect(result.name).toBe('Test Client by ID');
    });

    test('should return null for non-existent id', async () => {
      const result = await clientRepo.findById(88888, TEST_COMPANY_ID);

      expect(result).toBeNull();
    });
  });

  describe('searchByName()', () => {
    test('should find clients by partial name (case-insensitive)', async () => {
      // Insert test clients
      await clientRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Тестовый Клиент',
          phone: '89999999991'
        },
        {
          yclients_id: TEST_YCLIENTS_ID + 1,
          company_id: TEST_COMPANY_ID,
          name: 'Другой Тестовый',
          phone: '89999999992'
        }
      ]);

      const results = await clientRepo.searchByName(TEST_COMPANY_ID, 'тест', 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(c => c.name.includes('Тест'))).toBe(true);

      // Clean up additional test client
      await postgres.query(
        'DELETE FROM clients WHERE yclients_id = $1',
        [TEST_YCLIENTS_ID + 1]
      );
    });

    test('should return empty array for no matches', async () => {
      const results = await clientRepo.searchByName(TEST_COMPANY_ID, 'NONEXISTENT', 10);

      expect(results).toEqual([]);
    });

    test('should respect limit parameter', async () => {
      const results = await clientRepo.searchByName(TEST_COMPANY_ID, '', 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('upsert()', () => {
    test('should insert new client', async () => {
      const newClient = {
        yclients_id: TEST_YCLIENTS_ID,
        company_id: TEST_COMPANY_ID,
        name: 'New Client',
        phone: '89999999999',
        email: 'test@example.com',
        created_at: new Date().toISOString()
      };

      const result = await clientRepo.upsert(newClient);

      expect(result).toBeTruthy();
      expect(result.name).toBe('New Client');
      expect(result.phone).toBe('89999999999');
      expect(result.email).toBe('test@example.com');

      // Verify insert
      const fetched = await clientRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);
      expect(fetched.name).toBe('New Client');
    });

    test('should update existing client', async () => {
      // Insert
      await clientRepo.upsert({
        yclients_id: TEST_YCLIENTS_ID,
        company_id: TEST_COMPANY_ID,
        name: 'Original Name',
        phone: '89999999999'
      });

      // Update
      const updated = await clientRepo.upsert({
        yclients_id: TEST_YCLIENTS_ID,
        company_id: TEST_COMPANY_ID,
        name: 'Updated Name',
        phone: '89999999999',
        email: 'updated@example.com'
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.email).toBe('updated@example.com');

      // Verify update
      const fetched = await clientRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);
      expect(fetched.name).toBe('Updated Name');
    });
  });

  describe('bulkUpsert()', () => {
    test('should insert multiple clients', async () => {
      const clients = [
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Client 1',
          phone: '89999999991'
        },
        {
          yclients_id: TEST_YCLIENTS_ID + 1,
          company_id: TEST_COMPANY_ID,
          name: 'Client 2',
          phone: '89999999992'
        },
        {
          yclients_id: TEST_YCLIENTS_ID + 2,
          company_id: TEST_COMPANY_ID,
          name: 'Client 3',
          phone: '89999999993'
        }
      ];

      const results = await clientRepo.bulkUpsert(clients);

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('Client 1');
      expect(results[1].name).toBe('Client 2');
      expect(results[2].name).toBe('Client 3');

      // Clean up
      await postgres.query(
        'DELETE FROM clients WHERE yclients_id IN ($1, $2, $3)',
        [TEST_YCLIENTS_ID, TEST_YCLIENTS_ID + 1, TEST_YCLIENTS_ID + 2]
      );
    });

    test('should update existing clients on conflict', async () => {
      // Insert initial data
      await clientRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Original',
          phone: '89999999999'
        }
      ]);

      // Update with bulkUpsert
      const updated = await clientRepo.bulkUpsert([
        {
          yclients_id: TEST_YCLIENTS_ID,
          company_id: TEST_COMPANY_ID,
          name: 'Updated',
          phone: '89999999999',
          email: 'new@example.com'
        }
      ]);

      expect(updated[0].name).toBe('Updated');
      expect(updated[0].email).toBe('new@example.com');
    });
  });

  describe('Edge Cases', () => {
    test('should handle clients with NULL email', async () => {
      await clientRepo.upsert({
        yclients_id: TEST_YCLIENTS_ID,
        company_id: TEST_COMPANY_ID,
        name: 'No Email Client',
        phone: '89999999999',
        email: null
      });

      const result = await clientRepo.findById(TEST_YCLIENTS_ID, TEST_COMPANY_ID);

      expect(result.email).toBeNull();
    });

    test('should handle Russian characters in name', async () => {
      await clientRepo.upsert({
        yclients_id: TEST_YCLIENTS_ID,
        company_id: TEST_COMPANY_ID,
        name: 'Иван Иванович Иванов',
        phone: '89999999999'
      });

      const result = await clientRepo.findByPhone('89999999999');

      expect(result.name).toBe('Иван Иванович Иванов');
    });
  });
});
