// src/api/index.js
const express = require('express');
const config = require('../config');
const logger = require('../utils/logger');
const messageQueue = require('../queue/message-queue');
const whatsappClient = require('../integrations/whatsapp/client');
const { validateWebhookSignature, validateApiKey } = require('../middlewares/webhook-auth');
const { rateLimiters } = require('../middlewares/rate-limiter');
const circuitBreakerFactory = require('../utils/circuit-breaker');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check (with relaxed rate limit)
app.get('/health', rateLimiters.health, async (req, res) => {
  try {
    // Check critical services
    const whatsappStatus = await whatsappClient.checkStatus();
    const queueMetrics = await messageQueue.getMetrics(config.queue.messageQueue);
    
    const healthy = whatsappStatus.connected && queueMetrics !== null;
    
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        whatsapp: whatsappStatus.connected ? 'connected' : 'disconnected',
        redis: queueMetrics !== null ? 'connected' : 'disconnected'
      },
      queue: queueMetrics
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// WhatsApp webhook (with signature validation and rate limiting)
app.post('/webhook/whatsapp', rateLimiters.webhook, validateWebhookSignature, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Extract message data
    const { from, message, timestamp } = req.body;
    
    if (!from || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: from, message'
      });
    }

    // Extract company ID from phone or use default
    const companyId = config.yclients.companyId;
    
    // Add to queue for async processing
    const result = await messageQueue.addMessage(companyId, {
      from,
      message,
      timestamp: timestamp || new Date().toISOString()
    });

    logger.info(`📨 Webhook received message from ${from}, queued as ${result.jobId}`);
    
    // Return immediately
    res.json({
      success: true,
      queued: result.success,
      jobId: result.jobId,
      processingTime: Date.now() - startTime
    });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Manual message send (for testing, with API key auth and strict rate limit)
app.post('/api/send-message', rateLimiters.sendMessage, validateApiKey, async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, message'
      });
    }

    const result = await whatsappClient.sendMessage(to, message);
    
    res.json(result);
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Queue metrics (with API rate limit)
app.get('/api/metrics', rateLimiters.api, async (req, res) => {
  try {
    const companyId = req.query.companyId || config.yclients.companyId;
    const queueName = `company:${companyId}:messages`;
    
    const metrics = await messageQueue.getMetrics(queueName);
    
    res.json({
      success: true,
      queue: queueName,
      metrics
    });
  } catch (error) {
    logger.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Circuit breaker status
app.get('/api/circuit-breakers', rateLimiters.api, (req, res) => {
  try {
    const status = circuitBreakerFactory.getAllStatus();
    res.json({
      success: true,
      circuitBreakers: status
    });
  } catch (error) {
    logger.error('Circuit breaker status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

module.exports = app;