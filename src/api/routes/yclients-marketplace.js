// src/api/routes/yclients-marketplace.js
// Routes для интеграции с YClients Marketplace

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { supabase } = require('../../database/supabase');
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');
const { YclientsClient } = require('../../integrations/yclients/client');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');

// Инициализация
const sessionPool = getSessionPool();
const yclientsClient = new YclientsClient();

// ============================
// 1. Registration Redirect URL - /auth/yclients/redirect
// Сюда YClients перенаправляет после нажатия "Подключить"
// ============================
router.get('/auth/yclients/redirect', async (req, res) => {
  try {
    const {
      salon_id,  // ID салона в YClients
      user_id,   // ID пользователя (если передается)
      user_name, // Имя пользователя (если передается)
      user_phone,// Телефон (если передается)
      user_email // Email (если передается)
    } = req.query;

    logger.info('Registration redirect from YClients:', {
      salon_id,
      user_id,
      user_name,
      user_phone,
      user_email
    });

    // Проверяем обязательный параметр
    if (!salon_id) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ошибка подключения</title>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, sans-serif; padding: 40px; text-align: center; }
            .error { color: #e74c3c; }
            .button { background: #3498db; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1 class="error">Ошибка подключения</h1>
          <p>Не получен ID салона от YClients</p>
          <a href="https://yclients.com/marketplace" class="button">Вернуться в маркетплейс</a>
        </body>
        </html>
      `);
    }

    // Получаем информацию о салоне из YClients API
    let salonInfo = null;
    try {
      salonInfo = await yclientsClient.getCompanyInfo(salon_id);
      logger.info('Salon info from YClients:', salonInfo);
    } catch (error) {
      logger.error('Error fetching salon info:', error);
      // Продолжаем даже если не получили инфо - покажем форму
    }

    // Создаем или обновляем запись в БД
    const { data: company, error: dbError } = await supabase
      .from('companies')
      .upsert({
        yclients_id: parseInt(salon_id),
        name: salonInfo?.title || `Салон ${salon_id}`,
        phone: salonInfo?.phone || user_phone || '',
        email: salonInfo?.email || user_email || '',
        address: salonInfo?.address || '',
        integration_status: 'pending_whatsapp',
        marketplace_user_id: user_id,
        marketplace_user_name: user_name,
        marketplace_user_phone: user_phone,
        marketplace_user_email: user_email,
        connected_at: new Date().toISOString()
      }, {
        onConflict: 'yclients_id'
      })
      .select()
      .single();

    if (dbError) {
      logger.error('DB error:', dbError);
      return res.status(500).send('Ошибка сохранения данных');
    }

    // Генерируем JWT токен для безопасной передачи данных
    const token = jwt.sign(
      {
        company_id: company.id,
        salon_id: salon_id,
        user_data: { user_id, user_name, user_phone, user_email }
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '1h' }
    );

    // Перенаправляем на страницу онбординга
    res.redirect(`/marketplace/onboarding?token=${token}`);

  } catch (error) {
    logger.error('Registration redirect error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ошибка</title>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, sans-serif; padding: 40px; text-align: center; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1 class="error">Произошла ошибка</h1>
        <p>${error.message}</p>
        <p>Пожалуйста, попробуйте позже или свяжитесь с поддержкой</p>
      </body>
      </html>
    `);
  }
});

// ============================
// 2. Callback URL - /callback/yclients
// Для webhook событий от YClients
// ============================
router.post('/callback/yclients', async (req, res) => {
  try {
    const {
      event_type,  // Тип события
      salon_id,    // ID салона
      data         // Данные события
    } = req.body;

    logger.info('YClients callback received:', {
      event_type,
      salon_id,
      data_keys: data ? Object.keys(data) : []
    });

    // Проверяем подпись запроса (если YClients поддерживает)
    // const signature = req.headers['x-yclients-signature'];
    // if (!verifySignature(req.body, signature)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    // Обрабатываем разные типы событий
    switch (event_type) {
      case 'uninstall':
        // Приложение удалено из салона
        await handleUninstall(salon_id);
        break;

      case 'freeze':
        // Приложение заморожено
        await handleFreeze(salon_id);
        break;

      case 'payment':
        // Оплата прошла
        await handlePayment(salon_id, data);
        break;

      case 'record_created':
      case 'record_updated':
      case 'record_deleted':
        // События записей - можно использовать для напоминаний
        logger.info(`Record event: ${event_type} for salon ${salon_id}`);
        break;

      default:
        logger.warn(`Unknown event type: ${event_type}`);
    }

    // YClients ожидает успешный ответ
    res.status(200).json({ success: true });

  } catch (error) {
    logger.error('Callback processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================
// 3. Страница онбординга с QR-кодом
// ============================
router.get('/marketplace/onboarding', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send('Token required');
    }

    // Отправляем HTML страницу
    res.sendFile(path.join(__dirname, '../../../public/marketplace/onboarding.html'));

  } catch (error) {
    logger.error('Onboarding page error:', error);
    res.status(500).send('Error loading onboarding page');
  }
});

// ============================
// 4. API для получения QR-кода
// ============================
router.post('/marketplace/api/qr', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    );

    const { company_id, salon_id } = decoded;

    // Генерируем QR-код через Baileys
    const sessionId = `company_${salon_id}`;
    const qr = await sessionPool.getQR(sessionId);

    if (!qr) {
      // Инициализируем новую сессию
      await sessionPool.initSession(sessionId, {
        company_id,
        salon_id
      });

      // Ждем генерации QR
      setTimeout(async () => {
        const newQr = await sessionPool.getQR(sessionId);
        res.json({ qr: newQr, session_id: sessionId });
      }, 2000);
    } else {
      res.json({ qr, session_id: sessionId });
    }

  } catch (error) {
    logger.error('QR generation error:', error);
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// ============================
// 5. API для проверки статуса WhatsApp
// ============================
router.get('/marketplace/api/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await sessionPool.getSessionStatus(sessionId);
    res.json({ status, connected: status === 'connected' });

  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// ============================
// 6. Callback в YClients после успешного подключения
// ============================
router.post('/marketplace/api/activate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    );

    const { salon_id } = decoded;

    // Отправляем callback в YClients для активации
    const response = await fetch('https://api.yclients.com/marketplace/partner/callback/redirect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.YCLIENTS_PARTNER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        salon_id: parseInt(salon_id),
        application_id: parseInt(process.env.YCLIENTS_APP_ID || '1'), // Нужно получить от YClients
        api_key: crypto.randomBytes(32).toString('hex'),
        webhook_urls: [
          `https://ai-admin.app/callback/yclients`
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('YClients activation failed:', error);
      return res.status(500).json({ error: 'Activation failed' });
    }

    // Обновляем статус в БД
    await supabase
      .from('companies')
      .update({
        integration_status: 'active',
        whatsapp_connected: true,
        whatsapp_connected_at: new Date().toISOString()
      })
      .eq('yclients_id', parseInt(salon_id));

    res.json({ success: true, message: 'Integration activated' });

  } catch (error) {
    logger.error('Activation error:', error);
    res.status(500).json({ error: 'Activation failed' });
  }
});

// ============================
// Helper функции
// ============================

async function handleUninstall(salon_id) {
  logger.info(`Handling uninstall for salon ${salon_id}`);

  // Останавливаем WhatsApp сессию
  const sessionId = `company_${salon_id}`;
  await sessionPool.removeSession(sessionId);

  // Обновляем статус в БД
  await supabase
    .from('companies')
    .update({
      integration_status: 'uninstalled',
      whatsapp_connected: false
    })
    .eq('yclients_id', parseInt(salon_id));
}

async function handleFreeze(salon_id) {
  logger.info(`Handling freeze for salon ${salon_id}`);

  await supabase
    .from('companies')
    .update({
      integration_status: 'frozen'
    })
    .eq('yclients_id', parseInt(salon_id));
}

async function handlePayment(salon_id, data) {
  logger.info(`Payment received for salon ${salon_id}:`, data);

  await supabase
    .from('companies')
    .update({
      integration_status: 'active',
      last_payment_date: new Date().toISOString()
    })
    .eq('yclients_id', parseInt(salon_id));
}

module.exports = router;