const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
// Supabase import removed (2025-11-26) - not used in this file
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
  
  logger.info('📨 YClients webhook received', {
    eventId,
    resource: req.body?.resource,
    status: req.body?.status,
    companyId: req.body?.company_id,
    headers: req.headers,
    body: req.body
  });

  try {
    // 1. Быстрый ответ YClients, чтобы избежать повторов
    res.status(200).json({ success: true, eventId });

    // 2. Проверка подписи (если настроена)
    const signature = req.headers['x-webhook-signature'] || req.headers['x-yclients-signature'];
    const secret = config.yclients?.webhookSecret;
    
    if (secret && signature && !verifyWebhookSignature(req.body, signature, secret)) {
      logger.error('❌ Invalid webhook signature', { eventId });
      return;
    }

    // 3. Преобразуем формат YClients в наш формат
    let eventType = 'unknown';
    let eventData = req.body.data || req.body;
    
    // YClients отправляет формат: { resource: "record", status: "create/update/delete" }
    if (req.body.resource === 'record') {
      if (req.body.status === 'create') {
        eventType = 'record.created';
      } else if (req.body.status === 'update') {
        eventType = 'record.updated';
      } else if (req.body.status === 'delete') {
        eventType = 'record.deleted';
      }
    } else if (req.body.resource === 'finances_operation') {
      // Финансовые операции пока игнорируем
      logger.info('💰 Financial operation webhook, skipping', { eventId });
      return;
    } else {
      // Другие типы событий тоже пока игнорируем
      logger.info(`📦 ${req.body.resource} webhook, skipping`, { eventId });
      return;
    }

    // 4. Проверка дубликатов
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      logger.warn('⚠️ Duplicate webhook event', { eventId });
      return;
    }

    // 5. Сохранение события для аудита
    const { error: saveError } = await supabase
      .from('webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType,
        company_id: req.body.company_id,
        record_id: eventData?.id || req.body.resource_id,
        payload: req.body,
        created_at: new Date().toISOString()
      });

    if (saveError) {
      logger.error('❌ Failed to save webhook event', { eventId, error: saveError });
    }

    // 6. Асинхронная обработка события
    await webhookProcessor.processEvent({
      id: eventId,
      type: eventType,
      companyId: req.body.company_id,
      data: eventData,
      timestamp: req.body.created_at || new Date().toISOString()
    });

    const processingTime = Date.now() - startTime;
    logger.info('✅ Webhook processed successfully', {
      eventId,
      processingTime,
      eventType
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
    // Определяем тип события из запроса или используем по умолчанию
    const eventType = req.body.eventType || 'record.created';
    
    // Генерируем случайные ID
    const recordId = Math.floor(Math.random() * 100000) + 1;
    const datetime = req.body.datetime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    // Эмулируем событие создания записи
    const testEvent = {
      id: `test_${Date.now()}`,
      type: eventType,
      companyId: config.yclients?.companyId || 962302,
      data: {
        id: recordId,
        company_id: config.yclients?.companyId || 962302,
        datetime: datetime,
        services: [
          {
            id: 1,
            title: req.body.service || 'Тестовая стрижка',
            cost: req.body.cost || 1500
          }
        ],
        staff: {
          id: 1,
          name: req.body.master || 'Мастер Тест'
        },
        client: {
          id: 1,
          name: req.body.clientName || 'Тестовый Клиент',
          phone: req.body.phone || '79001234567'
        },
        comment: 'Тестовая запись для проверки webhook',
        // Дополнительные поля из запроса
        ...req.body
      },
      timestamp: new Date().toISOString()
    };

    // Обрабатываем событие
    await webhookProcessor.processEvent(testEvent);

    res.json({
      success: true,
      message: 'Test webhook processed',
      eventId: testEvent.id,
      testEvent
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