// src/__tests__/services/nlu/prompt-builder.test.js
const PromptBuilder = require('../../../services/nlu/prompt-builder');

describe('PromptBuilder', () => {
  let promptBuilder;

  beforeEach(() => {
    promptBuilder = new PromptBuilder();
  });

  describe('buildExtractionPrompt', () => {
    const basicContext = {
      phone: '+79991234567',
      companyId: '12345'
    };

    it('should build prompt with basic context', () => {
      const message = 'Хочу записаться на маникюр';
      const prompt = promptBuilder.buildExtractionPrompt(message, basicContext);

      expect(prompt).toContain('СООБЩЕНИЕ КЛИЕНТА: "Хочу записаться на маникюр"');
      expect(prompt).toContain('ДОСТУПНЫЕ УСЛУГИ:');
      expect(prompt).toContain('ДОСТУПНЫЕ МАСТЕРА:');
      expect(prompt).toContain('Текущая дата:');
      expect(prompt).toContain('Текущее время:');
      expect(prompt).toContain('ОТВЕТЬ СТРОГО в JSON формате:');
    });

    it('should include previous booking info when available', () => {
      const contextWithBooking = {
        ...basicContext,
        lastBooking: {
          service: 'маникюр',
          staff: 'Мария'
        }
      };
      
      const prompt = promptBuilder.buildExtractionPrompt('Хочу записаться', contextWithBooking);
      expect(prompt).toContain('Последняя запись: маникюр к Мария');
    });

    it('should include client preferences when available', () => {
      const contextWithClient = {
        ...basicContext,
        client: {
          preferredStaff: 'Ольга'
        }
      };
      
      const prompt = promptBuilder.buildExtractionPrompt('Хочу записаться', contextWithClient);
      expect(prompt).toContain('Предпочитаемый мастер: Ольга');
    });

    it('should include date transformation rules', () => {
      const prompt = promptBuilder.buildExtractionPrompt('Запиши завтра', basicContext);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      expect(prompt).toContain(`"завтра" → "${tomorrowStr}"`);
    });

    it('should include time normalization rules', () => {
      const prompt = promptBuilder.buildExtractionPrompt('Запиши утром', basicContext);
      
      expect(prompt).toContain('"утром" → "09:00"');
      expect(prompt).toContain('"днем" → "12:00"');
      expect(prompt).toContain('"вечером" → "18:00"');
    });

    it('should not include response field warning', () => {
      const prompt = promptBuilder.buildExtractionPrompt('Test', basicContext);
      
      expect(prompt).toContain('НЕ ДОБАВЛЯЙ поле "response"');
    });

    it('should include confidence rules', () => {
      const prompt = promptBuilder.buildExtractionPrompt('Test', basicContext);
      
      expect(prompt).toContain('confidence = 0.9 если все ясно');
      expect(prompt).toContain('0.5-0.7 при неточностях');
    });
  });

  describe('buildQuickIntentPrompt', () => {
    it('should build simplified intent detection prompt', () => {
      const message = 'Хочу записаться';
      const prompt = promptBuilder.buildQuickIntentPrompt(message);

      expect(prompt).toContain('Определи намерение клиента салона красоты');
      expect(prompt).toContain('Сообщение: "Хочу записаться"');
      expect(prompt).toContain('booking (хочет записаться)');
      expect(prompt).toContain('Ответь одним словом:');
    });

    it('should include all intent options', () => {
      const prompt = promptBuilder.buildQuickIntentPrompt('test');

      expect(prompt).toContain('booking');
      expect(prompt).toContain('reschedule');
      expect(prompt).toContain('cancel');
      expect(prompt).toContain('info');
      expect(prompt).toContain('other');
    });
  });

  describe('_buildBasePrompt', () => {
    it('should include available services and staff', () => {
      const basePrompt = promptBuilder._basePrompt;

      expect(basePrompt).toContain('ДОСТУПНЫЕ УСЛУГИ: маникюр, педикюр, стрижка, окрашивание');
      expect(basePrompt).toContain('ДОСТУПНЫЕ МАСТЕРА: Мария, Ольга, Екатерина, Елена, Наталья');
    });
  });

  describe('_getTomorrowDate', () => {
    it('should return tomorrow date in YYYY-MM-DD format', () => {
      const tomorrowDate = promptBuilder._getTomorrowDate();
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expected = tomorrow.toISOString().split('T')[0];
      
      expect(tomorrowDate).toBe(expected);
      expect(tomorrowDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('performance', () => {
    it('should reuse static parts of prompt', () => {
      const message = 'Test message';
      const context = { phone: '+79991234567', companyId: '12345' };
      
      // Build multiple prompts
      const prompt1 = promptBuilder.buildExtractionPrompt(message, context);
      const prompt2 = promptBuilder.buildExtractionPrompt(message, context);
      
      // Check that base prompt and example JSON are reused
      expect(promptBuilder._basePrompt).toBeDefined();
      expect(promptBuilder._exampleJson).toBeDefined();
      
      // Both prompts should contain same base content
      expect(prompt1).toContain(promptBuilder._basePrompt);
      expect(prompt2).toContain(promptBuilder._basePrompt);
    });
  });
});