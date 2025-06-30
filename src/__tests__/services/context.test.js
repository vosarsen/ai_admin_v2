// src/__tests__/services/context.test.js
const ContextService = require('../../services/context');

// Mock Redis
jest.mock('../../utils/redis-factory', () => ({
  createRedisClient: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    lpush: jest.fn(),
    ltrim: jest.fn(),
    lrange: jest.fn().mockResolvedValue([]),
    info: jest.fn().mockResolvedValue('memory:1000'),
    dbsize: jest.fn().mockResolvedValue(10),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true)
  }))
}));

describe('ContextService', () => {
  let contextService;
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();
    const { createRedisClient } = require('../../utils/redis-factory');
    mockRedis = createRedisClient();
    contextService = new ContextService();
    contextService.redis = mockRedis;
  });

  describe('getConversationContext', () => {
    it('should return empty context for new conversation', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.lrange.mockResolvedValue([]);

      const context = await contextService.getConversationContext('79936363848');

      expect(context).toEqual({
        phone: '79936363848',
        messages: [],
        lastInteraction: expect.any(String)
      });
    });

    it('should return existing context', async () => {
      const existingContext = {
        phone: '79936363848',
        clientName: 'Test User',
        lastInteraction: new Date().toISOString()
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(existingContext));
      mockRedis.lrange.mockResolvedValue(['message1', 'message2']);

      const context = await contextService.getConversationContext('79936363848');

      expect(context).toEqual({
        ...existingContext,
        messages: ['message1', 'message2']
      });
    });
  });

  describe('updateConversationContext', () => {
    it('should update context and expire key', async () => {
      const phone = '79936363848';
      const updates = { clientName: 'New Name' };

      await contextService.updateConversationContext(phone, updates);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'context:79936363848',
        expect.stringContaining('"clientName":"New Name"')
      );
      expect(mockRedis.expire).toHaveBeenCalledWith('context:79936363848', 3600);
    });
  });

  describe('addMessage', () => {
    it('should add message to history', async () => {
      const phone = '79936363848';
      const message = 'Test message';
      const isFromUser = true;

      await contextService.addMessage(phone, message, isFromUser);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'messages:79936363848',
        expect.stringContaining('"text":"Test message"')
      );
      expect(mockRedis.ltrim).toHaveBeenCalledWith('messages:79936363848', 0, 19);
      expect(mockRedis.expire).toHaveBeenCalledWith('messages:79936363848', 3600);
    });
  });

  describe('getMetrics', () => {
    it('should return Redis metrics', async () => {
      const metrics = await contextService.getMetrics();

      expect(metrics).toEqual({
        memoryUsage: '1000',
        totalKeys: 10
      });
      expect(mockRedis.info).toHaveBeenCalledWith('memory');
      expect(mockRedis.dbsize).toHaveBeenCalled();
    });
  });
});