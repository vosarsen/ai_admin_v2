// src/utils/__tests__/critical-error-logger.test.js
const criticalErrorLogger = require('../critical-error-logger');
const logger = require('../logger');

// Мокаем зависимости
jest.mock('../logger');
jest.mock('../../database/postgres', () => ({
  query: jest.fn(() => Promise.resolve({ rows: [] }))
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    appendFile: jest.fn()
  }
}));

describe('CriticalErrorLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    criticalErrorLogger.errorCounters.clear();
    console.error = jest.fn();
  });

  describe('logCriticalError', () => {
    it('should log a critical error with full context', async () => {
      const error = new Error('Database connection lost');
      error.code = 'ECONNREFUSED';
      
      const context = {
        service: 'database',
        operation: 'query',
        companyId: 123,
        userId: '79001234567'
      };
      
      const errorId = await criticalErrorLogger.logCriticalError(error, context);
      
      expect(errorId).toBeDefined();
      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(logger.error).toHaveBeenCalledWith(
        'CRITICAL ERROR',
        expect.objectContaining({
          id: errorId,
          type: 'database_connection_lost',
          severity: 'critical'
        })
      );
    });

    it('should handle logging failures gracefully', async () => {
      logger.error.mockImplementation(() => {
        throw new Error('Logger failed');
      });
      
      const error = new Error('Test error');
      
      // Should not throw
      await expect(
        criticalErrorLogger.logCriticalError(error)
      ).resolves.not.toThrow();
      
      // Should use console fallback
      expect(console.error).toHaveBeenCalledWith(
        'CRITICAL: Failed to log critical error:',
        expect.any(Error)
      );
    });
  });

  describe('determineErrorType', () => {
    it('should identify Redis connection errors', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      const context = { service: 'redis' };
      
      const type = criticalErrorLogger.determineErrorType(error, context);
      
      expect(type).toBe('redis_connection_lost');
    });

    it('should identify YClients API errors', () => {
      const error = new Error('YClients API request failed');
      
      const type = criticalErrorLogger.determineErrorType(error, {});
      
      expect(type).toBe('yclients_api_down');
    });

    it('should identify booking creation failures', () => {
      const error = new Error('Booking failed');
      const context = { operation: 'createBooking' };
      
      const type = criticalErrorLogger.determineErrorType(error, context);
      
      expect(type).toBe('booking_creation_failed');
    });

    it('should return unknown for unrecognized errors', () => {
      const error = new Error('Some random error');
      
      const type = criticalErrorLogger.determineErrorType(error, {});
      
      expect(type).toBe('unknown_critical_error');
    });
  });

  describe('calculateSeverity', () => {
    it('should mark database errors as critical', () => {
      const error = new Error('DB Error');
      error.code = 'ECONNREFUSED';
      const context = { service: 'database' };
      
      const severity = criticalErrorLogger.calculateSeverity(error, context);
      
      expect(severity).toBe('critical');
    });

    it('should mark API errors as high', () => {
      const error = new Error('YClients API down');
      
      const severity = criticalErrorLogger.calculateSeverity(error, {});
      
      expect(severity).toBe('high');
    });

    it('should default to medium severity', () => {
      const error = new Error('Some error');
      
      const severity = criticalErrorLogger.calculateSeverity(error, {});
      
      expect(severity).toBe('medium');
    });
  });

  describe('analyzeErrorPattern', () => {
    it('should detect recurring errors', async () => {
      const error = new Error('Redis error');
      error.code = 'ECONNREFUSED';
      const context = { service: 'redis' };
      
      // Log same error multiple times
      for (let i = 0; i < 3; i++) {
        await criticalErrorLogger.logCriticalError(error, context);
      }
      
      const pattern = criticalErrorLogger.analyzeErrorPattern(error, context);
      
      expect(pattern.isRecurring).toBe(true);
      expect(pattern.frequency).toBe(3);
    });

    it('should identify error patterns', async () => {
      const error = new Error('API timeout');
      const context = { service: 'api' };
      
      // Log error enough times to trigger pattern detection
      for (let i = 0; i < 6; i++) {
        await criticalErrorLogger.logCriticalError(error, context);
      }
      
      const pattern = criticalErrorLogger.analyzeErrorPattern(error, context);
      
      expect(pattern.isPattern).toBe(true);
      expect(pattern.patternType).toBeDefined();
    });
  });

  describe('extractErrorDetails', () => {
    it('should extract HTTP error details', () => {
      const error = new Error('HTTP Error');
      error.response = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
        data: { error: 'Server error' }
      };
      
      const details = criticalErrorLogger.extractErrorDetails(error);
      
      expect(details.http).toEqual({
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/json' },
        data: { error: 'Server error' }
      });
    });

    it('should extract Axios request details', () => {
      const error = new Error('Request failed');
      error.config = {
        url: 'https://api.example.com',
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        timeout: 5000
      };
      
      const details = criticalErrorLogger.extractErrorDetails(error);
      
      expect(details.request).toEqual({
        url: 'https://api.example.com',
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        timeout: 5000
      });
    });

    it('should extract database error details', () => {
      const error = new Error('Database error');
      error.detail = 'Unique constraint violation';
      error.hint = 'Check unique fields';
      error.position = '42';
      error.code = '23505';
      
      const details = criticalErrorLogger.extractErrorDetails(error);
      
      expect(details.database).toEqual({
        detail: 'Unique constraint violation',
        hint: 'Check unique fields',
        position: '42',
        code: '23505'
      });
    });
  });

  describe('logToConsole', () => {
    it('should format critical errors for console', () => {
      const errorData = {
        id: 'err_123',
        type: 'database_connection_lost',
        timestamp: new Date().toISOString(),
        error: {
          message: 'Connection lost',
          stack: 'Error: Connection lost\n    at test.js:1:1'
        },
        context: {
          companyId: 123,
          operation: 'query'
        }
      };
      
      criticalErrorLogger.logToConsole(errorData);
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL ERROR DETECTED'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('err_123'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('database_connection_lost'));
    });
  });

  describe('updateErrorCounters', () => {
    it('should track error occurrences', () => {
      const errorData = {
        id: 'err_1',
        type: 'api_error'
      };
      
      criticalErrorLogger.updateErrorCounters(errorData);
      criticalErrorLogger.updateErrorCounters({ ...errorData, id: 'err_2' });
      
      const counter = criticalErrorLogger.errorCounters.get('api_error');
      expect(counter.count).toBe(2);
      expect(counter.occurrences).toHaveLength(2);
    });

    it('should clean up old occurrences', () => {
      const oldTime = Date.now() - 400000; // Older than time window
      const errorData = {
        id: 'err_old',
        type: 'timeout_error'
      };
      
      // Manually add old occurrence
      criticalErrorLogger.errorCounters.set('timeout_error', {
        count: 1,
        firstSeen: oldTime,
        lastSeen: oldTime,
        occurrences: [{ time: oldTime, errorId: 'err_old' }]
      });
      
      // Add new occurrence
      criticalErrorLogger.updateErrorCounters({ ...errorData, id: 'err_new' });
      
      const counter = criticalErrorLogger.errorCounters.get('timeout_error');
      expect(counter.occurrences).toHaveLength(1);
      expect(counter.occurrences[0].errorId).toBe('err_new');
    });
  });
});