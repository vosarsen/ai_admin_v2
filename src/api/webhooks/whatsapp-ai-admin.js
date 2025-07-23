// src/api/webhooks/whatsapp-ai-admin.js
const express = require('express');
const router = express.Router();
const config = require('../../config');
const logger = require('../../utils/logger');
const messageQueue = require('../../queue/message-queue');
const rapidFireProtection = require('../../services/rapid-fire-protection');
const { validateWebhookSignature } = require('../../middlewares/webhook-auth');
const rateLimiter = require('../../middlewares/rate-limiter');

/**
 * WhatsApp webhook для AI Admin v2 с правильной реализацией rapid-fire protection
 * 
 * Rapid-fire protection применяется ДО создания jobs в очереди,
 * что позволяет объединять несколько сообщений в одно
 */
router.post('/webhook/whatsapp/ai-admin', rateLimiter, validateWebhookSignature, async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Поддержка разных форматов входных данных
    let messages = [];
    let from = null;
    let companyId = config.yclients.companyId;
    
    // Формат 1: { from, message, timestamp }
    if (req.body.from && req.body.message) {
      messages = [{
        from: req.body.from,
        body: req.body.message,
        type: 'chat',
        timestamp: req.body.timestamp || new Date().toISOString()
      }];
      from = req.body.from;
    }
    // Формат 2: { messages: [...], companyId }
    else if (req.body.messages && Array.isArray(req.body.messages)) {
      messages = req.body.messages;
      from = messages[0]?.from;
      companyId = req.body.companyId || config.yclients.companyId;
    }
    else {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format'
      });
    }
    
    if (!from || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Обрабатываем каждое сообщение через rapid-fire protection
    // но НЕ создаем job сразу
    let jobId = null;
    let processedCount = 0;
    
    for (const message of messages) {
      const msgText = message.body || message.message || '';
      const msgFrom = message.from || from;
      
      // Применяем rapid-fire protection
      await new Promise((resolve) => {
        rapidFireProtection.processMessage(msgFrom, msgText, async (combinedMessage, metadata = {}) => {
          try {
            // Создаем job только когда rapid-fire protection решил обработать
            const result = await messageQueue.addMessage(companyId, {
              from: msgFrom,
              message: combinedMessage,
              timestamp: message.timestamp || new Date().toISOString(),
              metadata: {
                ...metadata,
                originalMessages: metadata.originalMessages || [msgText]
              }
            });
            
            if (!jobId) jobId = result.jobId;
            processedCount++;
            
            logger.info(`📨 Webhook processed message from ${msgFrom}`, {
              jobId: result.jobId,
              isRapidFireBatch: metadata.isRapidFireBatch,
              originalMessagesCount: metadata.originalMessagesCount || 1,
              combinedMessage: combinedMessage.substring(0, 100)
            });
            
            resolve();
          } catch (error) {
            logger.error('Error processing message in rapid-fire callback:', error);
            resolve();
          }
        });
      });
    }
    
    // Ответ webhook'у
    res.json({
      success: true,
      message: 'Messages queued for processing',
      jobId: jobId,
      processedCount: processedCount,
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

module.exports = router;