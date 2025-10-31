// src/services/ai-admin-v2/__tests__/index.test.js
const AIAdminV2 = require('../index');
const dataLoader = require('../modules/data-loader');
const commandHandler = require('../modules/command-handler');
const contextService = require('../../context');
const intermediateContext = require('../../context/intermediate-context');

// Mock dependencies
jest.mock('../modules/data-loader');
jest.mock('../modules/command-handler');
jest.mock('../../context');
jest.mock('../../context/intermediate-context');
jest.mock('../../ai', () => ({
  _callAI: jest.fn()
}));
jest.mock('../../booking');

describe('AIAdminV2', () => {
  let aiProvider;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    aiProvider = require('../../ai');
    aiProvider._callAI.mockResolvedValue('Test AI response');
    
    contextService.getContext.mockResolvedValue({});
    contextService.getCachedFullContext.mockResolvedValue(null);
    contextService.setCachedFullContext.mockResolvedValue();
    
    intermediateContext.getIntermediateContext.mockResolvedValue(null);
    intermediateContext.saveProcessingStart.mockResolvedValue();
    intermediateContext.updateAfterAIAnalysis.mockResolvedValue();
    intermediateContext.markAsCompleted.mockResolvedValue();
    
    dataLoader.loadCompany.mockResolvedValue({ company_id: 1, title: 'Test Salon' });
    dataLoader.loadClient.mockResolvedValue(null);
    dataLoader.loadServices.mockResolvedValue([]);
    dataLoader.loadStaff.mockResolvedValue([]);
    dataLoader.loadConversation.mockResolvedValue([]);
    dataLoader.loadBusinessStats.mockResolvedValue({});
    dataLoader.loadStaffSchedules.mockResolvedValue([]);
    dataLoader.saveContext.mockResolvedValue();
    
    commandHandler.extractCommands.mockReturnValue([]);
    commandHandler.removeCommands.mockImplementation((text) => text);
    commandHandler.executeCommands.mockResolvedValue([]);
  });

  describe('processMessage', () => {
    it('should process a simple greeting message', async () => {
      const message = 'Привет';
      const phone = '79001234567@c.us';
      const companyId = 1;
      
      const result = await AIAdminV2.processMessage(message, phone, companyId);
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(dataLoader.loadCompany).toHaveBeenCalledWith(companyId);
      expect(aiProvider._callAI).toHaveBeenCalled();
    });

    it('should handle pending cancellation state', async () => {
      // Mock bookingService at module level
      const mockBookingService = {
        cancelBooking: jest.fn().mockResolvedValue({ success: true })
      };
      jest.doMock('../../booking', () => mockBookingService);
      
      contextService.getContext.mockResolvedValue({
        pendingCancellation: [
          { id: 1, date: '2024-07-20', time: '15:00', services: 'Стрижка', staff: 'Сергей' }
        ]
      });
      
      const message = '1';
      const phone = '79001234567@c.us';
      const companyId = 1;
      
      const result = await AIAdminV2.processMessage(message, phone, companyId);
      
      expect(result.success).toBe(true);
      expect(result.response).toContain('Запись успешно отменена');
      
      // Clean up mock
      jest.dontMock('../../booking');
    });

    it('should use cached context when available', async () => {
      const cachedContext = {
        company: { company_id: 1, title: 'Test Salon' },
        client: { name: 'Тест', phone: '79001234567' },
        services: [],
        staff: []
      };
      
      contextService.getCachedFullContext.mockResolvedValue(cachedContext);
      
      const result = await AIAdminV2.processMessage('Привет', '79001234567@c.us', 1);
      
      expect(result.success).toBe(true);
      expect(dataLoader.loadCompany).not.toHaveBeenCalled();
      expect(contextService.getCachedFullContext).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      aiProvider._callAI.mockRejectedValue(new Error('AI service error'));
      
      const result = await AIAdminV2.processMessage('Привет', '79001234567@c.us', 1);
      
      expect(result.success).toBe(false);
      expect(result.response).toBe('Извините, произошла ошибка. Пожалуйста, попробуйте еще раз.');
      expect(result.error).toBe('AI service error');
    });
  });

  describe('loadFullContext', () => {
    it('should load all context data in parallel', async () => {
      const phone = '79001234567@c.us';
      const companyId = 1;
      
      const context = await AIAdminV2.loadFullContext(phone, companyId);
      
      expect(context).toBeDefined();
      expect(context.company).toBeDefined();
      expect(dataLoader.loadCompany).toHaveBeenCalledWith(companyId);
      expect(dataLoader.loadClient).toHaveBeenCalledWith(phone, companyId);
      expect(dataLoader.loadServices).toHaveBeenCalledWith(companyId);
      expect(dataLoader.loadStaff).toHaveBeenCalledWith(companyId);
    });

    it('should use client name from Redis if not in database', async () => {
      dataLoader.loadClient.mockResolvedValue(null);
      contextService.getContext.mockResolvedValue({
        clientName: 'Иван'
      });
      
      const context = await AIAdminV2.loadFullContext('79001234567@c.us', 1);
      
      expect(context.client).toBeDefined();
      expect(context.client.name).toBe('Иван');
    });

    it('should save context to cache after loading', async () => {
      await AIAdminV2.loadFullContext('79001234567@c.us', 1);
      
      expect(contextService.setCachedFullContext).toHaveBeenCalled();
    });
  });

  describe('processAIResponse', () => {
    it('should extract and execute commands from AI response', async () => {
      const aiResponse = 'Конечно! [SEARCH_SLOTS service_name: стрижка, date: сегодня]';
      const context = { company: { type: 'barbershop' } };
      
      commandHandler.extractCommands.mockReturnValue([
        { command: 'SEARCH_SLOTS', params: { service_name: 'стрижка', date: 'сегодня' } }
      ]);
      commandHandler.removeCommands.mockReturnValue('Конечно!');
      commandHandler.executeCommands.mockResolvedValue([
        { type: 'slots', data: [] }
      ]);
      
      const result = await AIAdminV2.processAIResponse(aiResponse, context);
      
      expect(result.success).toBe(true);
      expect(result.response).toContain('Конечно!');
      expect(result.executedCommands).toHaveLength(1);
      expect(commandHandler.executeCommands).toHaveBeenCalled();
    });

    it('should format slots results', async () => {
      const aiResponse = 'Проверю время [SEARCH_SLOTS]';
      const context = { company: { type: 'barbershop' } };
      const slots = [
        { time: '10:00', staff_name: 'Сергей' },
        { time: '11:00', staff_name: 'Сергей' }
      ];
      
      commandHandler.extractCommands.mockReturnValue([
        { command: 'SEARCH_SLOTS' }
      ]);
      commandHandler.executeCommands.mockResolvedValue([
        { type: 'slots', data: slots }
      ]);
      
      aiProvider._callAI.mockResolvedValue('У Сергея свободно: 10:00, 11:00');
      
      const result = await AIAdminV2.processAIResponse(aiResponse, context);
      
      expect(result.response).toContain('У Сергея свободно');
    });

    it('should handle booking creation results', async () => {
      const aiResponse = 'Записываю [CREATE_BOOKING]';
      const context = { 
        company: { type: 'barbershop', company_id: 1 },
        phone: '79001234567@c.us'
      };
      
      commandHandler.extractCommands.mockReturnValue([
        { command: 'CREATE_BOOKING' }
      ]);
      commandHandler.executeCommands.mockResolvedValue([
        { 
          type: 'booking_created', 
          data: {
            record_id: '123',
            date: '2024-07-20',
            time: '15:00',
            services: 'Стрижка',
            staff: 'Сергей'
          }
        }
      ]);
      
      const result = await AIAdminV2.processAIResponse(aiResponse, context);
      
      expect(result.response).toContain('✅');
      expect(result.success).toBe(true);
    });

    it('should handle errors from commands', async () => {
      const aiResponse = 'Записываю [CREATE_BOOKING]';
      const context = { company: { type: 'barbershop' } };
      
      commandHandler.extractCommands.mockReturnValue([
        { command: 'CREATE_BOOKING' }
      ]);
      commandHandler.executeCommands.mockResolvedValue([
        { 
          type: 'error',
          command: 'CREATE_BOOKING',
          error: 'Услуга недоступна в выбранное время'
        }
      ]);
      
      const result = await AIAdminV2.processAIResponse(aiResponse, context);
      
      expect(result.response).toContain('К сожалению, выбранное время недоступно');
    });
  });

  describe('buildSmartPrompt', () => {
    it('should build prompt with all context information', () => {
      const message = 'Хочу записаться';
      const context = {
        company: { 
          title: 'Test Salon',
          type: 'barbershop',
          address: 'Test Address'
        },
        client: {
          name: 'Иван',
          phone: '79001234567'
        },
        services: [],
        staff: [],
        conversation: [],
        businessStats: { todayLoad: 50 },
        staffSchedules: [],
        currentTime: '2024-07-20 10:00',
        timezone: 'Europe/Moscow'
      };
      const phone = '79001234567@c.us';
      
      const prompt = AIAdminV2.buildSmartPrompt(message, context, phone);
      
      expect(prompt).toContain('Test Salon');
      expect(prompt).toContain('Иван');
      expect(prompt).toContain('Хочу записаться');
      expect(prompt).toContain('ТЕКУЩЕЕ СООБЩЕНИЕ');
    });

    it('should include continuation info for recent conversations', () => {
      const context = {
        company: { type: 'barbershop' },
        canContinueConversation: true,
        conversationSummary: {
          recentMessages: [
            { role: 'user', content: 'Привет' },
            { role: 'assistant', content: 'Здравствуйте!' }
          ]
        },
        services: [],
        staff: [],
        staffSchedules: []
      };
      
      const prompt = AIAdminV2.buildSmartPrompt('Хочу записаться', context, '79001234567');
      
      expect(prompt).toContain('продолжение прерванного диалога');
      expect(prompt).toContain('user: Привет');
    });

    it('should include preferences for returning clients', () => {
      const context = {
        company: { type: 'barbershop' },
        client: { name: 'Иван' },
        preferences: {
          favoriteService: 'Стрижка',
          favoriteStaff: 'Сергей'
        },
        isReturningClient: true,
        services: [],
        staff: [],
        staffSchedules: []
      };
      
      const prompt = AIAdminV2.buildSmartPrompt('Привет', context, '79001234567');
      
      expect(prompt).toContain('ПРЕДПОЧТЕНИЯ КЛИЕНТА');
      expect(prompt).toContain('Любимая услуга: Стрижка');
      expect(prompt).toContain('Предпочитаемый мастер: Сергей');
    });
  });
});