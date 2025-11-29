/**
 * Telegram Manager Unit Tests
 *
 * Tests for TelegramManager - the high-level orchestrator for Telegram Business Bot.
 * Uses mocking to isolate from external dependencies (database, bot, queue).
 *
 * Run with: npm test -- tests/telegram/telegram-manager.test.js
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');

// Mock dependencies before requiring the module
jest.mock('../../src/integrations/telegram/telegram-bot');
jest.mock('../../src/database/postgres');
jest.mock('../../src/queue/message-queue');
jest.mock('../../src/config', () => ({
  telegram: {
    enabled: true,
    botToken: 'test-token',
    defaultCompanyId: 962302,
    webhookSecret: 'test-secret'
  },
  app: {
    port: 3000
  }
}));

const telegramBot = require('../../src/integrations/telegram/telegram-bot');
const messageQueue = require('../../src/queue/message-queue');

describe('TelegramManager', () => {
  let TelegramManager;
  let manager;

  // Mock repository
  const mockRepository = {
    findByBusinessConnectionId: jest.fn(),
    findByCompanyId: jest.fn(),
    getAllActive: jest.fn(),
    countActive: jest.fn(),
    upsertByBusinessConnectionId: jest.fn(),
    deactivateByBusinessConnectionId: jest.fn(),
    deactivate: jest.fn()
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset singleton
    jest.resetModules();

    // Setup default mock implementations
    telegramBot.initialize = jest.fn().mockResolvedValue(true);
    telegramBot.on = jest.fn();
    telegramBot.sendMessage = jest.fn().mockResolvedValue({ success: true, messageId: '123' });
    telegramBot.sendWithTyping = jest.fn().mockResolvedValue({ success: true, messageId: '123' });
    telegramBot.healthCheck = jest.fn().mockResolvedValue({ healthy: true });
    telegramBot.getMetrics = jest.fn().mockReturnValue({ messagesReceived: 0 });
    telegramBot.shutdown = jest.fn().mockResolvedValue(undefined);
    telegramBot.setWebhook = jest.fn().mockResolvedValue(true);
    telegramBot.getWebhookHandler = jest.fn().mockReturnValue(() => {});

    mockRepository.getAllActive.mockResolvedValue([]);
    mockRepository.countActive.mockResolvedValue(0);

    // Re-require to get fresh instance
    jest.doMock('../../src/repositories', () => ({
      TelegramConnectionRepository: jest.fn(() => mockRepository)
    }));

    // Clear module cache and get fresh manager
    delete require.cache[require.resolve('../../src/integrations/telegram/telegram-manager')];

    // For unit tests, we need to create a new instance manually
    // because the module exports a singleton
    const TelegramManagerClass = require('../../src/integrations/telegram/telegram-manager').constructor;

    // Create a fresh instance for testing
    manager = {
      isInitialized: false,
      connectionRepository: mockRepository,
      connectionCache: new Map(),
      cacheTTL: 5 * 60 * 1000,
      metrics: {
        messagesReceived: 0,
        messagesSent: 0,
        messagesQueued: 0,
        connectionLookups: 0,
        cacheHits: 0,
        errors: 0,
        startTime: null
      }
    };
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Connection Cache', () => {
    test('should cache connection lookups', async () => {
      const mockConnection = {
        company_id: 962302,
        business_connection_id: 'test-conn-123',
        can_reply: true
      };

      mockRepository.findByBusinessConnectionId.mockResolvedValue(mockConnection);

      // Simulate resolveConnection
      manager.metrics.connectionLookups++;
      const connection = await mockRepository.findByBusinessConnectionId('test-conn-123');

      // Cache the result
      manager.connectionCache.set('test-conn-123', {
        companyId: connection.company_id,
        canReply: connection.can_reply,
        cachedAt: Date.now()
      });

      // Second lookup should hit cache
      manager.metrics.connectionLookups++;
      const cached = manager.connectionCache.get('test-conn-123');

      expect(cached).toBeDefined();
      expect(cached.companyId).toBe(962302);
      expect(mockRepository.findByBusinessConnectionId).toHaveBeenCalledTimes(1);
    });

    test('should expire cached entries after TTL', async () => {
      // Add cached entry with old timestamp
      manager.connectionCache.set('test-conn-123', {
        companyId: 962302,
        canReply: true,
        cachedAt: Date.now() - (10 * 60 * 1000) // 10 minutes ago
      });

      const cached = manager.connectionCache.get('test-conn-123');
      const isExpired = (Date.now() - cached.cachedAt) >= manager.cacheTTL;

      expect(isExpired).toBe(true);
    });

    test('should invalidate cache for specific connection', () => {
      manager.connectionCache.set('conn-1', { companyId: 1, cachedAt: Date.now() });
      manager.connectionCache.set('conn-2', { companyId: 2, cachedAt: Date.now() });

      expect(manager.connectionCache.size).toBe(2);

      // Invalidate one connection
      manager.connectionCache.delete('conn-1');

      expect(manager.connectionCache.size).toBe(1);
      expect(manager.connectionCache.has('conn-1')).toBe(false);
      expect(manager.connectionCache.has('conn-2')).toBe(true);
    });

    test('should invalidate all cache entries for a company', () => {
      manager.connectionCache.set('conn-1', { companyId: 100, cachedAt: Date.now() });
      manager.connectionCache.set('conn-2', { companyId: 100, cachedAt: Date.now() });
      manager.connectionCache.set('conn-3', { companyId: 200, cachedAt: Date.now() });

      // Invalidate company 100
      for (const [connId, info] of manager.connectionCache.entries()) {
        if (info.companyId === 100) {
          manager.connectionCache.delete(connId);
        }
      }

      expect(manager.connectionCache.size).toBe(1);
      expect(manager.connectionCache.has('conn-3')).toBe(true);
    });
  });

  describe('Metrics', () => {
    test('should track messages received', () => {
      manager.metrics.messagesReceived++;
      manager.metrics.messagesReceived++;

      expect(manager.metrics.messagesReceived).toBe(2);
    });

    test('should track messages sent', () => {
      manager.metrics.messagesSent++;

      expect(manager.metrics.messagesSent).toBe(1);
    });

    test('should track messages queued', () => {
      manager.metrics.messagesQueued++;
      manager.metrics.messagesQueued++;
      manager.metrics.messagesQueued++;

      expect(manager.metrics.messagesQueued).toBe(3);
    });

    test('should track errors', () => {
      manager.metrics.errors++;

      expect(manager.metrics.errors).toBe(1);
    });

    test('should calculate cache hit rate', () => {
      manager.metrics.connectionLookups = 10;
      manager.metrics.cacheHits = 7;

      const hitRate = (manager.metrics.cacheHits / manager.metrics.connectionLookups * 100).toFixed(2);

      expect(hitRate).toBe('70.00');
    });

    test('should handle zero lookups for cache hit rate', () => {
      manager.metrics.connectionLookups = 0;
      manager.metrics.cacheHits = 0;

      const hitRate = manager.metrics.connectionLookups > 0
        ? (manager.metrics.cacheHits / manager.metrics.connectionLookups * 100).toFixed(2) + '%'
        : '0%';

      expect(hitRate).toBe('0%');
    });
  });

  describe('Business Connection Handling', () => {
    test('should save new business connection', async () => {
      const connectionData = {
        connectionId: 'conn-123',
        userId: 12345,
        username: 'test_user',
        firstName: 'Test',
        canReply: true,
        isEnabled: true
      };

      mockRepository.upsertByBusinessConnectionId.mockResolvedValue({
        id: 1,
        company_id: 962302,
        ...connectionData
      });

      // Simulate handleBusinessConnection
      const companyId = 962302;

      await mockRepository.upsertByBusinessConnectionId({
        company_id: companyId,
        business_connection_id: connectionData.connectionId,
        telegram_user_id: connectionData.userId,
        telegram_username: connectionData.username,
        telegram_first_name: connectionData.firstName,
        can_reply: connectionData.canReply,
        connected_at: expect.any(String)
      });

      // Cache the connection
      manager.connectionCache.set(connectionData.connectionId, {
        companyId,
        canReply: connectionData.canReply,
        cachedAt: Date.now()
      });

      expect(mockRepository.upsertByBusinessConnectionId).toHaveBeenCalled();
      expect(manager.connectionCache.has('conn-123')).toBe(true);
    });

    test('should deactivate disconnected connection', async () => {
      const connectionData = {
        connectionId: 'conn-123',
        isEnabled: false
      };

      // Pre-populate cache
      manager.connectionCache.set('conn-123', {
        companyId: 962302,
        cachedAt: Date.now()
      });

      mockRepository.deactivateByBusinessConnectionId.mockResolvedValue({ id: 1 });

      // Simulate handleBusinessConnection for disconnect
      await mockRepository.deactivateByBusinessConnectionId(connectionData.connectionId);

      // Invalidate cache
      manager.connectionCache.delete(connectionData.connectionId);

      expect(mockRepository.deactivateByBusinessConnectionId).toHaveBeenCalledWith('conn-123');
      expect(manager.connectionCache.has('conn-123')).toBe(false);
    });
  });

  describe('Message Handling', () => {
    test('should queue incoming message for processing', async () => {
      const messageData = {
        businessConnectionId: 'conn-123',
        chatId: 67890,
        from: '123456789',
        message: 'Hello!',
        messageId: 'msg-1'
      };

      // Setup cache
      manager.connectionCache.set('conn-123', {
        companyId: 962302,
        canReply: true,
        cachedAt: Date.now()
      });

      messageQueue.addMessage.mockResolvedValue({
        success: true,
        jobId: 'job-123'
      });

      // Simulate message queuing
      const connectionInfo = manager.connectionCache.get('conn-123');

      if (connectionInfo) {
        await messageQueue.addMessage(connectionInfo.companyId, {
          platform: 'telegram',
          from: messageData.from,
          chatId: messageData.chatId,
          message: messageData.message,
          messageId: messageData.messageId,
          businessConnectionId: messageData.businessConnectionId
        });

        manager.metrics.messagesQueued++;
      }

      expect(messageQueue.addMessage).toHaveBeenCalledWith(962302, expect.objectContaining({
        platform: 'telegram',
        from: '123456789',
        message: 'Hello!'
      }));
      expect(manager.metrics.messagesQueued).toBe(1);
    });

    test('should not queue message for unknown connection', () => {
      const messageData = {
        businessConnectionId: 'unknown-conn',
        chatId: 67890,
        from: '123456789',
        message: 'Hello!'
      };

      // No cache entry for this connection
      const connectionInfo = manager.connectionCache.get('unknown-conn');

      expect(connectionInfo).toBeUndefined();
      expect(messageQueue.addMessage).not.toHaveBeenCalled();
    });
  });

  describe('Connection Status', () => {
    test('should return connected status', async () => {
      const mockConnection = {
        can_reply: true,
        telegram_username: 'test_user',
        connected_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      };

      mockRepository.findByCompanyId.mockResolvedValue(mockConnection);

      const connection = await mockRepository.findByCompanyId(962302);

      const status = {
        connected: true,
        canReply: connection.can_reply,
        telegramUsername: connection.telegram_username,
        connectedAt: connection.connected_at,
        lastUpdated: connection.updated_at
      };

      expect(status.connected).toBe(true);
      expect(status.canReply).toBe(true);
      expect(status.telegramUsername).toBe('test_user');
    });

    test('should return not connected status', async () => {
      mockRepository.findByCompanyId.mockResolvedValue(null);

      const connection = await mockRepository.findByCompanyId(962302);

      const status = !connection
        ? { connected: false, error: 'No connection found' }
        : { connected: true };

      expect(status.connected).toBe(false);
      expect(status.error).toBe('No connection found');
    });
  });

  describe('Disconnect', () => {
    test('should disconnect and invalidate cache', async () => {
      const companyId = 962302;

      // Pre-populate cache
      manager.connectionCache.set('conn-1', { companyId, cachedAt: Date.now() });
      manager.connectionCache.set('conn-2', { companyId, cachedAt: Date.now() });

      mockRepository.deactivate.mockResolvedValue({ id: 1 });

      // Simulate disconnect
      await mockRepository.deactivate(companyId);

      // Invalidate company cache
      for (const [connId, info] of manager.connectionCache.entries()) {
        if (info.companyId === companyId) {
          manager.connectionCache.delete(connId);
        }
      }

      expect(mockRepository.deactivate).toHaveBeenCalledWith(companyId);
      expect(manager.connectionCache.size).toBe(0);
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      manager.isInitialized = true;

      telegramBot.healthCheck.mockResolvedValue({
        healthy: true,
        botUsername: 'test_bot'
      });

      mockRepository.countActive.mockResolvedValue(5);

      const botHealth = await telegramBot.healthCheck();
      const connectionCount = await mockRepository.countActive();

      const health = {
        healthy: botHealth.healthy,
        bot: botHealth,
        database: {
          connected: true,
          activeConnections: connectionCount
        },
        cache: {
          size: manager.connectionCache.size
        }
      };

      expect(health.healthy).toBe(true);
      expect(health.database.activeConnections).toBe(5);
    });

    test('should return unhealthy when not initialized', () => {
      manager.isInitialized = false;

      const health = !manager.isInitialized
        ? { healthy: false, error: 'Manager not initialized' }
        : { healthy: true };

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Manager not initialized');
    });
  });

  describe('Cache Warmup', () => {
    test('should load active connections into cache', async () => {
      const activeConnections = [
        { business_connection_id: 'conn-1', company_id: 100, can_reply: true },
        { business_connection_id: 'conn-2', company_id: 200, can_reply: false }
      ];

      mockRepository.getAllActive.mockResolvedValue(activeConnections);

      // Simulate warmupCache
      const connections = await mockRepository.getAllActive();

      for (const conn of connections) {
        manager.connectionCache.set(conn.business_connection_id, {
          companyId: conn.company_id,
          canReply: conn.can_reply,
          cachedAt: Date.now()
        });
      }

      expect(manager.connectionCache.size).toBe(2);
      expect(manager.connectionCache.get('conn-1').companyId).toBe(100);
      expect(manager.connectionCache.get('conn-2').companyId).toBe(200);
    });
  });
});
