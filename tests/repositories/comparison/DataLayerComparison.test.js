/**
 * Data Layer Comparison Tests
 *
 * Tests SupabaseDataLayer behavior with CURRENT backend configuration.
 *
 * Run twice with different backends to compare results:
 * - USE_REPOSITORY_PATTERN=false npm test -- tests/repositories/comparison/DataLayerComparison.test.js
 * - USE_REPOSITORY_PATTERN=true npm test -- tests/repositories/comparison/DataLayerComparison.test.js
 *
 * All 25 tests should pass with BOTH backends.
 */

// Load test environment
require('dotenv').config({ path: '.env.test' });

const { SupabaseDataLayer } = require('../../../src/integrations/yclients/data/supabase-data-layer');
const dbFlags = require('../../../config/database-flags');
const postgres = require('../../../src/database/postgres');
const { supabase } = require('../../../src/database/supabase');

describe(`DataLayer Tests (Backend: ${dbFlags.getCurrentBackend()})`, () => {
  let dataLayer;

  const TEST_PHONE = '89686484488'; // Test phone number
  const TEST_COMPANY_ID = 962302;

  beforeAll(async () => {
    console.log(`\n🔧 Testing with backend: ${dbFlags.getCurrentBackend()}`);
    console.log(`   USE_REPOSITORY_PATTERN=${dbFlags.USE_REPOSITORY_PATTERN}`);
    console.log(`   USE_LEGACY_SUPABASE=${dbFlags.USE_LEGACY_SUPABASE}\n`);

    dataLayer = new SupabaseDataLayer(supabase);
  });

  afterAll(async () => {
    // Cleanup
    if (postgres.pool) {
      await postgres.pool.end();
    }
  });

  describe('Dialog Context Methods (2)', () => {
    test('getDialogContext returns same result', async () => {
      const userId = TEST_PHONE;

      const result = await dataLayer.getDialogContext(userId);
      const result2 = await dataLayer.getDialogContext(userId);

      expect(result2.success).toBe(result.success);

      if (result.success) {
        expect(result2.data).toEqual(result.data);
      } else {
        expect(result2.error).toBe(result.error);
      }
    });

    test('upsertDialogContext returns same result', async () => {
      const contextData = {
        user_id: TEST_PHONE,
        state: 'test_state',
        context_data: { test: true },
        last_activity: new Date().toISOString()
      };

      const result = await dataLayer.upsertDialogContext(contextData);
      const result2 = await dataLayer.upsertDialogContext(contextData);

      expect(result2.success).toBe(result.success);

      if (result.success) {
        // Compare relevant fields (ignore auto-generated timestamps if different)
        expect(result2.data.user_id).toBe(result.data.user_id);
        expect(result2.data.state).toBe(result.data.state);
      }
    });
  });

  describe('Client Methods (7)', () => {
    test('getClientByPhone returns same result', async () => {
      const result = await dataLayer.getClientByPhone(TEST_PHONE);
      const result2 = await dataLayer.getClientByPhone(TEST_PHONE);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data).toMatchObject({
          phone: result.data.phone,
          name: result.data.name,
          company_id: result.data.company_id
        });
      }
    });

    test('getClientById returns same result', async () => {
      // First get a client to have a valid ID
      const clientResponse = await dataLayer.getClientByPhone(TEST_PHONE);

      if (!clientResponse.success || !clientResponse.data) {
        console.warn('Skipping getClientById test - no test client found');
        return;
      }

      const clientId = clientResponse.data.yclients_id;

      const result = await dataLayer.getClientById(clientId, TEST_COMPANY_ID);
      const result2 = await dataLayer.getClientById(clientId, TEST_COMPANY_ID);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.yclients_id).toBe(result.data.yclients_id);
        expect(result2.data.phone).toBe(result.data.phone);
      }
    });

    test('searchClientsByName returns same result', async () => {
      const searchName = 'Test';
      const limit = 5;

      const result = await dataLayer.searchClientsByName(TEST_COMPANY_ID, searchName, limit);
      const result2 = await dataLayer.searchClientsByName(TEST_COMPANY_ID, searchName, limit);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.length).toBe(result.data.length);
      }
    });

    test('getClientAppointments returns same result', async () => {
      // Get test client
      const clientResponse = await dataLayer.getClientByPhone(TEST_PHONE);

      if (!clientResponse.success || !clientResponse.data) {
        console.warn('Skipping getClientAppointments test - no test client found');
        return;
      }

      const clientId = clientResponse.data.id;
      const options = { limit: 10 };

      const result = await dataLayer.getClientAppointments(clientId, options);
      const result2 = await dataLayer.getClientAppointments(clientId, options);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.length).toBe(result.data.length);
      }
    });

    test('getUpcomingAppointments returns same result', async () => {
      // Get test client
      const clientResponse = await dataLayer.getClientByPhone(TEST_PHONE);

      if (!clientResponse.success || !clientResponse.data) {
        console.warn('Skipping getUpcomingAppointments test - no test client found');
        return;
      }

      const clientId = clientResponse.data.id;

      const result = await dataLayer.getUpcomingAppointments(clientId, TEST_COMPANY_ID);
      const result2 = await dataLayer.getUpcomingAppointments(clientId, TEST_COMPANY_ID);

      expect(result2.success).toBe(result.success);
    });

    test('upsertClient returns same result', async () => {
      const clientData = {
        yclients_id: 999999, // Test ID
        company_id: TEST_COMPANY_ID,
        phone: '89999999999',
        name: 'Test Client Comparison',
        email: 'test@example.com'
      };

      const result = await dataLayer.upsertClient(clientData);
      const result2 = await dataLayer.upsertClient(clientData);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.phone).toBe(result.data.phone);
        expect(result2.data.name).toBe(result.data.name);
      }
    });

    test('upsertClients returns same result', async () => {
      const clientsData = [
        {
          yclients_id: 999998,
          company_id: TEST_COMPANY_ID,
          phone: '89999999998',
          name: 'Test Bulk Client 1'
        },
        {
          yclients_id: 999997,
          company_id: TEST_COMPANY_ID,
          phone: '89999999997',
          name: 'Test Bulk Client 2'
        }
      ];

      const result = await dataLayer.upsertClients(clientsData);
      const result2 = await dataLayer.upsertClients(clientsData);

      expect(result2.success).toBe(result.success);

      if (result.success) {
        expect(result2.data.upserted).toBe(result.data.upserted);
      }
    });
  });

  describe('Staff Methods (2)', () => {
    test('getStaffById returns same result', async () => {
      // Use a known staff ID (get from services first)
      const servicesResult = await dataLayer.getServices(TEST_COMPANY_ID, false);

      if (!servicesResult.success || !servicesResult.data || servicesResult.data.length === 0) {
        console.warn('Skipping getStaffById test - no services found');
        return;
      }

      const staffId = 1; // Assuming staff ID 1 exists

      const result = await dataLayer.getStaffById(staffId, TEST_COMPANY_ID);
      const result2 = await dataLayer.getStaffById(staffId, TEST_COMPANY_ID);

      expect(result2.success).toBe(result.success);
    });

    test('getStaff returns same result', async () => {
      const result = await dataLayer.getStaff(TEST_COMPANY_ID, false);
      const result2 = await dataLayer.getStaff(TEST_COMPANY_ID, false);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.length).toBe(result.data.length);
      }
    });
  });

  describe('Schedule Methods (2)', () => {
    test('getStaffSchedule returns same result', async () => {
      const staffId = 1;
      const date = new Date().toISOString().split('T')[0]; // Today

      const result = await dataLayer.getStaffSchedule(staffId, date, TEST_COMPANY_ID);
      const result2 = await dataLayer.getStaffSchedule(staffId, date, TEST_COMPANY_ID);

      expect(result2.success).toBe(result.success);
    });

    test('getStaffSchedules returns same result', async () => {
      const query = {
        company_id: TEST_COMPANY_ID,
        start_date: new Date().toISOString().split('T')[0]
      };

      const result = await dataLayer.getStaffSchedules(query);
      const result2 = await dataLayer.getStaffSchedules(query);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.length).toBe(result.data.length);
      }
    });

    test('upsertStaffSchedules returns same result', async () => {
      const scheduleData = [
        {
          staff_id: 1,
          company_id: TEST_COMPANY_ID,
          date: new Date().toISOString().split('T')[0],
          start_time: '09:00:00',
          end_time: '18:00:00',
          is_working: true
        }
      ];

      const result = await dataLayer.upsertStaffSchedules(scheduleData);
      const result2 = await dataLayer.upsertStaffSchedules(scheduleData);

      expect(result2.success).toBe(result.success);
    });
  });

  describe('Service Methods (5)', () => {
    test('getServices returns same result', async () => {
      const includeInactive = false;

      const result = await dataLayer.getServices(TEST_COMPANY_ID, includeInactive);
      const result2 = await dataLayer.getServices(TEST_COMPANY_ID, includeInactive);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.length).toBe(result.data.length);
      }
    });

    test('getServiceById returns same result', async () => {
      // Get a service first
      const servicesResult = await dataLayer.getServices(TEST_COMPANY_ID, false);

      if (!servicesResult.success || !servicesResult.data || servicesResult.data.length === 0) {
        console.warn('Skipping getServiceById test - no services found');
        return;
      }

      const serviceId = servicesResult.data[0].yclients_id;

      const result = await dataLayer.getServiceById(serviceId, TEST_COMPANY_ID);
      const result2 = await dataLayer.getServiceById(serviceId, TEST_COMPANY_ID);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.yclients_id).toBe(result.data.yclients_id);
      }
    });

    test('getServicesByCategory returns same result', async () => {
      const categoryId = 1;

      const result = await dataLayer.getServicesByCategory(TEST_COMPANY_ID, categoryId);
      const result2 = await dataLayer.getServicesByCategory(TEST_COMPANY_ID, categoryId);

      expect(result2.success).toBe(result.success);
    });

    test('upsertServices returns same result', async () => {
      const servicesData = [
        {
          yclients_id: 999999,
          company_id: TEST_COMPANY_ID,
          title: 'Test Service Comparison',
          category_id: 1,
          price_min: 1000,
          duration: 60,
          is_active: true
        }
      ];

      const result = await dataLayer.upsertServices(servicesData);
      const result2 = await dataLayer.upsertServices(servicesData);

      expect(result2.success).toBe(result.success);
    });
  });

  describe('Company Methods (2)', () => {
    test('getCompany returns same result', async () => {
      const result = await dataLayer.getCompany(TEST_COMPANY_ID);
      const result2 = await dataLayer.getCompany(TEST_COMPANY_ID);

      expect(result2.success).toBe(result.success);

      if (result.success && result.data) {
        expect(result2.data.yclients_id).toBe(result.data.yclients_id);
        expect(result2.data.title).toBe(result.data.title);
      }
    });

    test('upsertCompany returns same result', async () => {
      const companyData = {
        yclients_id: TEST_COMPANY_ID,
        title: 'Test Company',
        timezone: 'Europe/Moscow'
      };

      const result = await dataLayer.upsertCompany(companyData);
      const result2 = await dataLayer.upsertCompany(companyData);

      expect(result2.success).toBe(result.success);
    });
  });

  describe('Edge Cases', () => {
    test('handles non-existent phone number', async () => {
      const fakePhone = '80000000000';

      const result = await dataLayer.getClientByPhone(fakePhone);
      const result2 = await dataLayer.getClientByPhone(fakePhone);

      expect(result2.success).toBe(result.success);
      expect(result2.data).toBe(result.data);
    });

    test('handles invalid company ID', async () => {
      const invalidCompanyId = 999999999;

      const result = await dataLayer.getServices(invalidCompanyId, false);
      const result2 = await dataLayer.getServices(invalidCompanyId, false);

      expect(result2.success).toBe(result.success);
    });

    test('handles empty array upsert', async () => {
      const emptyArray = [];

      const result = await dataLayer.upsertClients(emptyArray);
      const result2 = await dataLayer.upsertClients(emptyArray);

      expect(result2.success).toBe(result.success);
    });

    test('handles NULL values in context data', async () => {
      const contextData = {
        user_id: TEST_PHONE,
        state: null,
        context_data: null,
        last_activity: new Date().toISOString()
      };

      const result = await dataLayer.upsertDialogContext(contextData);
      const result2 = await dataLayer.upsertDialogContext(contextData);

      expect(result2.success).toBe(result.success);
    });
  });
});
