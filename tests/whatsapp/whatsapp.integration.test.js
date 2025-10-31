/**
 * WhatsApp Integration Tests
 * End-to-end tests for WhatsApp functionality
 */

const request = require('supertest');
const app = require('../../src/api/index');
const { getSessionPool } = require('../../src/integrations/whatsapp/session-pool');

// Only run these tests if explicitly requested
const RUN_INTEGRATION_TESTS = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!RUN_INTEGRATION_TESTS, 'WhatsApp Integration Tests', () => {
  const TEST_COMPANY_ID = process.env.TEST_COMPANY_ID || '962302';
  const TEST_PHONE = process.env.TEST_PHONE || '79001234567';
  const API_KEY = process.env.TEST_API_KEY;

  beforeAll(async () => {
    // Wait for system initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup
    const sessionPool = getSessionPool();
    if (sessionPool) {
      await sessionPool.shutdown();
    }
  });

  describe('Session Management', () => {
    test('GET /webhook/whatsapp/baileys/status/:companyId - should return status', async () => {
      const response = await request(app)
        .get(`/webhook/whatsapp/baileys/status/${TEST_COMPANY_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('status');
    });

    test('POST /api/whatsapp/sessions/:companyId/connect - should initialize session', async () => {
      const response = await request(app)
        .post(`/api/whatsapp/sessions/${TEST_COMPANY_ID}/connect`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({})
        .expect('Content-Type', /json/);

      // May return 200 (already connected) or 201 (connecting)
      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('success', true);
    });

    test('GET /api/whatsapp/sessions/:companyId/health - should check health', async () => {
      const response = await request(app)
        .get(`/api/whatsapp/sessions/${TEST_COMPANY_ID}/health`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect('Content-Type', /json/);

      // May return 200 (healthy) or 503 (unhealthy)
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('companyId', TEST_COMPANY_ID);
    });
  });

  describe('Pairing Code', () => {
    test('POST /api/whatsapp/sessions/:companyId/pairing-code - should handle pairing code request', async () => {
      const response = await request(app)
        .post(`/api/whatsapp/sessions/${TEST_COMPANY_ID}/pairing-code`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ phoneNumber: TEST_PHONE })
        .expect('Content-Type', /json/);

      // May succeed or fail depending on WhatsApp state
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('code');
        expect(response.body).toHaveProperty('expiresIn');
      } else {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Message Sending', () => {
    // Skip message tests if not connected
    const skipIfNotConnected = async () => {
      const response = await request(app)
        .get(`/webhook/whatsapp/baileys/status/${TEST_COMPANY_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`);

      return response.body?.status?.connected !== true;
    };

    test.skipIf(skipIfNotConnected, 'POST /api/whatsapp/sessions/:companyId/send - should send message', async () => {
      const response = await request(app)
        .post(`/api/whatsapp/sessions/${TEST_COMPANY_ID}/send`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          phone: TEST_PHONE,
          message: 'Test message from integration tests',
          options: {}
        })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('messageId');
      } else {
        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Metrics', () => {
    test('GET /api/whatsapp/metrics - should return metrics', async () => {
      const response = await request(app)
        .get('/api/whatsapp/metrics')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('sessions');
    });

    test('GET /api/whatsapp/metrics/:companyId - should return company metrics', async () => {
      const response = await request(app)
        .get(`/api/whatsapp/metrics/${TEST_COMPANY_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('companyId', TEST_COMPANY_ID);
    });
  });

  describe('Error Handling', () => {
    test('Should handle invalid company ID', async () => {
      const response = await request(app)
        .get('/webhook/whatsapp/baileys/status/invalid@id')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('Should handle missing authentication', async () => {
      const response = await request(app)
        .get(`/api/whatsapp/metrics/${TEST_COMPANY_ID}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('Should handle invalid phone number', async () => {
      const response = await request(app)
        .post(`/api/whatsapp/sessions/${TEST_COMPANY_ID}/send`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({
          phone: 'invalid',
          message: 'Test'
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('phone');
    });
  });

  describe('Performance', () => {
    test('Status check should respond quickly', async () => {
      const startTime = Date.now();

      await request(app)
        .get(`/webhook/whatsapp/baileys/status/${TEST_COMPANY_ID}`)
        .set('Authorization', `Bearer ${API_KEY}`);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    test('Metrics should respond quickly', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/whatsapp/metrics')
        .set('Authorization', `Bearer ${API_KEY}`);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should respond within 500ms
    });
  });
});