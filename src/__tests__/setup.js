// src/__tests__/setup.js
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock logger to reduce noise during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));