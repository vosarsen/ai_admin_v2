// src/api/routes/marketplace.js
const express = require('express');
const router = express.Router();
const path = require('path');
const logger = require('../../utils/logger');
const MarketplaceService = require('../../services/marketplace/marketplace-service');
const { validateApiKey } = require('../../middlewares/webhook-auth');

// Инициализация сервиса
const marketplaceService = new MarketplaceService();

/**
 * GET /marketplace/connect
 * Страница подключения WhatsApp для маркетплейса
 */
router.get('/connect', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../../../public/marketplace/connect.html'));
  } catch (error) {
    logger.error('Ошибка отправки страницы подключения:', error);
    res.status(500).send('Ошибка загрузки страницы');
  }
});

/**
 * POST /marketplace/register
 * Регистрация новой компании из маркетплейса
 */
router.post('/register', async (req, res) => {
  try {
    const { salon_id, phone, email } = req.body;

    // Валидация обязательных полей
    if (!salon_id) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует обязательный параметр salon_id'
      });
    }

    // Валидация salon_id (должен быть положительным числом)
    const salonId = parseInt(salon_id);
    if (!Number.isInteger(salonId) || salonId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат salon_id'
      });
    }

    // Валидация email если передан
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Некорректный формат email'
        });
      }
    }

    // Валидация телефона если передан
    if (phone) {
      const phoneClean = phone.replace(/\D/g, '');
      if (phoneClean.length < 10 || phoneClean.length > 15) {
        return res.status(400).json({
          success: false,
          error: 'Некорректный формат телефона'
        });
      }
    }

    // Инициализация сервиса если нужно
    await marketplaceService.init();

    // Создаем или получаем компанию
    const company = await marketplaceService.createOrGetCompany(salonId);

    // Генерируем API ключ для компании
    const apiKey = marketplaceService.generateAPIKey();

    // Сохраняем токен в Redis
    const token = `${company.id}_${Date.now()}`;
    await marketplaceService.saveToken(token, company.id);

    logger.info('✅ Компания зарегистрирована через маркетплейс', {
      companyId: company.id,
      salonId: salonId
    });

    // Формируем URL для подключения WhatsApp
    const connectUrl = `/marketplace/connect?token=${encodeURIComponent(token)}&company=${company.id}&salon=${salonId}`;

    res.json({
      success: true,
      company_id: company.id,
      salon_id: salonId,
      api_key: apiKey,
      connect_url: connectUrl,
      message: 'Компания успешно зарегистрирована'
    });

  } catch (error) {
    logger.error('Ошибка регистрации компании:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка регистрации компании'
    });
  }
});

/**
 * GET /marketplace/qr/:token
 * Получение QR-кода для подключения WhatsApp
 */
router.get('/qr/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Токен не указан'
      });
    }

    // Инициализация сервиса если нужно
    await marketplaceService.init();

    // Извлекаем companyId из токена
    const tokenParts = token.split('_');
    const companyId = tokenParts[0];

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный токен'
      });
    }

    // Валидируем токен
    const isValid = await marketplaceService.validateToken(token, companyId);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Недействительный токен'
      });
    }

    // Генерируем QR-код
    const qr = await marketplaceService.generateQR(companyId);

    res.json({
      success: true,
      qr: qr,
      expires_in: 20 // QR код действителен 20 секунд
    });

  } catch (error) {
    logger.error('Ошибка генерации QR-кода:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось сгенерировать QR-код'
    });
  }
});

/**
 * GET /marketplace/status/:companyId
 * Получение статуса подключения компании
 */
router.get('/status/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId || !Number.isInteger(parseInt(companyId))) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный ID компании'
      });
    }

    // Инициализация сервиса если нужно
    await marketplaceService.init();

    // Получаем информацию о компании
    const company = await marketplaceService.getCompany(parseInt(companyId));

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Компания не найдена'
      });
    }

    res.json({
      success: true,
      company_id: company.id,
      whatsapp_connected: company.whatsapp_connected || false,
      whatsapp_phone: company.whatsapp_phone || null,
      integration_status: company.integration_status || 'pending',
      connected_at: company.whatsapp_connected_at || null
    });

  } catch (error) {
    logger.error('Ошибка получения статуса:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статуса'
    });
  }
});

/**
 * POST /marketplace/callback
 * Callback для YClients после успешного подключения
 */
router.post('/callback', async (req, res) => {
  try {
    const {
      salon_id,
      company_id,
      status,
      whatsapp_phone,
      api_key
    } = req.body;

    logger.info('📨 Marketplace callback получен', {
      salon_id,
      company_id,
      status
    });

    if (!company_id || !status) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствуют обязательные параметры'
      });
    }

    // Инициализация сервиса если нужно
    await marketplaceService.init();

    // Обновляем статус подключения
    if (status === 'connected' && whatsapp_phone) {
      await marketplaceService.updateWhatsAppStatus(
        company_id,
        true,
        whatsapp_phone
      );
    }

    // Отправляем callback в YClients
    const result = await marketplaceService.sendCallbackToYClients({
      salon_id: salon_id,
      application_id: 'ai-admin',
      status: status,
      api_key: api_key,
      webhook_urls: [`https://ai-admin.app/webhook/yclients/${company_id}`]
    });

    res.json({
      success: result.success,
      message: result.success ? 'Callback отправлен' : 'Ошибка отправки callback',
      data: result.data
    });

  } catch (error) {
    logger.error('Ошибка обработки callback:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка обработки callback'
    });
  }
});

/**
 * POST /marketplace/webhook/:companyId
 * Webhook endpoint для получения событий от YClients
 */
router.post('/webhook/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const eventData = req.body;

    logger.info('📨 Webhook от YClients получен', {
      companyId,
      event: eventData.type || eventData.event
    });

    // Быстро отвечаем чтобы избежать повторов
    res.status(200).json({ success: true });

    // Инициализация сервиса если нужно
    await marketplaceService.init();

    // Обрабатываем webhook асинхронно
    await marketplaceService.handleWebhook(companyId, eventData);

  } catch (error) {
    logger.error('Ошибка обработки webhook:', error);
    // Уже ответили 200, просто логируем ошибку
  }
});

/**
 * GET /marketplace/companies
 * Получение статистики подключений (только для админов)
 */
router.get('/companies', validateApiKey, async (req, res) => {
  try {
    // Инициализация сервиса если нужно
    await marketplaceService.init();

    const stats = await marketplaceService.getConnectionStats();

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    logger.error('Ошибка получения статистики:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статистики'
    });
  }
});

/**
 * GET /marketplace/test
 * Тестовый endpoint для проверки работоспособности
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    endpoints: {
      connect: '/marketplace/connect',
      register: 'POST /marketplace/register',
      qr: '/marketplace/qr/:token',
      status: '/marketplace/status/:companyId',
      callback: 'POST /marketplace/callback',
      webhook: 'POST /marketplace/webhook/:companyId',
      companies: '/marketplace/companies'
    },
    message: 'Marketplace integration endpoints are ready'
  });
});

module.exports = router;