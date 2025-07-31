// src/api/routes/yclients-integration.js
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const config = require('../../config');
const { supabase } = require('../../database/supabase');
const YClientsWebhookProcessor = require('../../services/webhook-processor');

// Инициализация процессора webhook
const webhookProcessor = new YClientsWebhookProcessor();

/**
 * YClients Webhook endpoint
 * Получает уведомления от YClients о событиях (новые записи, изменения и т.д.)
 */
router.post('/webhook/yclients', async (req, res) => {
  const startTime = Date.now();
  const eventId = req.headers['x-event-id'] || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('📨 YClients webhook received:', {
      eventId,
      eventType: req.body?.event,
      headers: req.headers,
      body: req.body
    });

    // Быстро отвечаем YClients, чтобы избежать повторов
    res.status(200).json({ success: true, eventId });

    // Проверяем дубликаты
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      logger.warn('⚠️ Duplicate webhook event', { eventId });
      return;
    }

    // Сохраняем событие для аудита
    const { error: saveError } = await supabase
      .from('webhook_events')
      .insert({
        event_id: eventId,
        event_type: req.body.event,
        company_id: req.body.data?.company_id || req.body.company_id,
        record_id: req.body.data?.id,
        payload: req.body,
        created_at: new Date().toISOString()
      });

    if (saveError) {
      logger.error('❌ Failed to save webhook event', { eventId, error: saveError });
    }

    // Обрабатываем событие
    await webhookProcessor.processEvent({
      id: eventId,
      type: req.body.event,
      companyId: req.body.data?.company_id || req.body.company_id,
      data: req.body.data,
      timestamp: req.body.created_at || new Date().toISOString()
    });

    const processingTime = Date.now() - startTime;
    logger.info('✅ Webhook processed successfully', {
      eventId,
      processingTime,
      eventType: req.body.event
    });

  } catch (error) {
    logger.error('❌ YClients webhook error:', {
      eventId,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * YClients Callback endpoint
 * Используется для OAuth авторизации при подключении интеграции
 */
router.get('/callback/yclients', async (req, res) => {
  try {
    logger.info('YClients callback received:', {
      query: req.query,
      headers: req.headers
    });

    const { code, state, company_id } = req.query;

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    // TODO: Обменять code на access token через YClients API
    // const tokenResponse = await exchangeCodeForToken(code);

    // Сохраняем токен и информацию о компании
    if (company_id) {
      // TODO: Сохранить в БД
      logger.info('Saving YClients integration for company:', company_id);
    }

    // Перенаправляем на страницу успеха
    res.redirect('/integration-success.html');
  } catch (error) {
    logger.error('YClients callback error:', error);
    res.redirect('/integration-error.html');
  }
});

/**
 * YClients Registration Redirect endpoint
 * Куда YClients перенаправит после регистрации пользователя
 */
router.get('/auth/yclients/redirect', async (req, res) => {
  try {
    logger.info('YClients registration redirect:', {
      query: req.query,
      headers: req.headers
    });

    const { user_id, company_id, phone, email } = req.query;

    if (!company_id) {
      return res.status(400).send('Missing company_id');
    }

    // Создаем или обновляем информацию о компании
    const { data: company, error } = await supabase
      .from('companies')
      .upsert({
        yclients_id: parseInt(company_id),
        phone,
        email,
        integration_status: 'pending',
        created_at: new Date().toISOString()
      }, {
        onConflict: 'yclients_id'
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to save company:', error);
      return res.redirect('/registration-error.html');
    }

    logger.info('Company registered:', company);

    // Перенаправляем на страницу с инструкциями
    res.redirect(`/setup-instructions.html?company_id=${company_id}`);
  } catch (error) {
    logger.error('Registration redirect error:', error);
    res.redirect('/registration-error.html');
  }
});

/**
 * Тестовый endpoint для проверки работоспособности
 */
router.get('/yclients/test', (req, res) => {
  res.json({
    status: 'ok',
    endpoints: {
      webhook: '/webhook/yclients',
      callback: '/callback/yclients',
      redirect: '/auth/yclients/redirect',
      testWebhook: '/webhook/yclients/test'
    },
    message: 'YClients integration endpoints are ready'
  });
});

/**
 * Тестовый endpoint для эмуляции webhook событий
 */
router.post('/webhook/yclients/test', async (req, res) => {
  try {
    const { eventType = 'record.created', phone = '79001234567', ...customData } = req.body;
    
    // Создаем тестовое событие
    const testEvent = {
      event: eventType,
      data: {
        id: Math.floor(Math.random() * 100000),
        company_id: config.yclients?.companyId || 962302,
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Завтра
        services: [
          {
            id: 1,
            title: customData.service || 'Тестовая стрижка',
            cost: customData.cost || 1500
          }
        ],
        staff: {
          id: 1,
          name: customData.master || 'Мастер Тест'
        },
        client: {
          id: 1,
          name: customData.clientName || 'Тестовый Клиент',
          phone: phone
        },
        comment: customData.comment || 'Тестовая запись для проверки webhook',
        ...customData
      },
      created_at: new Date().toISOString()
    };
    
    logger.info('🧪 Simulating webhook event', testEvent);
    
    // Вызываем обработчик webhook
    const eventId = `test_${Date.now()}`;
    await webhookProcessor.processEvent({
      id: eventId,
      type: testEvent.event,
      companyId: testEvent.data.company_id,
      data: testEvent.data,
      timestamp: testEvent.created_at
    });
    
    res.json({
      success: true,
      message: 'Test webhook processed',
      eventId,
      testEvent
    });
    
  } catch (error) {
    logger.error('❌ Test webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;