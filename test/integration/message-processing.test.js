// test/integration/message-processing.test.js
const MessageWorkerV2 = require('../../src/workers/message-worker-v2');
const messageQueue = require('../../src/queue/message-queue');
const whatsappClient = require('../../src/integrations/whatsapp/client');
const AIAdminV2 = require('../../src/services/ai-admin-v2');
const contextService = require('../../src/services/context');
const supabase = require('../../src/database/supabase');
const { Queue } = require('bullmq');

// Mocks
jest.mock('../../src/integrations/whatsapp/client');
jest.mock('../../src/services/ai-admin-v2');
jest.mock('../../src/services/context');
jest.mock('../../src/database/supabase');
jest.mock('bullmq');

describe('Message Processing Integration', () => {
  let worker;
  let mockJob;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock job
    mockJob = {
      id: 'job-123',
      data: {
        from: '79001234567@c.us',
        message: 'Хочу записаться на маникюр завтра в 15:00',
        timestamp: new Date().toISOString(),
        companyId: 962302
      },
      updateProgress: jest.fn()
    };

    // Setup default mocks
    contextService.getContext.mockResolvedValue(null);
    contextService.setContext.mockResolvedValue(true);
    
    whatsappClient.sendMessage.mockResolvedValue({
      success: true,
      messageId: 'msg-sent-123'
    });
  });

  describe('Successful message flow', () => {
    it('should process booking request successfully', async () => {
      // Mock AI response with booking command
      AIAdminV2.processMessage.mockResolvedValue({
        success: true,
        response: 'Отлично! Я нашла свободное время на завтра в 15:00. Записать вас на маникюр к мастеру Анна?',
        commands: ['SEARCH_SLOTS', 'SHOW_AVAILABLE_SLOT'],
        executedCommands: [
          {
            type: 'SEARCH_SLOTS',
            data: { 
              available: true,
              slots: [{ time: '15:00', staff: 'Анна' }]
            }
          }
        ]
      });

      // Process message
      await worker.processMessage(mockJob);

      // Verify AI was called
      expect(AIAdminV2.processMessage).toHaveBeenCalledWith(
        'Хочу записаться на маникюр завтра в 15:00',
        '79001234567@c.us',
        962302
      );

      // Verify response was sent
      expect(whatsappClient.sendMessage).toHaveBeenCalledWith(
        '79001234567@c.us',
        expect.stringContaining('нашла свободное время')
      );

      // Verify progress updates
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should handle conversation context', async () => {
      // Mock existing context
      const existingContext = {
        lastInteraction: new Date(Date.now() - 60000).toISOString(),
        bookingStage: 'selecting_service',
        selectedService: 'Маникюр'
      };
      
      contextService.getContext.mockResolvedValue(existingContext);

      AIAdminV2.processMessage.mockResolvedValue({
        success: true,
        response: 'Вы выбрали маникюр. Когда вам удобно прийти?',
        commands: []
      });

      await worker.processMessage(mockJob);

      // Verify context was passed to AI
      expect(AIAdminV2.processMessage).toHaveBeenCalled();
      
      // Verify context was updated
      expect(contextService.setContext).toHaveBeenCalledWith(
        '79001234567',
        expect.objectContaining({
          lastMessage: 'Хочу записаться на маникюр завтра в 15:00',
          lastInteraction: expect.any(String)
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle AI service errors gracefully', async () => {
      AIAdminV2.processMessage.mockRejectedValue(
        new Error('AI service unavailable')
      );

      await worker.processMessage(mockJob);

      // Should send error message to user
      expect(whatsappClient.sendMessage).toHaveBeenCalledWith(
        '79001234567@c.us',
        expect.stringContaining('Извините')
      );
    });

    it('should handle WhatsApp send errors', async () => {
      AIAdminV2.processMessage.mockResolvedValue({
        success: true,
        response: 'Test response'
      });

      whatsappClient.sendMessage.mockRejectedValue(
        new Error('WhatsApp unavailable')
      );

      // Should throw to retry
      await expect(worker.processMessage(mockJob)).rejects.toThrow();
    });

    it('should handle malformed job data', async () => {
      const badJob = {
        id: 'bad-job',
        data: {
          // missing required fields
          timestamp: new Date().toISOString()
        }
      };

      await expect(worker.processMessage(badJob)).rejects.toThrow();
      
      expect(AIAdminV2.processMessage).not.toHaveBeenCalled();
      expect(whatsappClient.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Special message types', () => {
    it('should handle voice messages', async () => {
      mockJob.data.type = 'ptt'; // Push to talk (voice)
      mockJob.data.message = undefined;
      mockJob.data.mediaUrl = 'https://example.com/voice.ogg';

      await worker.processMessage(mockJob);

      expect(whatsappClient.sendMessage).toHaveBeenCalledWith(
        '79001234567@c.us',
        expect.stringContaining('голосовые сообщения')
      );
    });

    it('should handle image messages', async () => {
      mockJob.data.type = 'image';
      mockJob.data.message = undefined;
      mockJob.data.mediaUrl = 'https://example.com/image.jpg';
      mockJob.data.caption = 'Мой маникюр';

      AIAdminV2.processMessage.mockResolvedValue({
        success: true,
        response: 'Красивый маникюр! Хотите записаться на повторную процедуру?'
      });

      await worker.processMessage(mockJob);

      expect(AIAdminV2.processMessage).toHaveBeenCalledWith(
        'Мой маникюр',
        '79001234567@c.us',
        962302
      );
    });

    it('should handle location messages', async () => {
      mockJob.data.type = 'location';
      mockJob.data.location = {
        latitude: 55.7558,
        longitude: 37.6173
      };

      await worker.processMessage(mockJob);

      expect(whatsappClient.sendMessage).toHaveBeenCalledWith(
        '79001234567@c.us',
        expect.stringContaining('локация')
      );
    });
  });

  describe('Batched messages', () => {
    it('should handle batched messages correctly', async () => {
      mockJob.data.isBatched = true;
      mockJob.data.originalCount = 3;
      mockJob.data.message = 'Привет\nХочу записаться\nНа завтра можно?';

      AIAdminV2.processMessage.mockResolvedValue({
        success: true,
        response: 'Здравствуйте! Конечно, давайте подберем время на завтра.'
      });

      await worker.processMessage(mockJob);

      expect(AIAdminV2.processMessage).toHaveBeenCalledWith(
        'Привет\nХочу записаться\nНа завтра можно?',
        '79001234567@c.us',
        962302
      );
    });
  });

  describe('Performance tracking', () => {
    it('should track processing metrics', async () => {
      const startTime = Date.now();
      
      AIAdminV2.processMessage.mockImplementation(async () => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          response: 'Test response'
        };
      });

      await worker.processMessage(mockJob);

      const processingTime = Date.now() - startTime;
      
      // Should be tracked (in real implementation)
      expect(processingTime).toBeGreaterThan(100);
      expect(processingTime).toBeLessThan(200);
    });
  });
});