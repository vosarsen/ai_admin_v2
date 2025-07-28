// src/api/routes/yclients-integration.js
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const config = require('../../config');
const { supabase } = require('../../database/supabase');

/**
 * YClients Webhook endpoint
 * Получает уведомления от YClients о событиях (новые записи, изменения и т.д.)
 */
router.post('/webhook/yclients', async (req, res) => {
  try {
    logger.info('YClients webhook received:', {
      headers: req.headers,
      body: req.body
    });

    // Проверяем подпись запроса (если YClients присылает)
    // const signature = req.headers['x-yclients-signature'];
    // TODO: Implement signature validation

    const { event, data } = req.body;

    // Обрабатываем разные типы событий
    switch (event) {
      case 'record.created':
        // Новая запись создана через YClients
        logger.info('New booking created in YClients:', data);
        // TODO: Синхронизировать с нашей БД
        break;

      case 'record.updated':
        // Запись изменена
        logger.info('Booking updated in YClients:', data);
        // TODO: Обновить в нашей БД
        break;

      case 'record.deleted':
        // Запись удалена
        logger.info('Booking deleted in YClients:', data);
        // TODO: Обновить статус в нашей БД
        break;

      default:
        logger.warn('Unknown YClients event:', event);
    }

    // Всегда отвечаем 200 OK
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('YClients webhook error:', error);
    // YClients ожидает 200 OK, иначе будет повторять запрос
    res.status(200).json({ success: false, error: error.message });
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
      redirect: '/auth/yclients/redirect'
    },
    message: 'YClients integration endpoints are ready'
  });
});

module.exports = router;