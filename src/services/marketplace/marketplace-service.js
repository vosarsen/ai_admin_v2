// src/services/marketplace/marketplace-service.js
// Сервис для работы с маркетплейсом YClients и управления подключениями

const { supabase } = require('../../database/supabase');
const { createRedisClient } = require('../../utils/redis-factory');
const logger = require('../../utils/logger');
const YclientsClient = require('../../integrations/yclients/client');
const BaileysManager = require('../../integrations/whatsapp/baileys-manager');
const crypto = require('crypto');
const axios = require('axios');

class MarketplaceService {
  constructor() {
    this.supabase = supabase;
    this.redis = null; // Will be initialized in init()
    this.yclients = new YclientsClient();
    this.baileysManager = new BaileysManager();
    this.isInitialized = false;
  }

  async init() {
    if (!this.isInitialized) {
      this.redis = createRedisClient('marketplace');
      await this.redis.connect();
      this.isInitialized = true;
      logger.info('MarketplaceService initialized with Redis connection');
    }
  }

  /**
   * Создает или получает компанию по salon_id
   */
  async createOrGetCompany(salonId) {
    try {
      // Сначала проверяем, есть ли уже такая компания
      const { data: existingCompany, error: fetchError } = await this.supabase
        .from('companies')
        .select('*')
        .eq('yclients_salon_id', salonId)
        .single();

      if (existingCompany && !fetchError) {
        logger.info(`Компания уже существует`, { 
          company_id: existingCompany.id,
          salon_id: salonId 
        });
        return existingCompany;
      }

      // Получаем информацию о салоне из YClients
      const salonInfo = await this.fetchSalonInfo(salonId);

      // Создаем новую компанию
      const newCompany = {
        yclients_salon_id: salonId,
        name: salonInfo.title || `Салон ${salonId}`,
        phone: salonInfo.phone || '',
        email: salonInfo.email || '',
        address: salonInfo.address || '',
        city: salonInfo.city || '',
        api_key: this.generateAPIKey(),
        whatsapp_connected: false,
        settings: {
          business_type: this.detectBusinessType(salonInfo),
          timezone: salonInfo.timezone || 'Europe/Moscow',
          working_hours: salonInfo.schedule || {}
        },
        created_at: new Date().toISOString()
      };

      const { data: createdCompany, error: createError } = await this.supabase
        .from('companies')
        .insert([newCompany])
        .select()
        .single();

      if (createError) {
        logger.error('Ошибка создания компании:', createError);
        throw createError;
      }

      logger.info(`✅ Новая компания создана`, {
        company_id: createdCompany.id,
        name: createdCompany.name
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
      const qrData = await this.baileysManager.generateQRForCompany(companyId);

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
    const updateData = {
      whatsapp_connected: connected,
      whatsapp_connected_at: connected ? new Date().toISOString() : null
    };

    if (phoneNumber) {
      updateData.whatsapp_phone = phoneNumber;
    }

    const { error } = await this.supabase
      .from('companies')
      .update(updateData)
      .eq('id', companyId);

    if (error) {
      logger.error('Ошибка обновления статуса WhatsApp:', error);
      throw error;
    }

    logger.info(`✅ Статус WhatsApp обновлен`, {
      company_id: companyId,
      connected,
      phone: phoneNumber
    });
  }

  /**
   * Получает статистику подключений
   */
  async getConnectionStats() {
    const { data, error } = await this.supabase
      .from('companies')
      .select('whatsapp_connected')
      .eq('whatsapp_connected', true);

    if (error) {
      logger.error('Ошибка получения статистики:', error);
      return { total: 0, connected: 0 };
    }

    const totalCompanies = await this.supabase
      .from('companies')
      .select('count', { count: 'exact' });

    return {
      total: totalCompanies.count || 0,
      connected: data.length || 0
    };
  }
}

module.exports = MarketplaceService;