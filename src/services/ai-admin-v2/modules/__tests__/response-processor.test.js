const ResponseProcessor = require('../response-processor');

// Mock dependencies
jest.mock('../command-executor');
const commandExecutor = require('../command-executor');

describe('ResponseProcessor', () => {
  let processor;
  let mockFormatter;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFormatter = {
      applyBusinessTypeFormatting: jest.fn(text => text)
    };
    
    processor = new ResponseProcessor(mockFormatter);
  });

  describe('extractCommands', () => {
    it('should extract single command without params', () => {
      const text = 'Давайте посмотрим цены [SHOW_PRICES]';
      const commands = processor.extractCommands(text);
      
      expect(commands).toHaveLength(1);
      expect(commands[0]).toEqual({
        command: 'SHOW_PRICES',
        params: {},
        rawMatch: '[SHOW_PRICES]'
      });
    });

    it('should extract command with params', () => {
      const text = '[SEARCH_SLOTS date: 2024-01-15, serviceIds: 123,456]';
      const commands = processor.extractCommands(text);
      
      expect(commands).toHaveLength(1);
      expect(commands[0].command).toBe('SEARCH_SLOTS');
      expect(commands[0].params).toEqual({
        date: '2024-01-15',
        serviceIds: '123,456'
      });
    });

    it('should extract multiple commands', () => {
      const text = '[SAVE_CLIENT_NAME name: Иван] и [CREATE_BOOKING date: 2024-01-15, time: 10:00]';
      const commands = processor.extractCommands(text);
      
      expect(commands).toHaveLength(2);
      expect(commands[0].command).toBe('SAVE_CLIENT_NAME');
      expect(commands[1].command).toBe('CREATE_BOOKING');
    });

    it('should return empty array for text without commands', () => {
      const text = 'Просто обычный текст без команд';
      const commands = processor.extractCommands(text);
      
      expect(commands).toHaveLength(0);
    });
  });

  describe('parseCommandParams', () => {
    it('should parse simple params', () => {
      const params = processor.parseCommandParams('date: 2024-01-15, time: 10:00');
      
      expect(params).toEqual({
        date: '2024-01-15',
        time: '10:00'
      });
    });

    it('should handle params with spaces', () => {
      const params = processor.parseCommandParams('name: Иван Иванов, phone: +7 999 123-45-67');
      
      expect(params).toEqual({
        name: 'Иван Иванов',
        phone: '+7 999 123-45-67'
      });
    });

    it('should return empty object for no params', () => {
      expect(processor.parseCommandParams('')).toEqual({});
      expect(processor.parseCommandParams(null)).toEqual({});
      expect(processor.parseCommandParams(undefined)).toEqual({});
    });
  });

  describe('removeCommandsFromResponse', () => {
    it('should remove commands from text', () => {
      const text = 'Отлично! [CREATE_BOOKING date: 2024-01-15] Вы записаны!';
      const cleaned = processor.removeCommandsFromResponse(text);
      
      expect(cleaned).toBe('Отлично!  Вы записаны!');
    });

    it('should remove multiple commands', () => {
      const text = '[COMMAND1] текст [COMMAND2 params] еще текст [COMMAND3]';
      const cleaned = processor.removeCommandsFromResponse(text);
      
      expect(cleaned).toBe('текст  еще текст');
    });
  });

  describe('processSpecialCharacters', () => {
    it('should replace pipes with dots', () => {
      const text = 'Услуга 1 | Услуга 2 | Услуга 3';
      const processed = processor.processSpecialCharacters(text);
      
      expect(processed).toBe('Услуга 1 . Услуга 2 . Услуга 3');
    });

    it('should remove multiple spaces', () => {
      const text = 'Текст   с     множественными    пробелами';
      const processed = processor.processSpecialCharacters(text);
      
      expect(processed).toBe('Текст с множественными пробелами');
    });

    it('should remove spaces before punctuation', () => {
      const text = 'Привет , как дела ? Отлично !';
      const processed = processor.processSpecialCharacters(text);
      
      expect(processed).toBe('Привет, как дела? Отлично!');
    });
  });

  describe('processAIResponse', () => {
    it('should process response with commands', async () => {
      const aiResponse = 'Конечно! [SEARCH_SLOTS date: 2024-01-15] Давайте найдем время.';
      const context = {
        company: { id: 1, type: 'barbershop' },
        phone: '79001234567'
      };

      commandExecutor.executeCommands.mockResolvedValue([
        {
          command: 'SEARCH_SLOTS',
          success: true,
          data: { slots: [] }
        }
      ]);

      const result = await processor.processAIResponse(aiResponse, context);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Конечно! Давайте найдем время.');
      expect(result.executedCommands).toHaveLength(1);
      expect(commandExecutor.executeCommands).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ command: 'SEARCH_SLOTS' })
        ]),
        context
      );
    });

    it('should handle response without commands', async () => {
      const aiResponse = 'Просто текст без команд.';
      const context = { company: { type: 'beauty' } };

      commandExecutor.executeCommands.mockResolvedValue([]);

      const result = await processor.processAIResponse(aiResponse, context);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Просто текст без команд.');
      expect(result.executedCommands).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should handle booking error with availability issue', async () => {
      const response = 'Отлично, записываю вас на 10:00';
      const error = 'Время уже занято';
      const context = {};

      const result = await processor.handleBookingError(response, error, context);

      expect(result).toContain('к сожалению, это время уже занято');
      expect(result).toContain('Давайте подберем другое удобное время');
    });

    it('should handle general booking error', async () => {
      const response = 'Записываю вас';
      const error = 'Unknown error';
      const context = {};

      const result = await processor.handleBookingError(response, error, context);

      expect(result).toContain('не удалось создать запись');
      expect(result).toContain('Попробуйте выбрать другое время');
    });

    it('should identify availability errors correctly', () => {
      expect(processor.isAvailabilityError('Время уже занято')).toBe(true);
      expect(processor.isAvailabilityError('Slot not available')).toBe(true);
      expect(processor.isAvailabilityError('Network error')).toBe(false);
    });
  });
});