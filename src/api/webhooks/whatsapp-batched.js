// src/api/webhooks/whatsapp-batched.js
const express = require('express');
const router = express.Router();
const config = require('../../config');
const logger = require('../../utils/logger');
const batchService = require('../../services/redis-batch-service');
const { validateWebhookSignature } = require('../../middlewares/webhook-auth');
const rateLimiter = require('../../middlewares/rate-limiter');

/**
 * WhatsApp webhook с Redis-based батчингом
 * 
 * Этот webhook просто добавляет сообщения в Redis.
 * Batch processor обрабатывает их независимо.
 */
router.post('/webhook/whatsapp/batched', rateLimiter, validateWebhookSignature, async (req, res) => {
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
    
    // Добавляем каждое сообщение в батч
    let addedCount = 0;
    
    for (const message of messages) {
      const msgText = message.body || message.message || '';
      const msgFrom = message.from || from;
      
      if (!msgText || !msgFrom) {
        continue;
      }
      
      try {
        // Просто добавляем в Redis батч
        await batchService.addMessage(
          msgFrom,
          msgText,
          companyId,
          {
            timestamp: message.timestamp || new Date().toISOString(),
            type: message.type || 'chat',
            originalWebhook: 'whatsapp-batched'
          }
        );
        
        addedCount++;
        
        logger.debug(`📥 Added message to batch for ${msgFrom}`, {
          preview: msgText.substring(0, 50),
          companyId
        });
        
      } catch (error) {
        logger.error(`Failed to add message to batch for ${msgFrom}:`, error);
        // Продолжаем обработку остальных сообщений
      }
    }
    
    // Быстрый ответ webhook'у
    res.json({
      success: true,
      message: 'Messages added to batch',
      addedCount,
      processingTime: Date.now() - startTime
    });
    
    logger.info(`📨 Webhook processed ${addedCount} messages in ${Date.now() - startTime}ms`);
    
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Эндпоинт для получения статистики батчей
 */
router.get('/webhook/whatsapp/batched/stats', async (req, res) => {
  try {
    const stats = await batchService.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get batch stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Эндпоинт для ручной очистки батча
 */
router.delete('/webhook/whatsapp/batched/:phone', validateWebhookSignature, async (req, res) => {
  try {
    const { phone } = req.params;
    await batchService.clearBatch(phone);
    
    res.json({
      success: true,
      message: `Batch cleared for ${phone}`
    });
  } catch (error) {
    logger.error('Failed to clear batch:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;