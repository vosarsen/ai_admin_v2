// jest.config.js
require('dotenv').config({ path: '.env.test' }); // Load test environment first

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/index.js',
    '!src/workers/index-v2.js',
    '!src/instrument.js'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.test.js'
  ],
  setupFiles: ['<rootDir>/src/__tests__/setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 60000,
  clearMocks: true,
  verbose: true,

  // Projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/tests/unit/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/src/__tests__/setup.js'],
      testTimeout: 30000
    },
    {
      displayName: 'integration',
      testMatch: ['**/tests/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/src/__tests__/setup.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: 60000,
      // Integration tests only run when RUN_INTEGRATION_TESTS is set
      testPathIgnorePatterns: process.env.RUN_INTEGRATION_TESTS ? [] : ['.*']
    },
    {
      displayName: 'repositories',
      testMatch: ['**/tests/repositories/**/*.test.js'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/src/__tests__/setup.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: 60000,
      // Repository tests only run when RUN_INTEGRATION_TESTS is set
      testPathIgnorePatterns: process.env.RUN_INTEGRATION_TESTS ? [] : ['.*']
    }
  ]
};