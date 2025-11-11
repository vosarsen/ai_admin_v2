/**
 * Jest Setup for Integration Tests
 *
 * Runs before each test suite to ensure proper environment
 */

require('dotenv').config();
const logger = require('../src/utils/logger');
const { getDatabaseStats } = require('./helpers/db-helper');

// Increase timeout for integration tests
jest.setTimeout(60000);

// Global setup - runs once before all tests
beforeAll(async () => {
  logger.info('🧪 Starting integration test suite');

  // Verify RUN_INTEGRATION_TESTS is set
  if (!process.env.RUN_INTEGRATION_TESTS) {
    logger.warn('⚠️  RUN_INTEGRATION_TESTS not set - integration tests may be skipped');
  }

  // Verify database connection
  try {
    const stats = await getDatabaseStats();
    logger.info('📊 Database stats before tests:', stats);
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    throw new Error('Database connection failed - cannot run integration tests');
  }
});

// Global teardown - runs once after all tests
afterAll(async () => {
  logger.info('✅ Integration test suite completed');

  // Show final database stats
  try {
    const stats = await getDatabaseStats();
    logger.info('📊 Database stats after tests:', stats);

    // Warn if test data wasn't cleaned up
    if (stats.test_clients > 0 || stats.test_contexts > 0) {
      logger.warn(`⚠️  Test data remaining: ${stats.test_clients} clients, ${stats.test_contexts} contexts`);
      logger.warn('   Run: npm run test:cleanup to remove test data');
    }
  } catch (error) {
    logger.error('Failed to get final stats:', error);
  }
});
