/**
 * Integration Test Global Setup
 *
 * This file is loaded via Jest setupFilesAfterEnv.
 * Ensures proper connection pool cleanup after ALL tests complete.
 */

const postgres = require('../../../src/database/postgres');

// Register global afterAll hook to close pool once
// This runs after all test suites complete
afterAll(async () => {
  // Wait a bit for any pending queries
  await new Promise(resolve => setTimeout(resolve, 100));
  await postgres.end();
});
