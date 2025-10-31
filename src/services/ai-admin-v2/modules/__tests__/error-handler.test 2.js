const { ErrorHandler, AIAdminError, ValidationError, APIError, BookingError } = require('../error-handler');

describe('ErrorHandler', () => {
  describe('classifyError', () => {
    it('should classify AIAdminError correctly', () => {
      const error = new AIAdminError('TEST_ERROR', 'Test error message');
      const classified = ErrorHandler.classifyError(error);
      
      expect(classified.code).toBe('TEST_ERROR');
      expect(classified.type).toBe('AIAdminError');
      expect(classified.message).toBe('Test error message');
    });

    it('should classify network errors', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const classified = ErrorHandler.classifyError(error);
      
      expect(classified.code).toBe('NETWORK_ERROR');
      expect(classified.type).toBe('NetworkError');
      expect(classified.severity).toBe('medium');
    });

    it('should classify availability errors', () => {
      const error = new Error('Время уже занято');
      const classified = ErrorHandler.classifyError(error);
      
      expect(classified.code).toBe('AVAILABILITY_ERROR');
      expect(classified.type).toBe('AvailabilityError');
      expect(classified.severity).toBe('low');
    });

    it('should classify validation errors', () => {
      const error = new Error('Phone number is required');
      const classified = ErrorHandler.classifyError(error);
      
      expect(classified.code).toBe('VALIDATION_ERROR');
      expect(classified.type).toBe('ValidationError');
      expect(classified.severity).toBe('low');
    });

    it('should classify unknown errors', () => {
      const error = new Error('Something went wrong');
      const classified = ErrorHandler.classifyError(error);
      
      expect(classified.code).toBe('UNKNOWN_ERROR');
      expect(classified.type).toBe('Error');
      expect(classified.severity).toBe('high');
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable errors', () => {
      const networkError = { code: 'NETWORK_ERROR' };
      const timeoutError = { code: 'TIMEOUT_ERROR' };
      const validationError = { code: 'VALIDATION_ERROR' };
      
      expect(ErrorHandler.isRetryable(networkError)).toBe(true);
      expect(ErrorHandler.isRetryable(timeoutError)).toBe(true);
      expect(ErrorHandler.isRetryable(validationError)).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay1 = ErrorHandler.calculateRetryDelay(1);
      const delay2 = ErrorHandler.calculateRetryDelay(2);
      const delay3 = ErrorHandler.calculateRetryDelay(3);
      
      // Base delay is 1000ms
      expect(delay1).toBeGreaterThanOrEqual(900); // 1000 - 10%
      expect(delay1).toBeLessThanOrEqual(1100); // 1000 + 10%
      
      expect(delay2).toBeGreaterThanOrEqual(1800); // 2000 - 10%
      expect(delay2).toBeLessThanOrEqual(2200); // 2000 + 10%
      
      expect(delay3).toBeGreaterThanOrEqual(3600); // 4000 - 10%
      expect(delay3).toBeLessThanOrEqual(4400); // 4000 + 10%
    });

    it('should cap delay at maxDelay', () => {
      const delay10 = ErrorHandler.calculateRetryDelay(10);
      expect(delay10).toBeLessThanOrEqual(11000); // maxDelay (10000) + 10%
    });
  });

  describe('getUserMessage', () => {
    it('should return appropriate user messages', () => {
      expect(ErrorHandler.getUserMessage({ code: 'NETWORK_ERROR' }))
        .toBe('Проблема с подключением. Попробуйте еще раз через несколько секунд.');
      
      expect(ErrorHandler.getUserMessage({ code: 'BOOKING_ERROR' }))
        .toBe('Не удалось создать запись. Попробуйте другое время.');
      
      expect(ErrorHandler.getUserMessage({ code: 'UNKNOWN_CODE' }))
        .toBe('Произошла неожиданная ошибка. Попробуйте еще раз.');
    });
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully on first try', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await ErrorHandler.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');
      
      const result = await ErrorHandler.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const error = new Error('Network error');
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(ErrorHandler.executeWithRetry(operation))
        .rejects.toThrow('Network error');
      
      expect(operation).toHaveBeenCalledTimes(3); // max attempts
    });

    it('should not retry non-retryable errors', async () => {
      const error = new ValidationError('Invalid input', 'phone', '123');
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(ErrorHandler.executeWithRetry(operation))
        .rejects.toThrow(error);
      
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Classes', () => {
    it('should create ValidationError correctly', () => {
      const error = new ValidationError('Invalid phone', 'phone', '+123');
      
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid phone');
      expect(error.details.field).toBe('phone');
      expect(error.details.value).toBe('+123');
    });

    it('should create APIError correctly', () => {
      const error = new APIError('yclients', 'API failed', 500, { error: 'Internal' });
      
      expect(error.code).toBe('API_ERROR');
      expect(error.details.service).toBe('yclients');
      expect(error.details.statusCode).toBe(500);
    });

    it('should create BookingError correctly', () => {
      const error = new BookingError('Slot unavailable', 'availability', { slot: '10:00' });
      
      expect(error.code).toBe('BOOKING_ERROR');
      expect(error.details.type).toBe('availability');
      expect(error.details.slot).toBe('10:00');
    });
  });
});