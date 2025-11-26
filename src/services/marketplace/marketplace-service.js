// src/services/marketplace/marketplace-service.js
// Сервис для работы с маркетплейсом YClients и управления подключениями
// Supabase import removed (2025-11-26) - not used in this file

const { createRedisClient } = require('../../utils/redis-factory');
const logger = require('../../utils/logger');
const { YclientsClient } = require('../../integrations/yclients/client');
const { getSessionPool } = require('../../integrations/whatsapp/session-pool');
const crypto = require('crypto');
const axios = require('axios');
const { validateId, sanitizeCompanyData, normalizePhone, validateEmail } = require('../../utils/validators');

class MarketplaceService {
  constructor() {
    this.supabase = supabase;
    this.redis = null; // Will be initialized in init()
    this.yclients = new YclientsClient();
    this.sessionPool = getSessionPool();
    this.isInitialized = false;
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
      const { data: companies, error: fetchError } = await this.supabase
        .from('companies')
        .select('*')
        .eq('yclients_id', validSalonId);

      if (fetchError) {
        logger.error('Ошибка проверки существующей компании:', fetchError);
        throw fetchError;
      }

      // Если компания существует, возвращаем ее
      if (companies && companies.length > 0) {
        const existingCompany = companies[0];
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

      const { data: createdCompany, error: createError } = await this.supabase
        .from('companies')
        .insert([sanitizedData])
        .select()
        .single();

      if (createError) {
        logger.error('Ошибка создания компании:', createError);
        throw createError;
      }

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
    const { data, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error) {
      logger.error('Ошибка получения компании:', error);
      return null;
    }

    return data;
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

    const { error } = await this.supabase
      .from('companies')
      .update(updateData)
      .eq('id', validCompanyId);

    if (error) {
      logger.error('Ошибка обновления статуса WhatsApp:', error);
      throw error;
    }

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
      // Получаем подключенные компании
      const { data: connectedCompanies, error: connectedError } = await this.supabase
        .from('companies')
        .select('id')
        .eq('whatsapp_connected', true);

      if (connectedError) {
        logger.error('Ошибка получения подключенных компаний:', connectedError);
      }

      // Получаем общее количество компаний
      const { count: totalCount, error: totalError } = await this.supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        logger.error('Ошибка получения общего количества:', totalError);
      }

      return {
        total: totalCount || 0,
        connected: connectedCompanies?.length || 0
      };
    } catch (error) {
      logger.error('Ошибка получения статистики:', error);
      return { total: 0, connected: 0 };
    }
  }
}

module.exports = MarketplaceService;