// jest.config.js
require('dotenv').config({ path: '.env.test' }); // Load test environment first

module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/index.js'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.test.js'
  ],
  setupFiles: ['<rootDir>/src/__tests__/setup.js'],
  testTimeout: 60000
};