// src/__tests__/services/nlu/index.test.js
const NLUService = require('../../../services/nlu');
const { ValidationError, AIServiceError } = require('../../../services/nlu/errors');

// Mock logger to prevent console output during tests
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('NLUService', () => {
  let nluService;
  let mockAIService;

  beforeEach(() => {
    // Mock AI service
    mockAIService = {
      _callAI: jest.fn()
    };
    
    nluService = new NLUService(mockAIService);
  });

  describe('processMessage', () => {
    const validContext = {
      phone: '+79991234567',
      companyId: '12345'
    };

    it('should process booking request with AI extraction', async () => {
      const message = 'Хочу записаться на маникюр к Марии завтра в 14:00';
      
      mockAIService._callAI.mockResolvedValue(JSON.stringify({
        intent: 'booking',
        entities: {
          service: 'маникюр',
          staff: 'Мария',
          date: 'завтра',
          time: '14:00'
        },
        confidence: 0.9,
        reasoning: 'User wants to book manicure'
      }));

      const result = await nluService.processMessage(message, validContext);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('booking');
      expect(result.action).toBe('create_booking');
      expect(result.entities.service).toBe('маникюр');
      expect(result.entities.staff).toBe('Мария');
      expect(result.entities.time).toBe('14:00');
      expect(result.confidence).toBe(0.9);
      expect(result.provider).toBe('ai-nlu');
    });

    it('should return null response for search_slots action', async () => {
      const message = 'Хочу записаться на маникюр';
      
      mockAIService._callAI.mockResolvedValue(JSON.stringify({
        intent: 'booking',
        entities: {
          service: 'маникюр'
        },
        confidence: 0.8
      }));

      const result = await nluService.processMessage(message, validContext);

      expect(result.success).toBe(true);
      expect(result.action).toBe('search_slots');
      expect(result.response).toBeNull();
    });

    it('should fall back to pattern matching on AI failure', async () => {
      const message = 'Хочу записаться на маникюр завтра';
      
      mockAIService._callAI.mockRejectedValue(new Error('AI service unavailable'));

      const result = await nluService.processMessage(message, validContext);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('pattern');
      expect(result.intent).toBeDefined();
      expect(result.entities).toBeDefined();
    });

    it('should use hybrid approach for low confidence AI results', async () => {
      const message = 'Хочу записаться на маникюр завтра утром';
      
      mockAIService._callAI.mockResolvedValue(JSON.stringify({
        intent: 'booking',
        entities: {
          service: 'маникюр'
        },
        confidence: 0.5 // Low confidence
      }));

      const result = await nluService.processMessage(message, validContext);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('hybrid');
    });

    it('should handle invalid message input', async () => {
      const result = await nluService.processMessage(null, validContext);

      expect(result.success).toBe(false);
      expect(result.intent).toBe('error');
      expect(result.action).toBe('none');
      expect(result.response).toContain('Извините');
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid context input', async () => {
      const result = await nluService.processMessage('Хочу записаться', null);

      expect(result.success).toBe(false);
      expect(result.intent).toBe('error');
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle base64-like messages', async () => {
      const base64Message = 'a'.repeat(50) + 'b'.repeat(50) + '==';
      
      const result = await nluService.processMessage(base64Message, validContext);

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('should normalize entities from AI response', async () => {
      const message = 'Хочу записаться на ногти к Маше завтра утром';
      
      mockAIService._callAI.mockResolvedValue(JSON.stringify({
        intent: 'booking',
        entities: {
          service: 'ногти',
          staff: 'маша',
          date: 'завтра',
          time: 'утром'
        },
        confidence: 0.9
      }));

      const result = await nluService.processMessage(message, validContext);

      expect(result.entities.service).toBe('маникюр');
      expect(result.entities.staff).toBe('Мария');
      expect(result.entities.time).toBe('09:00');
      // Date should be normalized to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(result.entities.date).toBe(tomorrow.toISOString().split('T')[0]);
    });
  });

  describe('parseAIResponse', () => {
    it('should parse valid JSON response', () => {
      const response = `Based on analysis: {"intent": "booking", "entities": {"service": "маникюр"}, "confidence": 0.8}`;
      
      const parsed = nluService.parseAIResponse(response);
      
      expect(parsed.intent).toBe('booking');
      expect(parsed.entities.service).toBe('маникюр');
      expect(parsed.confidence).toBe(0.8);
    });

    it('should throw error for invalid JSON', () => {
      const response = 'This is not JSON';
      
      expect(() => nluService.parseAIResponse(response)).toThrow();
    });

    it('should throw error for missing intent', () => {
      const response = '{"entities": {"service": "маникюр"}}';
      
      expect(() => nluService.parseAIResponse(response)).toThrow(ValidationError);
    });

    it('should handle response with unexpected fields', () => {
      const response = '{"intent": "booking", "entities": {}, "response": "some text"}';
      
      const parsed = nluService.parseAIResponse(response);
      
      expect(parsed.intent).toBe('booking');
      expect(parsed.response).toBeUndefined(); // Should not include response field
    });
  });

  describe('combineResults', () => {
    it('should combine AI and pattern results using best confidence', () => {
      const aiResult = {
        entities: {
          service: { name: 'маникюр', confidence: 0.8 },
          staff: { name: 'Мария', confidence: 0.7 }
        },
        confidence: 0.8
      };

      const patternResult = {
        intent: { name: 'booking', confidence: 0.6 },
        service: { name: 'педикюр', confidence: 0.5 },
        staff: { name: 'Ольга', confidence: 0.9 },
        confidence: 0.6
      };

      const context = { phone: '+79991234567', companyId: '12345' };
      const combined = nluService.combineResults(aiResult, patternResult, context);

      expect(combined.success).toBe(true);
      expect(combined.intent).toBe('booking');
      expect(combined.entities.service).toEqual(aiResult.entities.service); // Higher confidence
      expect(combined.entities.staff).toEqual(patternResult.staff); // Higher confidence
      expect(combined.provider).toBe('hybrid');
    });

    it('should handle missing entities in results', () => {
      const aiResult = {
        entities: {
          service: 'маникюр'
        },
        confidence: 0.8
      };

      const patternResult = {
        intent: { name: 'booking' },
        date: { date: '2024-01-01' },
        time: { time: '14:00' }
      };

      const context = { phone: '+79991234567', companyId: '12345' };
      const combined = nluService.combineResults(aiResult, patternResult, context);

      expect(combined.entities.service).toBe('маникюр');
      expect(combined.entities.date).toBe('2024-01-01');
      expect(combined.entities.time).toBe('14:00');
      expect(combined.entities.staff).toBeNull();
    });
  });

  describe('formatResult', () => {
    it('should format fallback extraction result', () => {
      const extractionResult = {
        intent: { name: 'booking' },
        service: { name: 'маникюр' },
        staff: { name: 'Мария' },
        date: { date: '2024-01-01' },
        time: { time: '14:00' },
        confidence: 0.7
      };

      const context = { phone: '+79991234567', companyId: '12345' };
      const result = nluService.formatResult(extractionResult, 'pattern', context);

      expect(result.success).toBe(true);
      expect(result.intent).toBe('booking');
      expect(result.action).toBe('create_booking');
      expect(result.entities).toEqual({
        service: 'маникюр',
        staff: 'Мария',
        date: '2024-01-01',
        time: '14:00'
      });
      expect(result.confidence).toBe(0.7);
      expect(result.provider).toBe('pattern');
    });

    it('should ensure search_slots never has response', () => {
      const extractionResult = {
        intent: { name: 'booking' },
        service: { name: 'маникюр' },
        confidence: 0.6
      };

      const context = { phone: '+79991234567', companyId: '12345' };
      const result = nluService.formatResult(extractionResult, 'pattern', context);

      expect(result.action).toBe('search_slots');
      expect(result.response).toBeNull();
    });
  });
});