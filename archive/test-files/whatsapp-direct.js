// src/api/webhooks/whatsapp-direct.js
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const messageQueue = require('../../queue/message-queue');
const rateLimiter = require('../../middlewares/rate-limiter');
const { validateWebhookSignature } = require('../../middlewares/webhook-auth');

/**
 * Direct webhook endpoint - обходит batching и отправляет сразу в очередь
 */
router.post('/webhook/whatsapp/direct', rateLimiter, validateWebhookSignature, async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('Direct webhook received', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    const { messages = [], from } = req.body;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'No messages provided',
        code: 'NO_MESSAGES' 
      });
    }

    const processedMessages = [];
    
    for (const message of messages) {
      const msgFrom = message.from || from;
      const msgText = message.body || message.message || '';
      
      if (!msgText || !msgFrom) {
        logger.warn('Skip invalid message', { message });
        continue;
      }

      try {
        // Определяем companyId (пока захардкодим)
        const companyId = '962302';
        
        // Отправляем напрямую в очередь
        await messageQueue.addMessage(companyId, {
          from: msgFrom,
          message: msgText,
          metadata: {
            timestamp: message.timestamp || new Date().toISOString(),
            type: message.type || 'chat',
            originalWebhook: 'whatsapp-direct',
            directProcessing: true
          }
        });
        
        processedMessages.push({
          from: msgFrom,
          text: msgText.substring(0, 50) + '...'
        });
        
        logger.info(`Message queued directly for ${msgFrom}`, {
          preview: msgText.substring(0, 50),
          companyId
        });
        
      } catch (error) {
        logger.error('Failed to queue message:', error);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`📨 Direct webhook processed ${processedMessages.length} messages in ${duration}ms`);
    
    res.json({
      success: true,
      processed: processedMessages.length,
      messages: processedMessages,
      duration
    });
    
  } catch (error) {
    logger.error('Direct webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'WEBHOOK_ERROR' 
    });
  }
});

module.exports = router;