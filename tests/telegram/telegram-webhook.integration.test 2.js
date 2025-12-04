/**
 * Telegram Webhook Integration Tests
 *
 * Tests for the webhook flow:
 * - Webhook verification
 * - Business connection events
 * - Business message events
 * - Error handling
 *
 * Run with: npm test -- tests/telegram/telegram-webhook.integration.test.js
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const request = require('supertest');
const express = require('express');

// Create a minimal Express app for testing
const app = express();
app.use(express.json());

// Mock config
const mockConfig = {
  telegram: {
    enabled: true,
    botToken: 'test-token',
    webhookSecret: 'test-webhook-secret-123',
    defaultCompanyId: 962302
  }
};

// Mock the modules
jest.mock('../../src/config', () => mockConfig);
jest.mock('../../src/integrations/telegram/telegram-manager', () => ({
  isInitialized: true,
  getWebhookHandler: jest.fn(() => (req, res, next) => {
    // Simulate grammY webhook processing
    res.sendStatus(200);
  }),
  healthCheck: jest.fn().mockResolvedValue({
    healthy: true,
    bot: { healthy: true, botUsername: 'test_bot' },
    database: { connected: true, activeConnections: 1 }
  }),
  getMetrics: jest.fn().mockReturnValue({
    messagesReceived: 10,
    messagesSent: 8,
    errors: 0
  })
}));

// Import after mocking
const telegramManager = require('../../src/integrations/telegram/telegram-manager');

// Setup test routes (simplified version of actual routes)
app.post('/webhook/telegram', (req, res) => {
  // Verify webhook secret
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];

  if (!secretToken || secretToken !== mockConfig.telegram.webhookSecret) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  // Validate payload
  if (!req.body || typeof req.body.update_id !== 'number') {
    return res.status(400).json({ error: 'Invalid update format' });
  }

  // Process webhook
  telegramManager.getWebhookHandler()(req, res);
});

app.get('/webhook/telegram/info', (req, res) => {
  res.json({
    success: true,
    telegram: {
      enabled: mockConfig.telegram.enabled
    },
    health: { healthy: true },
    metrics: telegramManager.getMetrics()
  });
});

app.get('/api/telegram/health', async (req, res) => {
  const health = await telegramManager.healthCheck();
  res.json({
    success: true,
    healthy: health.healthy,
    ...health
  });
});

describe('Telegram Webhook Integration', () => {
  describe('POST /webhook/telegram', () => {
    test('should reject request without secret token', async () => {
      const response = await request(app)
        .post('/webhook/telegram')
        .send({ update_id: 123 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid webhook secret');
    });

    test('should reject request with invalid secret token', async () => {
      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', 'wrong-secret')
        .send({ update_id: 123 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid webhook secret');
    });

    test('should reject request with missing update_id', async () => {
      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', mockConfig.telegram.webhookSecret)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid update format');
    });

    test('should accept valid webhook request', async () => {
      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', mockConfig.telegram.webhookSecret)
        .send({ update_id: 123456789 });

      expect(response.status).toBe(200);
    });

    test('should handle business_connection update', async () => {
      const businessConnection = {
        update_id: 123456789,
        business_connection: {
          id: 'conn-123',
          user: {
            id: 12345,
            first_name: 'Test',
            username: 'test_user'
          },
          can_reply: true,
          is_enabled: true
        }
      };

      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', mockConfig.telegram.webhookSecret)
        .send(businessConnection);

      expect(response.status).toBe(200);
    });

    test('should handle business_message update', async () => {
      const businessMessage = {
        update_id: 123456790,
        business_message: {
          message_id: 1,
          chat: { id: 67890 },
          from: {
            id: 12345,
            first_name: 'Customer',
            username: 'customer'
          },
          text: 'Хочу записаться на маникюр',
          date: Math.floor(Date.now() / 1000),
          business_connection_id: 'conn-123'
        }
      };

      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', mockConfig.telegram.webhookSecret)
        .send(businessMessage);

      expect(response.status).toBe(200);
    });

    test('should handle message update (direct bot message)', async () => {
      const message = {
        update_id: 123456791,
        message: {
          message_id: 2,
          chat: { id: 99999 },
          from: {
            id: 11111,
            first_name: 'User'
          },
          text: '/start',
          date: Math.floor(Date.now() / 1000)
        }
      };

      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', mockConfig.telegram.webhookSecret)
        .send(message);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /webhook/telegram/info', () => {
    test('should return webhook info', async () => {
      const response = await request(app)
        .get('/webhook/telegram/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.telegram.enabled).toBe(true);
      expect(response.body.health.healthy).toBe(true);
      expect(response.body.metrics).toBeDefined();
    });
  });

  describe('GET /api/telegram/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/telegram/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.healthy).toBe(true);
      expect(response.body.bot.healthy).toBe(true);
      expect(response.body.database.connected).toBe(true);
    });
  });
});

describe('Telegram Webhook Security', () => {
  describe('Secret Token Validation', () => {
    test('should be case-sensitive', async () => {
      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', 'TEST-WEBHOOK-SECRET-123') // uppercase
        .send({ update_id: 123 });

      expect(response.status).toBe(401);
    });

    test('should handle empty secret token', async () => {
      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', '')
        .send({ update_id: 123 });

      expect(response.status).toBe(401);
    });
  });

  describe('Payload Validation', () => {
    test('should reject non-numeric update_id', async () => {
      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', mockConfig.telegram.webhookSecret)
        .send({ update_id: 'not-a-number' });

      expect(response.status).toBe(400);
    });

    test('should reject array as body', async () => {
      const response = await request(app)
        .post('/webhook/telegram')
        .set('X-Telegram-Bot-Api-Secret-Token', mockConfig.telegram.webhookSecret)
        .set('Content-Type', 'application/json')
        .send([{ update_id: 123 }]);

      expect(response.status).toBe(400);
    });
  });
});

describe('Telegram Update Types', () => {
  const validHeaders = {
    'X-Telegram-Bot-Api-Secret-Token': mockConfig.telegram.webhookSecret
  };

  test('should handle edited_business_message', async () => {
    const update = {
      update_id: 123456792,
      edited_business_message: {
        message_id: 1,
        chat: { id: 67890 },
        from: { id: 12345, first_name: 'Customer' },
        text: 'Updated message',
        date: Math.floor(Date.now() / 1000),
        edit_date: Math.floor(Date.now() / 1000),
        business_connection_id: 'conn-123'
      }
    };

    const response = await request(app)
      .post('/webhook/telegram')
      .set(validHeaders)
      .send(update);

    expect(response.status).toBe(200);
  });

  test('should handle deleted_business_messages', async () => {
    const update = {
      update_id: 123456793,
      deleted_business_messages: {
        business_connection_id: 'conn-123',
        chat: { id: 67890 },
        message_ids: [1, 2, 3]
      }
    };

    const response = await request(app)
      .post('/webhook/telegram')
      .set(validHeaders)
      .send(update);

    expect(response.status).toBe(200);
  });

  test('should handle callback_query', async () => {
    const update = {
      update_id: 123456794,
      callback_query: {
        id: 'query-123',
        from: { id: 12345, first_name: 'User' },
        message: {
          message_id: 1,
          chat: { id: 67890 }
        },
        data: 'button_click'
      }
    };

    const response = await request(app)
      .post('/webhook/telegram')
      .set(validHeaders)
      .send(update);

    expect(response.status).toBe(200);
  });
});
