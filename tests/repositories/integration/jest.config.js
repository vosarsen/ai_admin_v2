/**
 * Jest config for integration tests
 *
 * Usage:
 *   RUN_INTEGRATION_TESTS=true npx jest --config tests/repositories/integration/jest.config.js
 */
module.exports = {
  rootDir: '../../../',
  testMatch: ['<rootDir>/tests/repositories/integration/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/repositories/integration/setup.js'],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: false
};
