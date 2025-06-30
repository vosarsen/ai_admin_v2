// src/__tests__/middlewares/webhook-auth.test.js
const crypto = require('crypto');
const { validateWebhookSignature, validateApiKey } = require('../../middlewares/webhook-auth');
const config = require('../../config');

describe('Webhook Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      method: 'POST',
      originalUrl: '/webhook/whatsapp',
      body: { test: 'data' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('validateWebhookSignature', () => {
    const secretKey = 'test-secret-key';

    beforeEach(() => {
      config.whatsapp.secretKey = secretKey;
    });

    it('should call next if no secret key configured', () => {
      config.whatsapp.secretKey = null;
      validateWebhookSignature(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject missing signature', () => {
      req.headers['x-timestamp'] = Date.now().toString();
      validateWebhookSignature(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing authentication headers'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject missing timestamp', () => {
      req.headers['x-signature'] = 'some-signature';
      validateWebhookSignature(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = Date.now() - 360000; // 6 minutes ago
      req.headers['x-timestamp'] = oldTimestamp.toString();
      req.headers['x-signature'] = 'some-signature';
      
      validateWebhookSignature(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Request timestamp too old'
      });
    });

    it('should reject invalid signature', () => {
      const timestamp = Date.now();
      req.headers['x-timestamp'] = timestamp.toString();
      req.headers['x-signature'] = 'invalid-signature';
      
      validateWebhookSignature(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid signature'
      });
    });

    it('should accept valid signature', () => {
      const timestamp = Date.now();
      const body = JSON.stringify(req.body);
      const payload = `POST:/webhook/whatsapp:${timestamp}:${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payload)
        .digest('hex');
      
      req.headers['x-timestamp'] = timestamp.toString();
      req.headers['x-signature'] = expectedSignature;
      
      validateWebhookSignature(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.webhookTimestamp).toBe(timestamp);
    });
  });

  describe('validateApiKey', () => {
    const apiKey = 'test-api-key';

    beforeEach(() => {
      config.whatsapp.apiKey = apiKey;
    });

    it('should call next if no API key configured', () => {
      config.whatsapp.apiKey = null;
      validateApiKey(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject missing API key', () => {
      validateApiKey(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid API key'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid API key', () => {
      req.headers['x-api-key'] = 'wrong-key';
      validateApiKey(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should accept valid API key', () => {
      req.headers['x-api-key'] = apiKey;
      validateApiKey(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});