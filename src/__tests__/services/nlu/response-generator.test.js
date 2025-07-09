// src/__tests__/services/nlu/response-generator.test.js
const ResponseGenerator = require('../../../services/nlu/response-generator');
const ActionResolver = require('../../../services/nlu/action-resolver');

describe('ResponseGenerator', () => {
  let responseGenerator;
  let actionResolver;

  beforeEach(() => {
    actionResolver = new ActionResolver();
    responseGenerator = new ResponseGenerator(actionResolver);
  });

  describe('generateResponse', () => {
    it('should always return null for search_slots action', () => {
      const parsed = {
        intent: 'booking',
        entities: { service: 'маникюр' },
        action: 'search_slots'
      };
      const context = { phone: '+79991234567', companyId: '12345' };
      
      const response = responseGenerator.generateResponse(parsed, context);
      expect(response).toBeNull();
    });

    it('should return null for search_slots even without explicit action', () => {
      const parsed = {
        intent: 'booking',
        entities: { service: 'маникюр' }
        // action will be determined as search_slots
      };
      const context = { phone: '+79991234567', companyId: '12345' };
      
      const response = responseGenerator.generateResponse(parsed, context);
      expect(response).toBeNull();
    });

    it('should generate response for create_booking action', () => {
      const parsed = {
        intent: 'booking',
        entities: {
          staff: 'Мария',
          date: '2024-01-01',
          time: '14:00'
        },
        action: 'create_booking'
      };
      const context = { phone: '+79991234567', companyId: '12345' };
      
      const response = responseGenerator.generateResponse(parsed, context);
      expect(response).toBe('Записываю вас к Мария на 2024-01-01 в 14:00. Подтверждаю запись.');
    });

    it('should generate response for info intent', () => {
      const parsed = {
        intent: 'info',
        entities: {},
        action: 'get_info'
      };
      const context = { phone: '+79991234567', companyId: '12345' };
      
      const response = responseGenerator.generateResponse(parsed, context);
      expect(response).toBe('Какую информацию вас интересует? Расценки, режим работы или услуги?');
    });

    it('should generate default response for unknown intent', () => {
      const parsed = {
        intent: 'unknown',
        entities: {},
        action: 'none'
      };
      const context = { phone: '+79991234567', companyId: '12345' };
      
      const response = responseGenerator.generateResponse(parsed, context);
      expect(response).toBe('Здравствуйте! Я помогу вам записаться на услуги. Скажите, на какую дату и время вы хотели бы записаться?');
    });

    it('should handle invalid input gracefully', () => {
      const context = { phone: '+79991234567', companyId: '12345' };
      
      // null parsed
      let response = responseGenerator.generateResponse(null, context);
      expect(response).toBe('Извините, произошла ошибка. Попробуйте еще раз.');
      
      // not an object
      response = responseGenerator.generateResponse('string', context);
      expect(response).toBe('Извините, произошла ошибка. Попробуйте еще раз.');
      
      // number
      response = responseGenerator.generateResponse(123, context);
      expect(response).toBe('Извините, произошла ошибка. Попробуйте еще раз.');
    });

    it('should handle missing entities gracefully', () => {
      const parsed = {
        intent: 'booking',
        // missing entities
        action: 'none'
      };
      const context = { phone: '+79991234567', companyId: '12345' };
      
      const response = responseGenerator.generateResponse(parsed, context);
      expect(response).toBe('Извините, не удалось распознать ваш запрос. Пожалуйста, уточните.');
    });

    it('should handle invalid entities gracefully', () => {
      const parsed = {
        intent: 'booking',
        entities: 'not an object',
        action: 'none'
      };
      const context = { phone: '+79991234567', companyId: '12345' };
      
      const response = responseGenerator.generateResponse(parsed, context);
      expect(response).toBe('Извините, не удалось распознать ваш запрос. Пожалуйста, уточните.');
    });

    it('should ensure action is present before generating response', () => {
      const parsed = {
        intent: 'booking',
        entities: { service: 'маникюр' }
        // no action field
      };
      const context = { phone: '+79991234567', companyId: '12345' };
      
      const response = responseGenerator.generateResponse(parsed, context);
      expect(parsed.action).toBeDefined();
      expect(parsed.action).toBe('search_slots');
      expect(response).toBeNull();
    });
  });
});