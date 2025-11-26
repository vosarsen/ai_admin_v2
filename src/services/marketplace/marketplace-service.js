// src/services/marketplace/marketplace-service.js
// Сервис для работы с маркетплейсом YClients и управления подключениями
// Migrated from Supabase to PostgreSQL repositories (2025-11-26)
// Extended with YclientsMarketplaceClient integration (2025-11-26)

const { createRedisClient } = require('../../utils/redis-factory');
const logger = require('../../utils/logger');
const Sentry = require('@sentry/node');
const { YclientsClient } = require('../../integrations/yclients/client');
const { createMarketplaceClient } = require('../../integrations/yclients/marketplace-client');
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');
const crypto = require('crypto');
const axios = require('axios');
const { validateId, sanitizeCompanyData, normalizePhone, validateEmail } = require('../../utils/validators');
const postgres = require('../../database/postgres');
const { CompanyRepository, MarketplaceEventsRepository } = require('../../repositories');

class MarketplaceService {
  constructor() {
    this.companyRepository = new CompanyRepository(postgres);
    this.marketplaceEventsRepository = new MarketplaceEventsRepository(postgres);
    this.redis = null; // Will be initialized in init()
    this.yclients = new YclientsClient();
    this.marketplaceClient = null; // Will be initialized lazily
    this.sessionPool = getSessionPool();
    this.isInitialized = false;
  }

  /**
   * Get or create marketplace client instance (lazy initialization)
   * @private
   */
  _getMarketplaceClient() {
    if (!this.marketplaceClient) {
      try {
        this.marketplaceClient = createMarketplaceClient();
        logger.info('MarketplaceClient initialized in MarketplaceService');
      } catch (error) {
        logger.error('Failed to initialize MarketplaceClient:', error.message);
        Sentry.captureException(error, {
          tags: { component: 'MarketplaceService', operation: 'initMarketplaceClient' }
        });
        throw error;
      }
    }
    return this.marketplaceClient;
  }

  async init() {
    if (!this.isInitialized) {
      try {
        this.redis = createRedisClient('marketplace');
        // Test Redis connection
        await this.redis.ping();
        this.isInitialized = true;
        logger.info('MarketplaceService initialized with Redis client');
      } catch (error) {
        logger.error('Ошибка подключения к Redis:', error);
        throw new Error('Failed to connect to Redis');
      }
    }
  }

  /**
   * Создает или получает компанию по salon_id
   */
  async createOrGetCompany(salonId) {
    try {
      // Валидация ID салона
      const validSalonId = validateId(salonId);
      if (!validSalonId) {
        throw new Error(`Некорректный salon_id: ${salonId}`);
      }

      // Сначала проверяем, есть ли уже такая компания
      const existingCompany = await this.companyRepository.findByYclientsId(validSalonId);

      // Если компания существует, возвращаем ее
      if (existingCompany) {
        logger.info(`Компания уже существует`, {
          company_id: existingCompany.id,
          salon_id: validSalonId
        });
        return existingCompany;
      }

      // Получаем информацию о салоне из YClients
      const salonInfo = await this.fetchSalonInfo(validSalonId);

      // Подготавливаем и валидируем данные компании
      const companyData = {
        yclients_id: validSalonId,
        company_id: validSalonId,
        title: salonInfo.title || `Салон ${validSalonId}`,
        phone: salonInfo.phone || '',
        email: salonInfo.email || '',
        address: salonInfo.address || '',
        timezone: salonInfo.timezone || 'Europe/Moscow',
        whatsapp_enabled: false,
        ai_enabled: true,
        sync_enabled: true,
        raw_data: salonInfo,
        created_at: new Date().toISOString()
      };

      // Санитизируем данные перед вставкой
      const sanitizedData = sanitizeCompanyData(companyData);

      const createdCompany = await this.companyRepository.create(sanitizedData);

      logger.info(`✅ Новая компания создана`, {
        company_id: createdCompany.id,
        title: createdCompany.title
      });

      return createdCompany;

    } catch (error) {
      logger.error('Ошибка в createOrGetCompany:', error);
      throw error;
    }
  }

  /**
   * Получает информацию о салоне из YClients API
   */
  async fetchSalonInfo(salonId) {
    try {
      // Используем YClients API для получения информации
      const response = await axios.get(
        `https://api.yclients.com/api/v1/company/${salonId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.YCLIENTS_API_KEY}`,
            'Accept': 'application/vnd.yclients.v2+json'
          }
        }
      );

      return response.data.data;

    } catch (error) {
      logger.warn(`Не удалось получить информацию о салоне ${salonId}`, error.message);
      
      // Возвращаем базовую информацию
      return {
        title: `Салон ${salonId}`,
        phone: '',
        email: '',
        address: '',
        city: '',
        timezone: 'Europe/Moscow'
      };
    }
  }

  /**
   * Определяет тип бизнеса по информации о салоне
   */
  detectBusinessType(salonInfo) {
    const title = (salonInfo.title || '').toLowerCase();
    const description = (salonInfo.description || '').toLowerCase();
    const combined = `${title} ${description}`;

    if (combined.includes('барбер') || combined.includes('barbershop')) {
      return 'barbershop';
    }
    if (combined.includes('ногт') || combined.includes('маникюр') || combined.includes('педикюр')) {
      return 'nails';
    }
    if (combined.includes('массаж')) {
      return 'massage';
    }
    if (combined.includes('брови') || combined.includes('ресниц')) {
      return 'brows';
    }
    if (combined.includes('эпиляц') || combined.includes('шугаринг')) {
      return 'epilation';
    }

    return 'beauty'; // По умолчанию
  }

  /**
   * Генерирует уникальный API ключ для компании
   */
  generateAPIKey() {
    return `sk_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Сохраняет токен в Redis
   */
  async saveToken(token, companyId) {
    await this.init(); // Ensure Redis is connected
    const key = `marketplace:token:${token}`;
    await this.redis.setex(key, 86400, companyId.toString()); // 24 часа
    
    // Также сохраняем обратную связь
    const reverseKey = `marketplace:company:${companyId}:token`;
    await this.redis.setex(reverseKey, 86400, token);
  }

  /**
   * Проверяет валидность токена
   */
  async validateToken(token, companyId) {
    await this.init(); // Ensure Redis is connected
    const key = `marketplace:token:${token}`;
    const storedCompanyId = await this.redis.get(key);
    return storedCompanyId === companyId.toString();
  }

  /**
   * Генерирует QR-код для WhatsApp
   */
  async generateQR(companyId) {
    try {
      await this.init(); // Ensure Redis is connected

      // Используем Baileys для генерации QR
      // Session pool не имеет метода generateQRForCompany, используем createSession
      await this.sessionPool.createSession(companyId);
      const qrData = this.sessionPool.qrCodes.get(companyId);

      // Сохраняем информацию о текущей сессии
      await this.redis.setex(
        `marketplace:qr:${companyId}`,
        20, // QR действителен 20 секунд
        JSON.stringify({
          generated_at: Date.now(),
          qr: qrData
        })
      );

      return qrData;

    } catch (error) {
      logger.error('Ошибка генерации QR:', error);
      throw error;
    }
  }

  /**
   * Получает компанию по ID
   */
  async getCompany(companyId) {
    try {
      const company = await this.companyRepository.findOne('companies', { id: companyId });
      return company;
    } catch (error) {
      logger.error('Ошибка получения компании:', error);
      return null;
    }
  }

  /**
   * Отправляет callback в YClients после успешного подключения
   */
  async sendCallbackToYClients(data) {
    try {
      const response = await axios.post(
        'https://api.yclients.com/marketplace/partner/callback/redirect',
        data,
        {
          headers: {
            'Authorization': `Bearer ${process.env.YCLIENTS_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: response.status === 301 || response.status === 200,
        data: response.data
      };

    } catch (error) {
      logger.error('Ошибка отправки callback в YClients:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обрабатывает webhook от YClients
   */
  async handleWebhook(companyId, eventData) {
    logger.info(`Обработка webhook для компании ${companyId}`, {
      event_type: eventData.type
    });

    // Здесь будет логика обработки различных событий от YClients
    switch (eventData.type) {
      case 'booking_created':
        // Обработка новой записи
        break;
      case 'booking_cancelled':
        // Обработка отмены записи
        break;
      case 'client_created':
        // Обработка нового клиента
        break;
      default:
        logger.warn(`Неизвестный тип события: ${eventData.type}`);
    }
  }

  /**
   * Обновляет статус WhatsApp подключения
   */
  async updateWhatsAppStatus(companyId, connected, phoneNumber = null) {
    // Валидация company ID
    const validCompanyId = validateId(companyId);
    if (!validCompanyId) {
      throw new Error(`Некорректный company_id: ${companyId}`);
    }

    const updateData = {
      whatsapp_connected: Boolean(connected),
      whatsapp_connected_at: connected ? new Date().toISOString() : null
    };

    // Если передан номер телефона, нормализуем и добавляем
    if (phoneNumber) {
      updateData.whatsapp_phone = normalizePhone(phoneNumber);
    }

    await this.companyRepository.update(validCompanyId, updateData);

    logger.info(`✅ Статус WhatsApp обновлен`, {
      company_id: validCompanyId,
      connected,
      phone: phoneNumber
    });
  }

  /**
   * Получает статистику подключений
   */
  async getConnectionStats() {
    try {
      const [connected, total] = await Promise.all([
        this.companyRepository.countConnected(),
        this.companyRepository.countTotal()
      ]);

      return {
        total: total || 0,
        connected: connected || 0
      };
    } catch (error) {
      logger.error('Ошибка получения статистики:', error);
      return { total: 0, connected: 0 };
    }
  }

  // =============== MARKETPLACE API METHODS (Phase 2) ===============

  /**
   * Notify YClients about payment (OUTBOUND)
   * Saves payment_id to marketplace_events for future refunds
   *
   * @param {number} salonId - YClients salon ID
   * @param {Object} paymentData - Payment details
   * @param {number} paymentData.payment_sum - Payment amount
   * @param {string} paymentData.currency_iso - Currency code (e.g., 'RUB')
   * @param {string} paymentData.payment_date - Payment date (YYYY-MM-DD)
   * @param {string} paymentData.period_from - Subscription start date
   * @param {string} paymentData.period_to - Subscription end date
   * @returns {Promise<Object>} Result with payment_id
   */
  async notifyYclientsAboutPayment(salonId, paymentData) {
    const validSalonId = validateId(salonId);
    if (!validSalonId) {
      throw new Error(`Invalid salon_id: ${salonId}`);
    }

    logger.info('Notifying YClients about payment', { salonId: validSalonId, paymentData });

    try {
      const client = this._getMarketplaceClient();
      const result = await client.notifyPayment(validSalonId, paymentData);

      if (result.success && result.data?.id) {
        // Use transaction to ensure atomic database updates
        await this.companyRepository.withTransaction(async (txClient) => {
          // Save payment_id to marketplace_events for refund capability
          const eventData = JSON.stringify({
            payment_id: result.data.id,
            ...paymentData
          });
          await txClient.query(
            `INSERT INTO marketplace_events (salon_id, event_type, event_data, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [validSalonId, 'payment_notified', eventData]
          );

          // Update last_payment_date in companies table
          await txClient.query(
            `UPDATE companies SET last_payment_date = $1 WHERE yclients_id = $2`,
            [new Date().toISOString(), validSalonId]
          );
        });

        logger.info('Payment notification successful', {
          salonId: validSalonId,
          paymentId: result.data.id
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to notify YClients about payment:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'notifyYclientsAboutPayment' },
        extra: { salonId: validSalonId, paymentData }
      });
      throw error;
    }
  }

  /**
   * Notify YClients about refund
   *
   * @param {number} paymentId - Payment ID from previous notifyPayment response
   * @param {string} [reason] - Reason for refund (for logging)
   * @returns {Promise<Object>} Refund result
   */
  async notifyYclientsAboutRefund(paymentId, reason = '') {
    if (!paymentId) {
      throw new Error('paymentId is required for refund');
    }

    logger.info('Notifying YClients about refund', { paymentId, reason });

    try {
      const client = this._getMarketplaceClient();
      const result = await client.notifyRefund(paymentId);

      if (result.success) {
        // Log refund event
        await this.marketplaceEventsRepository.insert({
          salon_id: null, // We may not have salon_id from paymentId
          event_type: 'refund_notified',
          event_data: {
            payment_id: paymentId,
            reason
          }
        });

        logger.info('Refund notification successful', { paymentId });
      }

      return result;
    } catch (error) {
      logger.error('Failed to notify YClients about refund:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'notifyYclientsAboutRefund' },
        extra: { paymentId, reason }
      });
      throw error;
    }
  }

  /**
   * Check integration health status for a salon
   * Sends Telegram alert if issues detected
   *
   * @param {number} salonId - YClients salon ID
   * @returns {Promise<Object>} Health status with logs and payments
   */
  async checkIntegrationHealth(salonId) {
    const validSalonId = validateId(salonId);
    if (!validSalonId) {
      throw new Error(`Invalid salon_id: ${salonId}`);
    }

    logger.info('Checking integration health', { salonId: validSalonId });

    try {
      const client = this._getMarketplaceClient();
      const result = await client.getIntegrationStatus(validSalonId);

      if (result.success) {
        // Check for issues and send alert if needed
        const status = result.data?.connection_status;
        if (status && status !== 'active' && status !== 'connected') {
          logger.warn('Integration health issue detected', {
            salonId: validSalonId,
            status
          });
          // TODO: Send Telegram alert here if needed
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to check integration health:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'checkIntegrationHealth' },
        extra: { salonId: validSalonId }
      });
      throw error;
    }
  }

  /**
   * Get list of active connected salons with pagination
   *
   * @param {number} [page=1] - Page number
   * @param {number} [limit=100] - Items per page (max 1000)
   * @returns {Promise<Object>} List of connected salons
   */
  async getActiveConnections(page = 1, limit = 100) {
    logger.info('Getting active connections', { page, limit });

    try {
      const client = this._getMarketplaceClient();
      return client.getConnectedSalons(page, limit);
    } catch (error) {
      logger.error('Failed to get active connections:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'getActiveConnections' },
        extra: { page, limit }
      });
      throw error;
    }
  }

  /**
   * Disconnect salon from the application
   * Cleans up WhatsApp session and updates company status
   *
   * @param {number} salonId - YClients salon ID
   * @param {string} [reason] - Reason for disconnection (for logging)
   * @returns {Promise<Object>} Disconnection result
   */
  async disconnectSalon(salonId, reason = '') {
    const validSalonId = validateId(salonId);
    if (!validSalonId) {
      throw new Error(`Invalid salon_id: ${salonId}`);
    }

    logger.warn('Disconnecting salon', { salonId: validSalonId, reason });

    try {
      // 1. Get company info first
      const company = await this.companyRepository.findByYclientsId(validSalonId);

      // 2. If company exists, cleanup WhatsApp session
      if (company) {
        try {
          // Try to terminate WhatsApp session
          const sessionPool = getSessionPool();
          if (sessionPool && typeof sessionPool.removeSession === 'function') {
            await sessionPool.removeSession(company.id);
            logger.info('WhatsApp session removed', { companyId: company.id });
          }
        } catch (sessionError) {
          logger.warn('Failed to remove WhatsApp session:', sessionError.message);
          // Continue with disconnection even if session cleanup fails
        }
      }

      // 3. Call YClients API to uninstall
      const client = this._getMarketplaceClient();
      const result = await client.uninstallFromSalon(validSalonId);

      if (result.success) {
        // Use transaction to ensure atomic database updates
        await this.companyRepository.withTransaction(async (txClient) => {
          // 4. Update company status in database
          if (company) {
            await txClient.query(
              `UPDATE companies
               SET status = $1, whatsapp_connected = $2, disconnected_at = $3
               WHERE id = $4`,
              ['disconnected', false, new Date().toISOString(), company.id]
            );
          }

          // 5. Log disconnection event
          const eventData = JSON.stringify({ reason });
          await txClient.query(
            `INSERT INTO marketplace_events (company_id, salon_id, event_type, event_data, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [company?.id || null, validSalonId, 'disconnected', eventData]
          );
        });

        logger.info('Salon disconnected successfully', { salonId: validSalonId });
      }

      return result;
    } catch (error) {
      logger.error('Failed to disconnect salon:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'disconnectSalon' },
        extra: { salonId: validSalonId, reason }
      });
      throw error;
    }
  }

  /**
   * Update notification channel status (WhatsApp/SMS toggle)
   *
   * @param {number} salonId - YClients salon ID
   * @param {string} channel - Channel: 'whatsapp' | 'sms'
   * @param {boolean} enabled - Enable or disable the channel
   * @returns {Promise<Object>} Update result
   */
  async updateNotificationChannel(salonId, channel, enabled) {
    const validSalonId = validateId(salonId);
    if (!validSalonId) {
      throw new Error(`Invalid salon_id: ${salonId}`);
    }

    const validChannels = ['whatsapp', 'sms'];
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}. Valid: ${validChannels.join(', ')}`);
    }

    logger.info('Updating notification channel', {
      salonId: validSalonId,
      channel,
      enabled
    });

    try {
      const client = this._getMarketplaceClient();
      const result = await client.updateChannel(validSalonId, channel, enabled);

      if (result.success) {
        // Update local database
        const updateData = channel === 'whatsapp'
          ? { whatsapp_channel_enabled: enabled }
          : { sms_channel_enabled: enabled };

        await this.companyRepository.updateByYclientsId(validSalonId, updateData);

        logger.info('Channel updated successfully', {
          salonId: validSalonId,
          channel,
          enabled
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to update notification channel:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'updateNotificationChannel' },
        extra: { salonId: validSalonId, channel, enabled }
      });
      throw error;
    }
  }

  /**
   * Get application tariffs
   * @returns {Promise<Object>} Tariff options with prices
   */
  async getTariffs() {
    logger.info('Getting application tariffs');

    try {
      const client = this._getMarketplaceClient();
      return client.getTariffs();
    } catch (error) {
      logger.error('Failed to get tariffs:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'getTariffs' }
      });
      throw error;
    }
  }

  /**
   * Generate payment link for a salon
   *
   * @param {number} salonId - YClients salon ID
   * @param {number} [discount] - Optional discount percentage
   * @returns {Promise<Object>} Payment link
   */
  async generatePaymentLink(salonId, discount = null) {
    const validSalonId = validateId(salonId);
    if (!validSalonId) {
      throw new Error(`Invalid salon_id: ${salonId}`);
    }

    logger.info('Generating payment link', { salonId: validSalonId, discount });

    try {
      const client = this._getMarketplaceClient();
      return client.generatePaymentLink(validSalonId, discount);
    } catch (error) {
      logger.error('Failed to generate payment link:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'generatePaymentLink' },
        extra: { salonId: validSalonId, discount }
      });
      throw error;
    }
  }

  /**
   * Add discount for multiple salons
   *
   * @param {number[]} salonIds - Array of YClients salon IDs
   * @param {number} discountPercent - Discount percentage
   * @returns {Promise<Object>} Result
   */
  async addDiscount(salonIds, discountPercent) {
    if (!Array.isArray(salonIds) || salonIds.length === 0) {
      throw new Error('salonIds must be a non-empty array');
    }

    logger.info('Adding discount', {
      salonCount: salonIds.length,
      discountPercent
    });

    try {
      const client = this._getMarketplaceClient();
      return client.addDiscount(salonIds, discountPercent);
    } catch (error) {
      logger.error('Failed to add discount:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'addDiscount' },
        extra: { salonCount: salonIds.length, discountPercent }
      });
      throw error;
    }
  }

  /**
   * Set SMS sender short names for a salon
   *
   * @param {number} salonId - YClients salon ID
   * @param {string[]} shortNames - Array of sender names
   * @returns {Promise<Object>} Result
   */
  async setSmsShortNames(salonId, shortNames) {
    const validSalonId = validateId(salonId);
    if (!validSalonId) {
      throw new Error(`Invalid salon_id: ${salonId}`);
    }

    if (!Array.isArray(shortNames)) {
      throw new Error('shortNames must be an array');
    }

    logger.info('Setting SMS short names', {
      salonId: validSalonId,
      shortNames
    });

    try {
      const client = this._getMarketplaceClient();
      const result = await client.setShortNames(validSalonId, shortNames);

      if (result.success) {
        // Update local database
        await this.companyRepository.updateByYclientsId(validSalonId, {
          sms_short_names: shortNames
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to set SMS short names:', error);
      Sentry.captureException(error, {
        tags: { component: 'MarketplaceService', operation: 'setSmsShortNames' },
        extra: { salonId: validSalonId, shortNames }
      });
      throw error;
    }
  }
}

module.exports = MarketplaceService;