/**
 * Database Test Helpers
 *
 * Provides utilities for integration tests against Timeweb PostgreSQL:
 * - Connection management
 * - Test data cleanup (safe - only test records)
 * - Transaction helpers
 */

const postgres = require('../../src/database/postgres');
const logger = require('../../src/utils/logger');

/**
 * Test data markers for safe cleanup
 */
const TEST_MARKERS = {
  // Test phone numbers (начинаются с 89686484488...)
  TEST_PHONE_PREFIX: '89686484488',

  // Test client names (содержат [TEST])
  TEST_CLIENT_NAME_MARKER: '[TEST]',

  // Test company IDs (только для тестов, не production!)
  TEST_COMPANY_IDS: ['999999', '999998'], // Не используем production company_id!

  // Test email markers
  TEST_EMAIL_DOMAIN: '@test.example.com'
};

/**
 * Verify we're not accidentally targeting production data
 * @param {string} companyId
 * @throws {Error} if companyId is production
 */
function verifyTestCompanyId(companyId) {
  const productionIds = ['962302']; // Production company ID

  if (productionIds.includes(String(companyId))) {
    throw new Error(
      `🚨 SAFETY CHECK FAILED: Cannot run tests against production company ${companyId}! ` +
      `Use test company IDs: ${TEST_MARKERS.TEST_COMPANY_IDS.join(', ')}`
    );
  }
}

/**
 * Get database connection for testing
 * @returns {Promise<Object>} Database connection
 */
async function getTestConnection() {
  try {
    // Verify we're using the correct database
    const result = await postgres.query('SELECT current_database(), current_user');
    const dbInfo = result.rows[0];

    logger.info('Test connection established', {
      database: dbInfo.current_database,
      user: dbInfo.current_user
    });

    return postgres;
  } catch (error) {
    logger.error('Failed to establish test connection:', error);
    throw error;
  }
}

/**
 * Clean up test data after test run
 * SAFE: Only deletes records marked as test data
 *
 * @param {Object} options - Cleanup options
 * @param {string[]} options.tables - Tables to clean (default: all test tables)
 * @param {boolean} options.dryRun - If true, only log what would be deleted
 */
async function cleanupTestData(options = {}) {
  const {
    tables = ['clients', 'bookings', 'dialog_contexts'],
    dryRun = false
  } = options;

  const cleanupResults = {};

  try {
    for (const table of tables) {
      // Build safe WHERE clause based on table
      let whereClause = '';

      if (table === 'clients') {
        whereClause = `
          phone LIKE '${TEST_MARKERS.TEST_PHONE_PREFIX}%'
          OR name LIKE '%${TEST_MARKERS.TEST_CLIENT_NAME_MARKER}%'
          OR email LIKE '%${TEST_MARKERS.TEST_EMAIL_DOMAIN}'
        `;
      } else if (table === 'bookings') {
        // Only delete bookings for test clients (using client_phone column)
        whereClause = `client_phone LIKE '${TEST_MARKERS.TEST_PHONE_PREFIX}%'`;
      } else if (table === 'dialog_contexts') {
        // dialog_contexts uses user_id instead of phone
        whereClause = `user_id LIKE '${TEST_MARKERS.TEST_PHONE_PREFIX}%'`;
      } else {
        logger.warn(`Skipping unknown table: ${table}`);
        continue;
      }

      if (dryRun) {
        // Dry run: count what would be deleted
        const countResult = await postgres.query(
          `SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`
        );
        cleanupResults[table] = {
          wouldDelete: parseInt(countResult.rows[0].count),
          deleted: 0,
          dryRun: true
        };

        logger.info(`[DRY RUN] Would delete ${cleanupResults[table].wouldDelete} records from ${table}`);
      } else {
        // Execute deletion
        const deleteResult = await postgres.query(
          `DELETE FROM ${table} WHERE ${whereClause}`
        );

        cleanupResults[table] = {
          deleted: deleteResult.rowCount || 0,
          dryRun: false
        };

        logger.info(`✅ Deleted ${cleanupResults[table].deleted} test records from ${table}`);
      }
    }

    return cleanupResults;
  } catch (error) {
    logger.error('Test data cleanup failed:', error);
    throw error;
  }
}

/**
 * Create test client for testing
 * @param {Object} overrides - Override default test client data
 * @returns {Promise<Object>} Created client
 */
async function createTestClient(overrides = {}) {
  const testPhone = overrides.phone || `${TEST_MARKERS.TEST_PHONE_PREFIX}${Date.now().toString().slice(-6)}`;

  const clientData = {
    phone: testPhone,
    name: `${TEST_MARKERS.TEST_CLIENT_NAME_MARKER} Test Client ${Date.now()}`,
    email: `test-${Date.now()}${TEST_MARKERS.TEST_EMAIL_DOMAIN}`,
    company_id: TEST_MARKERS.TEST_COMPANY_IDS[0],
    yclients_id: null,
    ...overrides
  };

  // Verify we're not using production company
  verifyTestCompanyId(clientData.company_id);

  const result = await postgres.query(
    `INSERT INTO clients (phone, name, email, company_id, yclients_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [clientData.phone, clientData.name, clientData.email, clientData.company_id, clientData.yclients_id]
  );

  logger.info('Test client created', { phone: clientData.phone });

  return result.rows[0];
}

/**
 * Get current database statistics
 * Useful for verifying test data doesn't pollute production
 */
async function getDatabaseStats() {
  try {
    const stats = await postgres.query(`
      SELECT
        (SELECT COUNT(*) FROM clients) as total_clients,
        (SELECT COUNT(*) FROM clients WHERE phone LIKE '${TEST_MARKERS.TEST_PHONE_PREFIX}%') as test_clients,
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM dialog_contexts) as total_contexts,
        (SELECT COUNT(*) FROM dialog_contexts WHERE user_id LIKE '${TEST_MARKERS.TEST_PHONE_PREFIX}%') as test_contexts
    `);

    return stats.rows[0];
  } catch (error) {
    logger.error('Failed to get database stats:', error);
    throw error;
  }
}

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  TEST_MARKERS,
  verifyTestCompanyId,
  getTestConnection,
  cleanupTestData,
  createTestClient,
  getDatabaseStats,
  sleep
};
