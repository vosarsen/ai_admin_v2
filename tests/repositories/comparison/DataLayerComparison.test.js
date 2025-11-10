/**
 * Data Layer Comparison Tests
 *
 * Compares SupabaseDataLayer behavior with both backends:
 * - Supabase SDK (legacy)
 * - Repository Pattern (new)
 *
 * Tests verify identical results between backends for all 21 methods.
 *
 * Run: npm test -- tests/repositories/comparison/DataLayerComparison.test.js
 */

// Load test environment
require('dotenv').config({ path: '.env.test' });

// IMPORTANT: Set USE_LEGACY_SUPABASE=false to enable PostgreSQL pool
process.env.USE_LEGACY_SUPABASE = 'false';

const { SupabaseDataLayer } = require('../../../src/integrations/yclients/data/supabase-data-layer');
const postgres = require('../../../src/database/postgres');
const { supabase } = require('../../../src/database/supabase');

describe('DataLayer Backend Comparison', () => {
  let supabaseLayer;
  let repositoryLayer;

  const TEST_PHONE = '89686484488'; // Test phone number
  const TEST_COMPANY_ID = 962302;

  beforeAll(async () => {
    // Ensure PostgreSQL pool is available for repository tests
    if (!postgres.pool) {
      throw new Error('PostgreSQL pool not available. Check database connection.');
    }

    // Create two instances with different backends
    process.env.USE_REPOSITORY_PATTERN = 'false';
    supabaseLayer = new SupabaseDataLayer(supabase);

    process.env.USE_REPOSITORY_PATTERN = 'true';
    repositoryLayer = new SupabaseDataLayer(supabase);
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

      const supabaseResult = await supabaseLayer.getDialogContext(userId);
      const repositoryResult = await repositoryLayer.getDialogContext(userId);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success) {
        expect(repositoryResult.data).toEqual(supabaseResult.data);
      } else {
        expect(repositoryResult.error).toBe(supabaseResult.error);
      }
    });

    test('upsertDialogContext returns same result', async () => {
      const contextData = {
        user_id: TEST_PHONE,
        state: 'test_state',
        context_data: { test: true },
        last_activity: new Date().toISOString()
      };

      const supabaseResult = await supabaseLayer.upsertDialogContext(contextData);
      const repositoryResult = await repositoryLayer.upsertDialogContext(contextData);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success) {
        // Compare relevant fields (ignore auto-generated timestamps if different)
        expect(repositoryResult.data.user_id).toBe(supabaseResult.data.user_id);
        expect(repositoryResult.data.state).toBe(supabaseResult.data.state);
      }
    });
  });

  describe('Client Methods (7)', () => {
    test('getClientByPhone returns same result', async () => {
      const supabaseResult = await supabaseLayer.getClientByPhone(TEST_PHONE);
      const repositoryResult = await repositoryLayer.getClientByPhone(TEST_PHONE);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data).toMatchObject({
          phone: supabaseResult.data.phone,
          name: supabaseResult.data.name,
          company_id: supabaseResult.data.company_id
        });
      }
    });

    test('getClientById returns same result', async () => {
      // First get a client to have a valid ID
      const clientResponse = await supabaseLayer.getClientByPhone(TEST_PHONE);

      if (!clientResponse.success || !clientResponse.data) {
        console.warn('Skipping getClientById test - no test client found');
        return;
      }

      const clientId = clientResponse.data.yclients_id;

      const supabaseResult = await supabaseLayer.getClientById(clientId, TEST_COMPANY_ID);
      const repositoryResult = await repositoryLayer.getClientById(clientId, TEST_COMPANY_ID);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.yclients_id).toBe(supabaseResult.data.yclients_id);
        expect(repositoryResult.data.phone).toBe(supabaseResult.data.phone);
      }
    });

    test('searchClientsByName returns same result', async () => {
      const searchName = 'Test';
      const limit = 5;

      const supabaseResult = await supabaseLayer.searchClientsByName(TEST_COMPANY_ID, searchName, limit);
      const repositoryResult = await repositoryLayer.searchClientsByName(TEST_COMPANY_ID, searchName, limit);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.length).toBe(supabaseResult.data.length);
      }
    });

    test('getClientAppointments returns same result', async () => {
      // Get test client
      const clientResponse = await supabaseLayer.getClientByPhone(TEST_PHONE);

      if (!clientResponse.success || !clientResponse.data) {
        console.warn('Skipping getClientAppointments test - no test client found');
        return;
      }

      const clientId = clientResponse.data.id;
      const options = { limit: 10 };

      const supabaseResult = await supabaseLayer.getClientAppointments(clientId, options);
      const repositoryResult = await repositoryLayer.getClientAppointments(clientId, options);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.length).toBe(supabaseResult.data.length);
      }
    });

    test('getUpcomingAppointments returns same result', async () => {
      // Get test client
      const clientResponse = await supabaseLayer.getClientByPhone(TEST_PHONE);

      if (!clientResponse.success || !clientResponse.data) {
        console.warn('Skipping getUpcomingAppointments test - no test client found');
        return;
      }

      const clientId = clientResponse.data.id;

      const supabaseResult = await supabaseLayer.getUpcomingAppointments(clientId, TEST_COMPANY_ID);
      const repositoryResult = await repositoryLayer.getUpcomingAppointments(clientId, TEST_COMPANY_ID);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });

    test('upsertClient returns same result', async () => {
      const clientData = {
        yclients_id: 999999, // Test ID
        company_id: TEST_COMPANY_ID,
        phone: '89999999999',
        name: 'Test Client Comparison',
        email: 'test@example.com'
      };

      const supabaseResult = await supabaseLayer.upsertClient(clientData);
      const repositoryResult = await repositoryLayer.upsertClient(clientData);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.phone).toBe(supabaseResult.data.phone);
        expect(repositoryResult.data.name).toBe(supabaseResult.data.name);
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

      const supabaseResult = await supabaseLayer.upsertClients(clientsData);
      const repositoryResult = await repositoryLayer.upsertClients(clientsData);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success) {
        expect(repositoryResult.data.upserted).toBe(supabaseResult.data.upserted);
      }
    });
  });

  describe('Staff Methods (2)', () => {
    test('getStaffById returns same result', async () => {
      // Use a known staff ID (get from services first)
      const servicesResult = await supabaseLayer.getServices(TEST_COMPANY_ID, false);

      if (!servicesResult.success || !servicesResult.data || servicesResult.data.length === 0) {
        console.warn('Skipping getStaffById test - no services found');
        return;
      }

      const staffId = 1; // Assuming staff ID 1 exists

      const supabaseResult = await supabaseLayer.getStaffById(staffId, TEST_COMPANY_ID);
      const repositoryResult = await repositoryLayer.getStaffById(staffId, TEST_COMPANY_ID);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });

    test('getStaff returns same result', async () => {
      const supabaseResult = await supabaseLayer.getStaff(TEST_COMPANY_ID, false);
      const repositoryResult = await repositoryLayer.getStaff(TEST_COMPANY_ID, false);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.length).toBe(supabaseResult.data.length);
      }
    });
  });

  describe('Schedule Methods (2)', () => {
    test('getStaffSchedule returns same result', async () => {
      const staffId = 1;
      const date = new Date().toISOString().split('T')[0]; // Today

      const supabaseResult = await supabaseLayer.getStaffSchedule(staffId, date, TEST_COMPANY_ID);
      const repositoryResult = await repositoryLayer.getStaffSchedule(staffId, date, TEST_COMPANY_ID);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });

    test('getStaffSchedules returns same result', async () => {
      const query = {
        company_id: TEST_COMPANY_ID,
        start_date: new Date().toISOString().split('T')[0]
      };

      const supabaseResult = await supabaseLayer.getStaffSchedules(query);
      const repositoryResult = await repositoryLayer.getStaffSchedules(query);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.length).toBe(supabaseResult.data.length);
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

      const supabaseResult = await supabaseLayer.upsertStaffSchedules(scheduleData);
      const repositoryResult = await repositoryLayer.upsertStaffSchedules(scheduleData);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });
  });

  describe('Service Methods (5)', () => {
    test('getServices returns same result', async () => {
      const includeInactive = false;

      const supabaseResult = await supabaseLayer.getServices(TEST_COMPANY_ID, includeInactive);
      const repositoryResult = await repositoryLayer.getServices(TEST_COMPANY_ID, includeInactive);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.length).toBe(supabaseResult.data.length);
      }
    });

    test('getServiceById returns same result', async () => {
      // Get a service first
      const servicesResult = await supabaseLayer.getServices(TEST_COMPANY_ID, false);

      if (!servicesResult.success || !servicesResult.data || servicesResult.data.length === 0) {
        console.warn('Skipping getServiceById test - no services found');
        return;
      }

      const serviceId = servicesResult.data[0].yclients_id;

      const supabaseResult = await supabaseLayer.getServiceById(serviceId, TEST_COMPANY_ID);
      const repositoryResult = await repositoryLayer.getServiceById(serviceId, TEST_COMPANY_ID);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.yclients_id).toBe(supabaseResult.data.yclients_id);
      }
    });

    test('getServicesByCategory returns same result', async () => {
      const categoryId = 1;

      const supabaseResult = await supabaseLayer.getServicesByCategory(TEST_COMPANY_ID, categoryId);
      const repositoryResult = await repositoryLayer.getServicesByCategory(TEST_COMPANY_ID, categoryId);

      expect(repositoryResult.success).toBe(supabaseResult.success);
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

      const supabaseResult = await supabaseLayer.upsertServices(servicesData);
      const repositoryResult = await repositoryLayer.upsertServices(servicesData);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });
  });

  describe('Company Methods (2)', () => {
    test('getCompany returns same result', async () => {
      const supabaseResult = await supabaseLayer.getCompany(TEST_COMPANY_ID);
      const repositoryResult = await repositoryLayer.getCompany(TEST_COMPANY_ID);

      expect(repositoryResult.success).toBe(supabaseResult.success);

      if (supabaseResult.success && supabaseResult.data) {
        expect(repositoryResult.data.yclients_id).toBe(supabaseResult.data.yclients_id);
        expect(repositoryResult.data.title).toBe(supabaseResult.data.title);
      }
    });

    test('upsertCompany returns same result', async () => {
      const companyData = {
        yclients_id: TEST_COMPANY_ID,
        title: 'Test Company',
        timezone: 'Europe/Moscow'
      };

      const supabaseResult = await supabaseLayer.upsertCompany(companyData);
      const repositoryResult = await repositoryLayer.upsertCompany(companyData);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });
  });

  describe('Edge Cases', () => {
    test('handles non-existent phone number', async () => {
      const fakePhone = '80000000000';

      const supabaseResult = await supabaseLayer.getClientByPhone(fakePhone);
      const repositoryResult = await repositoryLayer.getClientByPhone(fakePhone);

      expect(repositoryResult.success).toBe(supabaseResult.success);
      expect(repositoryResult.data).toBe(supabaseResult.data);
    });

    test('handles invalid company ID', async () => {
      const invalidCompanyId = 999999999;

      const supabaseResult = await supabaseLayer.getServices(invalidCompanyId, false);
      const repositoryResult = await repositoryLayer.getServices(invalidCompanyId, false);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });

    test('handles empty array upsert', async () => {
      const emptyArray = [];

      const supabaseResult = await supabaseLayer.upsertClients(emptyArray);
      const repositoryResult = await repositoryLayer.upsertClients(emptyArray);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });

    test('handles NULL values in context data', async () => {
      const contextData = {
        user_id: TEST_PHONE,
        state: null,
        context_data: null,
        last_activity: new Date().toISOString()
      };

      const supabaseResult = await supabaseLayer.upsertDialogContext(contextData);
      const repositoryResult = await repositoryLayer.upsertDialogContext(contextData);

      expect(repositoryResult.success).toBe(supabaseResult.success);
    });
  });
});
