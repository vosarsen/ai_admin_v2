// src/api/routes/marketplace/index.js
// Маршруты для интеграции с маркетплейсом YClients

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const MarketplaceService = require('../../../services/marketplace/marketplace-service');
const logger = require('../../../utils/logger');

// Инициализируем сервис
const marketplaceService = new MarketplaceService();

/**
 * GET /marketplace/register
 * Точка входа из маркетплейса YClients
 * YClients редиректит сюда с параметром salon_id
 */
router.get('/register', async (req, res) => {
  const { salon_id } = req.query;
  
  logger.info(`📍 Новая регистрация из маркетплейса YClients`, { salon_id });
  
  if (!salon_id) {
    logger.error('Отсутствует salon_id в запросе');
    return res.status(400).render('error', {
      message: 'Ошибка: отсутствует идентификатор салона'
    });
  }
  
  try {
    // Создаем или получаем компанию
    const company = await marketplaceService.createOrGetCompany(salon_id);
    
    // Генерируем токен для WhatsApp подключения
    const whatsappToken = jwt.sign(
      { 
        company_id: company.id, 
        salon_id,
        type: 'whatsapp_auth'
      },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: '24h' }
    );
    
    // Сохраняем токен в кеше
    await marketplaceService.saveToken(whatsappToken, company.id);
    
    logger.info(`✅ Компания создана/найдена`, {
      company_id: company.id,
      name: company.name
    });
    
    // Рендерим страницу с QR-кодом
    res.render('marketplace/connect', {
      company,
      salon_id,
      whatsapp_token: whatsappToken,
      application_id: process.env.YCLIENTS_APPLICATION_ID || 'test-app-id',
      ws_url: process.env.WS_URL || 'ws://localhost:3000'
    });
    
  } catch (error) {
    logger.error('Ошибка при регистрации из маркетплейса:', error);
    res.status(500).render('error', {
      message: 'Произошла ошибка при регистрации. Попробуйте позже.'
    });
  }
});

/**
 * GET /marketplace/qr/:token
 * API endpoint для получения QR-кода
 */
router.get('/qr/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    const companyId = decoded.company_id;
    
    // Проверяем, что токен еще действителен в кеше
    const isValid = await marketplaceService.validateToken(token, companyId);
    if (!isValid) {
      return res.status(401).json({ error: 'Токен недействителен или истек' });
    }
    
    // Генерируем QR-код через Baileys
    const qrData = await marketplaceService.generateQR(companyId);
    
    res.json({
      success: true,
      qr: qrData,
      expires_in: 20,
      company_id: companyId
    });
    
  } catch (error) {
    logger.error('Ошибка генерации QR-кода:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Неверный токен' });
    }
    
    res.status(500).json({ error: 'Ошибка генерации QR-кода' });
  }
});

/**
 * POST /marketplace/callback
 * Callback для YClients после успешного подключения
 */
router.post('/callback', async (req, res) => {
  const { company_id, api_key, webhook_url } = req.body;
  
  try {
    logger.info('📤 Отправка callback в YClients', { company_id });
    
    // Получаем данные компании
    const company = await marketplaceService.getCompany(company_id);
    if (!company) {
      return res.status(404).json({ error: 'Компания не найдена' });
    }
    
    // Формируем данные для YClients
    const callbackData = {
      salon_id: company.yclients_salon_id,
      application_id: process.env.YCLIENTS_APPLICATION_ID,
      api_key: api_key || company.api_key,
      webhook_urls: [webhook_url || `${process.env.API_URL}/webhook/yclients/${company.id}`],
      channels: ['whatsapp']
    };
    
    // Отправляем в YClients
    const result = await marketplaceService.sendCallbackToYClients(callbackData);
    
    if (result.success) {
      logger.info('✅ Callback успешно отправлен в YClients');
      res.json({ success: true, message: 'Интеграция активирована' });
    } else {
      throw new Error('Ошибка отправки callback в YClients');
    }
    
  } catch (error) {
    logger.error('Ошибка отправки callback:', error);
    res.status(500).json({ error: 'Ошибка активации интеграции' });
  }
});

/**
 * POST /marketplace/webhook
 * Webhook endpoint для получения событий от YClients
 */
router.post('/webhook/:company_id', async (req, res) => {
  const { company_id } = req.params;
  const eventData = req.body;
  
  try {
    logger.info('📨 Получен webhook от YClients', {
      company_id,
      event_type: eventData.type
    });
    
    // Обрабатываем событие
    await marketplaceService.handleWebhook(company_id, eventData);
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('Ошибка обработки webhook:', error);
    res.status(500).json({ error: 'Ошибка обработки события' });
  }
});

module.exports = router;