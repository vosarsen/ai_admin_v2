const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { supabase } = require('../../database/supabase');
const YClientsWebhookProcessor = require('../../services/webhook-processor');
const config = require('../../config');
const crypto = require('crypto');

// Инициализация процессора
const webhookProcessor = new YClientsWebhookProcessor();

/**
 * Проверка подписи webhook от YClients
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!secret) {
    logger.warn('⚠️ Webhook secret not configured, skipping signature verification');
    return true; // В development режиме можем пропустить
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === expectedSignature;
}

/**
 * Основной endpoint для приема webhook событий от YClients
 * POST /api/webhooks/yclients/events
 */
router.post('/events', async (req, res) => {
  const startTime = Date.now();
  const eventId = req.headers['x-event-id'] || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info('📨 Webhook received', {
    eventId,
    eventType: req.body?.event_type,
    companyId: req.body?.company_id,
    headers: req.headers
  });

  try {
    // 1. Быстрый ответ YClients, чтобы избежать повторов
    res.status(200).json({ success: true, eventId });

    // 2. Проверка подписи (если настроена)
    const signature = req.headers['x-webhook-signature'];
    const secret = config.yclients?.webhookSecret;
    
    if (secret && !verifyWebhookSignature(req.body, signature, secret)) {
      logger.error('❌ Invalid webhook signature', { eventId });
      return;
    }

    // 3. Проверка дубликатов
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      logger.warn('⚠️ Duplicate webhook event', { eventId });
      return;
    }

    // 4. Сохранение события для аудита
    const { error: saveError } = await supabase
      .from('webhook_events')
      .insert({
        event_id: eventId,
        event_type: req.body.event_type,
        company_id: req.body.company_id,
        record_id: req.body.record?.id || req.body.data?.id,
        payload: req.body,
        created_at: new Date().toISOString()
      });

    if (saveError) {
      logger.error('❌ Failed to save webhook event', { eventId, error: saveError });
    }

    // 5. Асинхронная обработка события
    await webhookProcessor.processEvent({
      id: eventId,
      type: req.body.event_type,
      companyId: req.body.company_id,
      data: req.body.data || req.body.record,
      timestamp: req.body.created_at || new Date().toISOString()
    });

    const processingTime = Date.now() - startTime;
    logger.info('✅ Webhook processed successfully', {
      eventId,
      processingTime,
      eventType: req.body.event_type
    });

  } catch (error) {
    logger.error('❌ Webhook processing error', {
      eventId,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Health check endpoint для YClients
 * GET /api/webhooks/yclients/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * Test endpoint для проверки webhook
 * POST /api/webhooks/yclients/test
 */
router.post('/test', async (req, res) => {
  logger.info('🧪 Test webhook received', req.body);
  
  try {
    // Эмулируем событие создания записи
    const testEvent = {
      id: `test_${Date.now()}`,
      type: 'record.created',
      companyId: config.yclients?.companyId || 962302,
      data: {
        id: 12345,
        company_id: config.yclients?.companyId || 962302,
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Завтра
        services: [
          {
            id: 1,
            title: 'Тестовая стрижка',
            cost: 1500
          }
        ],
        staff: {
          id: 1,
          name: 'Мастер Тест'
        },
        client: {
          id: 1,
          name: 'Тестовый Клиент',
          phone: req.body.phone || '79001234567'
        },
        comment: 'Тестовая запись через webhook'
      },
      timestamp: new Date().toISOString()
    };

    await webhookProcessor.processEvent(testEvent);

    res.json({
      success: true,
      message: 'Test event processed',
      event: testEvent
    });

  } catch (error) {
    logger.error('❌ Test webhook error', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;