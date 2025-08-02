// src/utils/__tests__/error-messages.test.js
const errorMessages = require('../error-messages');

describe('ErrorMessages', () => {
  describe('getUserMessage', () => {
    it('should translate network errors', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      
      const result = errorMessages.getUserMessage(error);
      
      expect(result.message).toBe('Сервис временно недоступен. Попробуйте через несколько минут.');
      expect(result.needsRetry).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('should translate YClients API errors', () => {
      const error = new Error('Слот занят');
      
      const result = errorMessages.getUserMessage(error);
      
      expect(result.message).toBe('К сожалению, это время уже занято. Пожалуйста, выберите другое время.');
      expect(result.help).toContain('Могу предложить ближайшее свободное время');
      expect(result.severity).toBe('low');
    });

    it('should handle HTTP status codes', () => {
      const error = new Error('Bad Gateway');
      error.response = { status: 502 };
      
      const result = errorMessages.getUserMessage(error);
      
      expect(result.message).toBe('Сервис временно недоступен. Попробуйте через минуту.');
      expect(result.needsRetry).toBe(true);
    });

    it('should provide contextual help', () => {
      const error = 'Invalid phone';
      
      const result = errorMessages.getUserMessage(error);
      
      expect(result.help).toContain('Пример: +7 900 123-45-67');
      expect(result.help).toContain('Или просто: 79001234567');
    });

    it('should handle unknown errors with context', () => {
      const error = new Error('Some unknown error');
      const context = { operation: 'booking' };
      
      const result = errorMessages.getUserMessage(error, context);
      
      expect(result.message).toBe('Не удалось создать запись. Давайте попробуем еще раз?');
    });

    it('should find partial matches', () => {
      const error = 'Услуга "Стрижка deluxe" не найдена (Service not found)';
      
      const result = errorMessages.getUserMessage(error);
      
      expect(result.message).toBe('Услуга не найдена. Проверьте название.');
      expect(result.help).toContain('Попробуйте: "стрижка", "маникюр", "массаж"');
    });
  });

  describe('formatUserResponse', () => {
    it('should format simple error message', () => {
      const errorResult = {
        message: 'Время занято',
        help: [],
        severity: 'low',
        needsRetry: false
      };
      
      const formatted = errorMessages.formatUserResponse(errorResult);
      
      expect(formatted).toBe('Время занято');
    });

    it('should add apology for high severity errors', () => {
      const errorResult = {
        message: 'Сервис недоступен',
        help: [],
        severity: 'high',
        needsRetry: true
      };
      
      const formatted = errorMessages.formatUserResponse(errorResult);
      
      expect(formatted).toContain('Извините за неудобства');
      expect(formatted).toContain('Пожалуйста, попробуйте еще раз');
    });

    it('should include help messages', () => {
      const errorResult = {
        message: 'Неверный формат',
        help: ['Пример: завтра', 'Или: 25.07'],
        severity: 'medium',
        needsRetry: false
      };
      
      const formatted = errorMessages.formatUserResponse(errorResult);
      
      expect(formatted).toContain('Пример: завтра');
      expect(formatted).toContain('Или: 25.07');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable network errors', () => {
      const retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', '502', '503'];
      
      retryableErrors.forEach(error => {
        expect(errorMessages.isRetryableError(error)).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      const nonRetryableErrors = ['400', '401', 'Invalid phone', 'занят'];
      
      nonRetryableErrors.forEach(error => {
        expect(errorMessages.isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('getErrorSeverity', () => {
    it('should classify business logic errors as low severity', () => {
      expect(errorMessages.getErrorSeverity('занят')).toBe('low');
      expect(errorMessages.getErrorSeverity('недоступно')).toBe('low');
    });

    it('should classify system errors as high severity', () => {
      expect(errorMessages.getErrorSeverity('ECONNREFUSED')).toBe('high');
      expect(errorMessages.getErrorSeverity('500 Internal Server Error')).toBe('high');
    });

    it('should default to medium severity', () => {
      expect(errorMessages.getErrorSeverity('some random error')).toBe('medium');
    });
  });
});