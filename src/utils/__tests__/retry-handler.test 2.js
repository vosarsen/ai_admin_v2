// src/utils/__tests__/retry-handler.test.js
const { RetryHandler } = require('../retry-handler');

describe('RetryHandler', () => {
  let retryHandler;
  
  beforeEach(() => {
    jest.clearAllMocks();
    retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2
    });
  });

  describe('execute', () => {
    it('should execute function successfully on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue({ success: true });
      
      const result = await retryHandler.execute(mockFn, 'test-operation');
      
      expect(result).toEqual({ success: true });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and succeed', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' }))
        .mockRejectedValueOnce(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }))
        .mockResolvedValue({ success: true });
      
      const result = await retryHandler.execute(mockFn, 'test-operation');
      
      expect(result).toEqual({ success: true });
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable error', async () => {
      const error = Object.assign(new Error('Bad request'), { 
        response: { status: 400 } 
      });
      const mockFn = jest.fn().mockRejectedValue(error);
      
      await expect(retryHandler.execute(mockFn, 'test-operation'))
        .rejects.toThrow('Bad request');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries limit', async () => {
      const error = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      const mockFn = jest.fn().mockRejectedValue(error);
      
      await expect(retryHandler.execute(mockFn, 'test-operation'))
        .rejects.toThrow('Network error');
      
      expect(mockFn).toHaveBeenCalledTimes(3); // maxRetries
    });

    it('should apply exponential backoff', async () => {
      const error = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' });
      const mockFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ success: true });
      
      const sleepSpy = jest.spyOn(retryHandler, 'sleep').mockResolvedValue();
      
      await retryHandler.execute(mockFn, 'test-operation');
      
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 100); // initialDelay
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 200); // initialDelay * backoffMultiplier
    });

    it('should not exceed max delay', async () => {
      const error = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' });
      const mockFn = jest.fn().mockRejectedValue(error);
      
      // Override with smaller values for testing
      retryHandler.initialDelay = 500;
      retryHandler.maxDelay = 600;
      
      const sleepSpy = jest.spyOn(retryHandler, 'sleep').mockResolvedValue();
      
      try {
        await retryHandler.execute(mockFn, 'test-operation');
      } catch (e) {
        // Expected to fail
      }
      
      expect(sleepSpy).toHaveBeenCalledTimes(2); // maxRetries - 1
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 500);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 600); // Capped at maxDelay
    });
  });

  describe('isRetryable', () => {
    it('should identify network errors as retryable', () => {
      const errors = [
        { code: 'ECONNREFUSED' },
        { code: 'ETIMEDOUT' },
        { code: 'ENOTFOUND' },
        { code: 'ECONNRESET' }
      ];
      
      errors.forEach(error => {
        expect(retryHandler.isRetryable(error)).toBe(true);
      });
    });

    it('should identify retryable HTTP status codes', () => {
      const statusCodes = [408, 429, 500, 502, 503, 504];
      
      statusCodes.forEach(status => {
        const error = { response: { status } };
        expect(retryHandler.isRetryable(error)).toBe(true);
      });
    });

    it('should not retry client errors', () => {
      const statusCodes = [400, 401, 403, 404, 422];
      
      statusCodes.forEach(status => {
        const error = { response: { status } };
        expect(retryHandler.isRetryable(error)).toBe(false);
      });
    });

    it('should identify timeout errors by message', () => {
      const errors = [
        new Error('Request timeout'),
        new Error('Network timeout occurred'),
        new Error('ECONNREFUSED: Connection refused')
      ];
      
      errors.forEach(error => {
        expect(retryHandler.isRetryable(error)).toBe(true);
      });
    });
  });

  describe('wrap', () => {
    it('should create retryable version of function', async () => {
      const originalFn = jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' }))
        .mockResolvedValue({ data: 'success' });
      
      const wrappedFn = retryHandler.wrap(originalFn, 'wrapped-operation');
      
      const result = await wrappedFn('arg1', 'arg2');
      
      expect(result).toEqual({ data: 'success' });
      expect(originalFn).toHaveBeenCalledTimes(2);
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });
});