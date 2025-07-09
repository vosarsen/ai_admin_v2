// src/__tests__/services/nlu/input-validator.test.js
const InputValidator = require('../../../services/nlu/input-validator');

describe('InputValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('validateMessage', () => {
    it('should accept valid message', () => {
      const result = validator.validateMessage('Хочу записаться на маникюр');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitized).toBe('Хочу записаться на маникюр');
    });

    it('should reject empty message', () => {
      const result = validator.validateMessage('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message is required');
    });

    it('should reject null message', () => {
      const result = validator.validateMessage(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message is required');
    });

    it('should reject non-string message', () => {
      const result = validator.validateMessage(123);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message must be a string');
    });

    it('should trim whitespace', () => {
      const result = validator.validateMessage('  Хочу записаться  ');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('Хочу записаться');
    });

    it('should reject whitespace-only message', () => {
      const result = validator.validateMessage('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message cannot be empty');
    });

    it('should truncate very long messages', () => {
      const longMessage = 'a'.repeat(1500);
      const result = validator.validateMessage(longMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message is too long (max 1000 characters)');
      expect(result.sanitized.length).toBe(1000);
    });

    it('should reject base64-like data', () => {
      const base64 = 'a'.repeat(50) + 'b'.repeat(50) + '==';
      const result = validator.validateMessage(base64);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message appears to contain encoded data');
      expect(result.sanitized).toBe('[ENCODED_DATA]');
    });
  });

  describe('validateContext', () => {
    const validContext = {
      phone: '+79991234567',
      companyId: '12345'
    };

    it('should accept valid context', () => {
      const result = validator.validateContext(validContext);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitized.phone).toBe('+79991234567');
      expect(result.sanitized.companyId).toBe('12345');
    });

    it('should reject null context', () => {
      const result = validator.validateContext(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Context is required');
    });

    it('should reject non-object context', () => {
      const result = validator.validateContext('not an object');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Context must be an object');
    });

    it('should reject array as context', () => {
      const result = validator.validateContext([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Context must be an object');
    });

    it('should require phone field', () => {
      const result = validator.validateContext({ companyId: '12345' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Context.phone is required');
    });

    it('should require companyId field', () => {
      const result = validator.validateContext({ phone: '+79991234567' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Context.companyId is required');
    });

    it('should convert phone and companyId to strings', () => {
      const result = validator.validateContext({ 
        phone: 79991234567, 
        companyId: 12345 
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized.phone).toBe('79991234567');
      expect(result.sanitized.companyId).toBe('12345');
    });

    it('should validate and limit optional arrays', () => {
      const context = {
        ...validContext,
        services: new Array(200).fill('service'),
        staff: new Array(100).fill('staff'),
        lastMessages: new Array(20).fill('message')
      };
      
      const result = validator.validateContext(context);
      expect(result.isValid).toBe(true);
      expect(result.sanitized.services.length).toBe(100);
      expect(result.sanitized.staff.length).toBe(50);
      expect(result.sanitized.lastMessages.length).toBe(10);
    });

    it('should validate client object', () => {
      const context = {
        ...validContext,
        client: {
          id: 123,
          name: 'John Doe',
          email: 'john@example.com',
          lastVisit: '2024-01-01'
        }
      };
      
      const result = validator.validateContext(context);
      expect(result.isValid).toBe(true);
      expect(result.sanitized.client).toEqual({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        lastVisit: '2024-01-01'
      });
    });
  });

  describe('validateParsedResult', () => {
    it('should accept valid parsed result', () => {
      const parsed = {
        intent: 'booking',
        entities: {
          service: 'маникюр',
          staff: 'Мария'
        },
        confidence: 0.8,
        action: 'search_slots',
        reasoning: 'User wants to book'
      };
      
      const result = validator.validateParsedResult(parsed);
      expect(result.isValid).toBe(true);
      expect(result.sanitized.intent).toBe('booking');
      expect(result.sanitized.confidence).toBe(0.8);
    });

    it('should reject missing intent', () => {
      const result = validator.validateParsedResult({ entities: {} });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Intent is required');
    });

    it('should reject non-string intent', () => {
      const result = validator.validateParsedResult({ 
        intent: 123, 
        entities: {} 
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Intent must be a string');
    });

    it('should lowercase and trim intent', () => {
      const result = validator.validateParsedResult({ 
        intent: '  BOOKING  ', 
        entities: {} 
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized.intent).toBe('booking');
    });

    it('should handle missing entities', () => {
      const result = validator.validateParsedResult({ intent: 'booking' });
      expect(result.isValid).toBe(true);
      expect(result.sanitized.entities).toEqual({});
    });

    it('should validate confidence values', () => {
      const testCases = [
        { input: 0.5, expected: 0.5 },
        { input: 1.5, expected: 1 },
        { input: -0.5, expected: 0 },
        { input: 'invalid', expected: 0.5 },
        { input: undefined, expected: undefined }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = validator.validateParsedResult({ 
          intent: 'booking', 
          entities: {},
          confidence: input
        });
        expect(result.sanitized.confidence).toBe(expected);
      });
    });

    it('should truncate long reasoning', () => {
      const longReasoning = 'a'.repeat(600);
      const result = validator.validateParsedResult({ 
        intent: 'booking', 
        entities: {},
        reasoning: longReasoning
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized.reasoning.length).toBe(500);
    });

    it('should sanitize entity values', () => {
      const result = validator.validateParsedResult({ 
        intent: 'booking', 
        entities: {
          service: 123,
          staff: null,
          date: '  2024-01-01  ',
          time: undefined,
          info_type: 'prices'
        }
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized.entities).toEqual({
        service: '123',
        staff: null,
        date: '2024-01-01',
        info_type: 'prices'
      });
    });
  });

  describe('_looksLikeBase64', () => {
    it('should detect base64-like strings', () => {
      const base64Strings = [
        'a'.repeat(50) + 'b'.repeat(50) + '==',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
        'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBiYXNlNjQgZW5jb2RlZCBzdHJpbmcu'
      ];

      base64Strings.forEach(str => {
        if (str.length >= 100) {
          expect(validator._looksLikeBase64(str)).toBe(true);
        }
      });
    });

    it('should not detect normal text as base64', () => {
      const normalStrings = [
        'Хочу записаться на маникюр',
        'Hello world! This is a normal message.',
        'Short text',
        '12345 67890'
      ];

      normalStrings.forEach(str => {
        expect(validator._looksLikeBase64(str)).toBe(false);
      });
    });
  });
});