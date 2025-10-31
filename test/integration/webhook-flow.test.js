// test/integration/webhook-flow.test.js
const request = require('supertest');
const app = require('../../src/api');
const messageQueue = require('../../src/queue/message-queue');
const whatsappClient = require('../../src/integrations/whatsapp/client');
const config = require('../../src/config');
const crypto = require('crypto');

// Mock внешние зависимости
jest.mock('../../src/queue/message-queue');
jest.mock('../../src/integrations/whatsapp/client');
jest.mock('../../src/database/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    single: jest.fn().mockResolvedValue({ 
      data: { 
        id: 1, 
        name: 'Test Company',
        settings: {}
      } 
    })
  }
}));

describe('Webhook Flow Integration Tests', () => {
  let server;

  beforeAll(() => {
    server = app.listen(0); // Random port
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /webhook/whatsapp', () => {
    const webhookData = {
      from: '79001234567@c.us',
      message: 'Хочу записаться на стрижку',
      timestamp: new Date().toISOString()
    };

    const generateSignature = (payload) => {
      return 'sha256=' + crypto
        .createHmac('sha256', config.webhooks.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    };

    it('should accept valid webhook with correct signature', async () => {
      messageQueue.addMessage.mockResolvedValue({
        success: true,
        jobId: 'job-123'
      });

      const response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(webhookData))
        .send(webhookData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        queued: true,
        jobId: 'job-123'
      });

      expect(messageQueue.addMessage).toHaveBeenCalledWith(
        config.yclients.companyId,
        expect.objectContaining({
          from: webhookData.from,
          message: webhookData.message,
          timestamp: webhookData.timestamp
        })
      );
    });

    it('should reject webhook with invalid signature', async () => {
      const response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', 'invalid-signature')
        .send(webhookData);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid signature'
      });

      expect(messageQueue.addMessage).not.toHaveBeenCalled();
    });

    it('should reject webhook without required fields', async () => {
      const invalidData = { from: '79001234567@c.us' }; // missing message

      const response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(invalidData))
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Missing required fields: from, message'
      });
    });

    it('should handle queue errors gracefully', async () => {
      messageQueue.addMessage.mockRejectedValue(new Error('Queue unavailable'));

      const response = await request(server)
        .post('/webhook/whatsapp')
        .set('X-Hub-Signature', generateSignature(webhookData))
        .send(webhookData);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Internal server error'
      });
    });
  });

  describe('POST /webhook/whatsapp/batched', () => {
    const batchedData = {
      messages: [
        {
          id: 'msg1',
          from: '79001234567@c.us',
          body: 'Привет',
          type: 'chat',
          timestamp: Date.now() - 2000
        },
        {
          id: 'msg2',
          from: '79001234567@c.us',
          body: 'Хочу записаться',
          type: 'chat',
          timestamp: Date.now()
        }
      ]
    };

    it('should process batched messages', async () => {
      messageQueue.addMessage.mockResolvedValue({
        success: true,
        jobId: 'job-batch-123'
      });

      const response = await request(server)
        .post('/webhook/whatsapp/batched')
        .set('X-Hub-Signature', generateSignature(batchedData))
        .send(batchedData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        processed: 1,
        combinedMessage: 'Привет\nХочу записаться'
      });

      expect(messageQueue.addMessage).toHaveBeenCalledTimes(1);
      expect(messageQueue.addMessage).toHaveBeenCalledWith(
        config.yclients.companyId,
        expect.objectContaining({
          from: '79001234567',
          message: 'Привет\nХочу записаться',
          isBatched: true,
          originalCount: 2
        })
      );
    });
  });

  describe('GET /health', () => {
    it('should return healthy status when all services are up', async () => {
      whatsappClient.checkStatus.mockResolvedValue({ connected: true });
      messageQueue.getMetrics.mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100
      });

      const response = await request(server)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        services: {
          whatsapp: 'connected',
          redis: 'connected'
        },
        queue: {
          waiting: 5,
          active: 2,
          completed: 100
        }
      });
    });

    it('should return unhealthy when whatsapp is disconnected', async () => {
      whatsappClient.checkStatus.mockResolvedValue({ connected: false });
      messageQueue.getMetrics.mockResolvedValue(null);

      const response = await request(server)
        .get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        status: 'unhealthy',
        services: {
          whatsapp: 'disconnected',
          redis: 'disconnected'
        }
      });
    });
  });

  describe('POST /api/send-message', () => {
    it('should send message with valid API key', async () => {
      whatsappClient.sendMessage.mockResolvedValue({
        success: true,
        messageId: 'msg-sent-123'
      });

      const response = await request(server)
        .post('/api/send-message')
        .set('X-API-Key', config.api.key)
        .send({
          to: '79001234567',
          message: 'Тестовое сообщение'
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        messageId: 'msg-sent-123'
      });

      expect(whatsappClient.sendMessage).toHaveBeenCalledWith(
        '79001234567',
        'Тестовое сообщение'
      );
    });

    it('should reject request without API key', async () => {
      const response = await request(server)
        .post('/api/send-message')
        .send({
          to: '79001234567',
          message: 'Test'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Missing API key'
      });
    });

    it('should reject request with invalid API key', async () => {
      const response = await request(server)
        .post('/api/send-message')
        .set('X-API-Key', 'invalid-key')
        .send({
          to: '79001234567',
          message: 'Test'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid API key'
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = [];
      
      // Делаем много запросов подряд
      for (let i = 0; i < 35; i++) {
        requests.push(
          request(server)
            .get('/health')
            .then(res => res.status)
        );
      }

      const statuses = await Promise.all(requests);
      
      // Первые 30 должны пройти (лимит по умолчанию)
      const successCount = statuses.filter(s => s === 200).length;
      const rateLimitedCount = statuses.filter(s => s === 429).length;

      expect(successCount).toBeGreaterThan(0);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });
});