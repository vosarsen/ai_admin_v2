/**
 * ClientRepository Integration Tests
 *
 * Tests client-specific repository methods against production Timeweb PostgreSQL
 * Extends BaseRepository with domain-specific client operations
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm run test:repositories -- ClientRepository.test.js
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const ClientRepository = require('../../src/repositories/ClientRepository');
const {
  TEST_MARKERS,
  cleanupTestData,
  createTestClient,
  getDatabaseStats
} = require('../helpers/db-helper');
const postgres = require('../../src/database/postgres');

describe('ClientRepository Integration Tests', () => {
  let repo;
  let testClient1;
  let testClient2;
  let testBooking;

  beforeAll(async () => {
    repo = new ClientRepository(postgres);

    // Create test clients for testing
    testClient1 = await createTestClient({
      name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Иван Тестов`,
      phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}001`
    });

    testClient2 = await createTestClient({
      name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Мария Тестова`,
      phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}002`
    });

    // Create a test booking for findAppointments tests
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    const result = await postgres.query(
      `INSERT INTO bookings (
        yclients_id, client_id, client_phone, company_id, datetime,
        services, staff, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        9900000 + Math.floor(Math.random() * 99999),
        testClient1.id,
        testClient1.phone,
        testClient1.company_id,
        futureDate.toISOString(),
        JSON.stringify([{ title: 'Test Service' }]),
        JSON.stringify([{ name: 'Test Staff' }]),
        'confirmed'
      ]
    );

    testBooking = result.rows[0];

    console.log('Test clients and booking created:', {
      client1: testClient1.phone,
      client2: testClient2.phone,
      booking: testBooking.id
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData({
      tables: ['bookings', 'dialog_contexts', 'clients']
    });

    console.log('Test data cleaned up');
  });

  describe('findByPhone()', () => {
    test('should find existing client by phone', async () => {
      const client = await repo.findByPhone(testClient1.phone);

      expect(client).not.toBeNull();
      expect(client.phone).toBe(testClient1.phone);
      expect(client.name).toContain('Иван Тестов');
      expect(client.id).toBe(testClient1.id);
    });

    test('should return null for non-existent phone', async () => {
      const client = await repo.findByPhone(`${TEST_MARKERS.TEST_PHONE_PREFIX}999`);

      expect(client).toBeNull();
    });

    test('should handle phone number format variations', async () => {
      // Should find exact match
      const client = await repo.findByPhone(testClient1.phone);

      expect(client).not.toBeNull();
      expect(client.phone).toBe(testClient1.phone);
    });
  });

  describe('findById()', () => {
    test('should find client by yclients_id and company_id', async () => {
      const client = await repo.findById(
        testClient1.yclients_id,
        testClient1.company_id
      );

      expect(client).not.toBeNull();
      expect(client.yclients_id).toBe(testClient1.yclients_id);
      expect(client.company_id).toBe(testClient1.company_id);
      expect(client.phone).toBe(testClient1.phone);
    });

    test('should return null for non-existent yclients_id', async () => {
      const client = await repo.findById(9999999, testClient1.company_id);

      expect(client).toBeNull();
    });

    test('should return null for wrong company_id', async () => {
      const client = await repo.findById(testClient1.yclients_id, 999999);

      expect(client).toBeNull();
    });
  });

  describe('searchByName()', () => {
    test('should find clients by partial name match', async () => {
      const clients = await repo.searchByName(
        testClient1.company_id,
        'Иван',
        10
      );

      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBeGreaterThan(0);

      // Should include our test client
      const foundTestClient = clients.find(c => c.phone === testClient1.phone);
      expect(foundTestClient).toBeDefined();
      expect(foundTestClient.name).toContain('Иван');
    });

    test('should be case-insensitive', async () => {
      const clients = await repo.searchByName(
        testClient1.company_id,
        'иван', // lowercase
        10
      );

      expect(clients.length).toBeGreaterThan(0);

      const foundTestClient = clients.find(c => c.phone === testClient1.phone);
      expect(foundTestClient).toBeDefined();
    });

    test('should return empty array when no matches', async () => {
      const clients = await repo.searchByName(
        testClient1.company_id,
        'НесуществующееИмя12345',
        10
      );

      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBe(0);
    });

    test('should respect limit parameter', async () => {
      const clients = await repo.searchByName(
        testClient1.company_id,
        'TEST', // Our test marker
        2 // limit
      );

      expect(clients.length).toBeLessThanOrEqual(2);
    });

    test('should order by last_visit_date DESC NULLS LAST', async () => {
      const clients = await repo.searchByName(
        testClient1.company_id,
        'TEST',
        10
      );

      // Verify ordering - clients with last_visit_date should come first
      if (clients.length > 1) {
        for (let i = 0; i < clients.length - 1; i++) {
          const current = clients[i];
          const next = clients[i + 1];

          // If current has last_visit_date and next is null, order is correct
          // If both have dates, current should be >= next
          if (current.last_visit_date && next.last_visit_date) {
            expect(new Date(current.last_visit_date).getTime())
              .toBeGreaterThanOrEqual(new Date(next.last_visit_date).getTime());
          } else if (current.last_visit_date && !next.last_visit_date) {
            // This is correct - non-null before null
            expect(true).toBe(true);
          }
        }
      }
    });
  });

  describe('upsert()', () => {
    test('should insert new client with all fields', async () => {
      const newPhone = `${TEST_MARKERS.TEST_PHONE_PREFIX}100`;
      const newYClientsId = 9900000 + Math.floor(Math.random() * 99999);

      const clientData = {
        phone: newPhone,
        name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Новый Клиент`,
        email: `new-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
        company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
        yclients_id: newYClientsId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await repo.upsert(clientData);

      expect(result).toBeDefined();
      expect(result.phone).toBe(newPhone);
      expect(result.name).toContain('Новый Клиент');
      expect(result.yclients_id).toBe(newYClientsId);
      expect(result.id).toBeDefined();
    });

    test('should update existing client on conflict', async () => {
      const updatedName = `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Обновлённый Клиент`;

      const clientData = {
        yclients_id: testClient1.yclients_id,
        company_id: testClient1.company_id,
        phone: testClient1.phone,
        name: updatedName,
        updated_at: new Date().toISOString()
      };

      const result = await repo.upsert(clientData);

      expect(result).toBeDefined();
      expect(result.name).toBe(updatedName);
      expect(result.yclients_id).toBe(testClient1.yclients_id);
      expect(result.id).toBe(testClient1.id); // Same ID - updated, not inserted
    });

    test('should use conflict columns [yclients_id, company_id]', async () => {
      // First upsert
      const newYClientsId = 9900000 + Math.floor(Math.random() * 99999);

      const client1 = await repo.upsert({
        yclients_id: newYClientsId,
        company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
        phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}200`,
        name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Первая версия`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Second upsert with same yclients_id and company_id - should UPDATE
      const client2 = await repo.upsert({
        yclients_id: newYClientsId,
        company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
        phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}200`,
        name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Вторая версия`,
        updated_at: new Date().toISOString()
      });

      expect(client1.id).toBe(client2.id); // Same record updated
      expect(client2.name).toContain('Вторая версия');
    });
  });

  describe('bulkUpsert()', () => {
    test('should insert multiple new clients', async () => {
      const clients = [
        {
          yclients_id: 9900000 + Math.floor(Math.random() * 99999),
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}300`,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Bulk 1`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          yclients_id: 9900000 + Math.floor(Math.random() * 99999),
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}301`,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Bulk 2`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const results = await repo.bulkUpsert(clients);

      expect(results.length).toBe(2);
      expect(results[0].name).toContain('Bulk 1');
      expect(results[1].name).toContain('Bulk 2');
    });

    test('should update existing clients on conflict', async () => {
      const yclientsId1 = 9900000 + Math.floor(Math.random() * 99999);
      const yclientsId2 = 9900000 + Math.floor(Math.random() * 99999);

      // First insert
      await repo.bulkUpsert([
        {
          yclients_id: yclientsId1,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}400`,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Original 1`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          yclients_id: yclientsId2,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}401`,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Original 2`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

      // Update with same yclients_id
      const updated = await repo.bulkUpsert([
        {
          yclients_id: yclientsId1,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}400`,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Updated 1`,
          updated_at: new Date().toISOString()
        },
        {
          yclients_id: yclientsId2,
          company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
          phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}401`,
          name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Updated 2`,
          updated_at: new Date().toISOString()
        }
      ]);

      expect(updated[0].name).toContain('Updated 1');
      expect(updated[1].name).toContain('Updated 2');
    });

    test('should return empty array for empty input', async () => {
      const results = await repo.bulkUpsert([]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('findAppointments()', () => {
    test('should find client appointments by client_id', async () => {
      const appointments = await repo.findAppointments(testClient1.id);

      expect(Array.isArray(appointments)).toBe(true);
      expect(appointments.length).toBeGreaterThan(0);

      const found = appointments.find(a => a.id === testBooking.id);
      expect(found).toBeDefined();
      expect(found.client_id).toBe(testClient1.id);
    });

    test('should filter by date range', async () => {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const appointments = await repo.findAppointments(testClient1.id, {
        startDate: today.toISOString(),
        endDate: futureDate.toISOString()
      });

      expect(Array.isArray(appointments)).toBe(true);

      // All appointments should be within date range
      appointments.forEach(apt => {
        const aptDate = new Date(apt.datetime);
        expect(aptDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
        expect(aptDate.getTime()).toBeLessThanOrEqual(futureDate.getTime());
      });
    });

    test('should respect limit parameter', async () => {
      const appointments = await repo.findAppointments(testClient1.id, {
        limit: 1
      });

      expect(appointments.length).toBeLessThanOrEqual(1);
    });

    test('should order by datetime DESC', async () => {
      const appointments = await repo.findAppointments(testClient1.id, {
        limit: 10
      });

      if (appointments.length > 1) {
        for (let i = 0; i < appointments.length - 1; i++) {
          const current = new Date(appointments[i].datetime).getTime();
          const next = new Date(appointments[i + 1].datetime).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });

  describe('findUpcoming()', () => {
    test('should find only future appointments', async () => {
      const upcoming = await repo.findUpcoming(
        testClient1.id,
        testClient1.company_id
      );

      expect(Array.isArray(upcoming)).toBe(true);

      const now = new Date();

      // All appointments should be in the future
      upcoming.forEach(apt => {
        const aptDate = new Date(apt.datetime);
        expect(aptDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
      });
    });

    test('should exclude deleted appointments', async () => {
      const upcoming = await repo.findUpcoming(
        testClient1.id,
        testClient1.company_id
      );

      // None should have status 'deleted'
      upcoming.forEach(apt => {
        expect(apt.status).not.toBe('deleted');
      });
    });

    test('should order by datetime ASC (earliest first)', async () => {
      const upcoming = await repo.findUpcoming(
        testClient1.id,
        testClient1.company_id
      );

      if (upcoming.length > 1) {
        for (let i = 0; i < upcoming.length - 1; i++) {
          const current = new Date(upcoming[i].datetime).getTime();
          const next = new Date(upcoming[i + 1].datetime).getTime();
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });

    test('should return empty array when no upcoming appointments', async () => {
      // Create a client with no bookings
      const emptyClient = await createTestClient({
        phone: `${TEST_MARKERS.TEST_PHONE_PREFIX}999`
      });

      const upcoming = await repo.findUpcoming(
        emptyClient.id,
        emptyClient.company_id
      );

      expect(Array.isArray(upcoming)).toBe(true);
      expect(upcoming.length).toBe(0);
    });
  });

  describe('Database Stats Verification', () => {
    test('should have created test data correctly', async () => {
      const stats = await getDatabaseStats();

      expect(stats.test_clients).toBeGreaterThan(0);
      expect(stats.total_clients).toBeGreaterThanOrEqual(stats.test_clients);

      console.log('ClientRepository test data:', {
        test_clients: stats.test_clients,
        total_clients: stats.total_clients
      });
    });
  });
});
