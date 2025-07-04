// src/middlewares/webhook-auth.js
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware for webhook signature validation
 */
function validateWebhookSignature(req, res, next) {
  // Skip validation if no secret configured
  if (!config.whatsapp.secretKey) {
    logger.warn('Webhook signature validation skipped - VENOM_SECRET_KEY not configured');
    return next();
  }

  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  
  // Check required headers
  if (!signature || !timestamp) {
    logger.error('Webhook validation failed: missing signature or timestamp headers');
    return res.status(401).json({ 
      success: false, 
      error: 'Missing authentication headers' 
    });
  }
  
  // Check timestamp freshness (5 minutes)
  const currentTime = Date.now();
  const requestTime = parseInt(timestamp);
  const timeDiff = Math.abs(currentTime - requestTime);
  
  if (timeDiff > 300000) { // 5 minutes
    logger.error('Webhook validation failed: timestamp too old', { timeDiff });
    return res.status(401).json({ 
      success: false, 
      error: 'Request timestamp too old' 
    });
  }
  
  // Calculate expected signature
  const method = req.method.toUpperCase();
  const path = req.originalUrl;
  const body = JSON.stringify(req.body);
  const payload = `${method}:${path}:${timestamp}:${body}`;
  
  const expectedSignature = crypto
    .createHmac('sha256', config.whatsapp.secretKey)
    .update(payload)
    .digest('hex');
  
  // Debug logging for signature comparison
  logger.debug('🔐 Signature validation debug:', {
    method,
    path,
    timestamp,
    payloadLength: payload.length,
    receivedSignature: signature.substring(0, 10) + '...',
    expectedSignature: expectedSignature.substring(0, 10) + '...',
    secretKeyLength: config.whatsapp.secretKey ? config.whatsapp.secretKey.length : 'not set'
  });
  
  // Compare signatures (ensure same length for timingSafeEqual)
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  
  // Check length first
  if (signatureBuffer.length !== expectedBuffer.length) {
    logger.error('Webhook validation failed: invalid signature length');
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid signature' 
    });
  }
  
  // Compare signatures
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    logger.error('Webhook validation failed: invalid signature');
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid signature' 
    });
  }
  
  // Store validated timestamp to prevent replay attacks
  req.webhookTimestamp = requestTime;
  next();
}

/**
 * Middleware for API key validation (simpler auth for non-webhook endpoints)
 */
function validateApiKey(req, res, next) {
  // Skip validation if no API key configured
  if (!config.whatsapp.apiKey) {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.whatsapp.apiKey) {
    logger.error('API key validation failed');
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid API key' 
    });
  }
  
  next();
}

module.exports = {
  validateWebhookSignature,
  validateApiKey
};