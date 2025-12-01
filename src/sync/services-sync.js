/**
 * Синхронизация услуг из YClients в PostgreSQL
 * Migration: Supabase → PostgreSQL Repository Pattern (2025-11-26)
 */

const postgres = require('../database/postgres');
const Sentry = require('@sentry/node');
const ServiceRepository = require('../repositories/ServiceRepository');
const logger = require('../utils/logger').child({ module: 'services-sync' });
const { YCLIENTS_CONFIG, createYclientsHeaders, delay } = require('./sync-utils');
const axios = require('axios');
const serviceDeclension = require('../services/declension/service-declension');

class ServicesSync {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.tableName = 'services';
    this.serviceRepo = new ServiceRepository(postgres);
  }

  /**
   * Синхронизировать все услуги компании
   * @returns {Promise<Object>} Результат синхронизации
   */
  async sync() {
    const startTime = Date.now();
    
    try {
      logger.info('🛍️ Starting services synchronization...');
      
      // Сначала получаем категории услуг
      const categories = await this.fetchServiceCategories();
      logger.info(`📂 Found ${categories.length} service categories`);
      
      // Создаем маппинг category_id -> category_title
      const categoryMap = {};
      categories.forEach(cat => {
        categoryMap[cat.id] = cat.title;
      });
      
      // Получаем услуги из YClients API
      const services = await this.fetchServices();
      
      if (!services || services.length === 0) {
        logger.warn('No services found in YClients');
        return { 
          success: true, 
          processed: 0, 
          errors: 0, 
          total: 0,
          duration: Date.now() - startTime 
        };
      }

      logger.info(`📋 Found ${services.length} services to sync`);
      
      // Добавляем category_title к каждой услуге
      services.forEach(service => {
        if (service.category_id && categoryMap[service.category_id]) {
          service.category_title_from_api = categoryMap[service.category_id];
        }
      });

      // Получаем существующие услуги из БД для сохранения склонений
      logger.info('📚 Loading existing services from database...');
      const existingServices = await this.serviceRepo.findAll(this.config.COMPANY_ID, true);
      
      // Создаем маппинг существующих склонений
      // ВАЖНО: service.id из YClients API соответствует yclients_id в нашей БД
      const existingDeclensionsMap = new Map();
      existingServices.forEach(service => {
        if (service.declensions) {
          // Используем yclients_id как ключ, так как он будет сравниваться с service.id из API
          existingDeclensionsMap.set(service.yclients_id, service.declensions);
        }
      });
      logger.info(`📝 Found ${existingDeclensionsMap.size} existing declensions`);

      // Определяем новые услуги (для которых нужно генерировать склонения)
      const newServices = services.filter(service => 
        !existingDeclensionsMap.has(service.id)
      );
      
      if (newServices.length > 0) {
        logger.info(`🆕 Found ${newServices.length} new services, generating declensions...`);
        const declensionsMap = await serviceDeclension.generateBatchDeclensions(newServices);
        
        // Добавляем новые склонения к услугам
        newServices.forEach(service => {
          if (declensionsMap.has(service.id)) {
            existingDeclensionsMap.set(service.id, declensionsMap.get(service.id));
          }
        });
      }
      
      // Применяем склонения ко всем услугам (существующие или новые)
      services.forEach(service => {
        if (existingDeclensionsMap.has(service.id)) {
          service.declensions = existingDeclensionsMap.get(service.id);
        }
      });

      // Обрабатываем и сохраняем услуги
      const result = await this.saveServices(services);
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Services sync completed in ${duration}ms`, {
        processed: result.processed,
        errors: result.errors,
        total: services.length
      });

      return {
        success: true,
        ...result,
        duration
      };

    } catch (error) {
      logger.error('❌ Services sync failed', {
        error: error.message,
        stack: error.stack
      });

      Sentry.captureException(error, {
        tags: {
          component: 'sync',
          sync_type: 'services'
        },
        extra: {
          duration: `${Date.now() - startTime}ms`
        }
      });

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Получить категории услуг из YClients API
   * @returns {Promise<Array>} Массив категорий
   */
  async fetchServiceCategories() {
    try {
      // Правильный endpoint для получения ВСЕХ категорий компании
      const url = `${this.config.BASE_URL}/company/${this.config.COMPANY_ID}/service_categories`;
      const headers = createYclientsHeaders(true);
      
      logger.debug('Fetching service categories from YClients', { url });
      
      const response = await axios.get(url, { headers });
      
      if (response.data?.success === false) {
        throw new Error(response.data?.meta?.message || 'API returned error');
      }
      
      return response.data?.data || [];
      
    } catch (error) {
      logger.error('Failed to fetch service categories from YClients', {
        error: error.message,
        response: error.response?.data
      });
      // Если не удалось получить категории, возвращаем пустой массив
      return [];
    }
  }

  /**
   * Получить услуги из YClients API
   * @returns {Promise<Array>} Массив услуг
   */
  async fetchServices() {
    try {
      const url = `${this.config.BASE_URL}/company/${this.config.COMPANY_ID}/services`;
      const headers = createYclientsHeaders(true);
      
      logger.debug('Fetching services from YClients', { url });
      
      const response = await axios.get(url, { headers });
      
      if (response.data?.success === false) {
        throw new Error(response.data?.meta?.message || 'API returned error');
      }
      
      return response.data?.data || [];
      
    } catch (error) {
      logger.error('Failed to fetch services from YClients', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Сохранить услуги в PostgreSQL (батчевый upsert)
   * @param {Array} services - Массив услуг
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveServices(services) {
    // Подготавливаем данные для всех услуг
    const preparedServices = services.map(service => this.prepareServiceData(service));

    try {
      // Используем батчевый upsert через репозиторий
      const result = await this.serviceRepo.syncBulkUpsert(preparedServices);

      logger.info(`✅ Batch upsert completed: ${result.count} services in ${result.duration}ms`);

      return {
        processed: result.count,
        errors: 0,
        errorDetails: [],
        duration: result.duration
      };
    } catch (error) {
      logger.error('❌ Batch upsert failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Подготовить данные услуги для сохранения
   * @param {Object} service - Сырые данные услуги из API
   * @returns {Object} Подготовленные данные
   */
  prepareServiceData(service) {
    return {
      yclients_id: service.id,
      company_id: this.config.COMPANY_ID,
      title: service.title || 'Unnamed Service',
      category_id: service.category_id || null,
      category_title: service.category_title_from_api || service.category?.title || null,
      price_min: service.price_min || 0,
      price_max: service.price_max || service.price_min || 0,
      discount: service.discount || 0,
      duration: service.seance_length || null,
      seance_length: service.seance_length || null,
      is_active: service.active === 1 || service.active === "1",
      is_bookable: service.bookable !== 0 && service.bookable !== "0",
      description: service.comment || null,
      weight: service.weight || 0,
      declensions: service.declensions || null, // Сохраняем склонения
      last_sync_at: new Date().toISOString(),
      raw_data: service // Сохраняем полные данные для отладки
    };
  }

  /**
   * Обновить статус синхронизации (deprecated - не используется)
   * TODO: Удалить после полной миграции с Supabase
   */
  async updateSyncStatus(status, recordsProcessed = 0, errorMessage = null) {
    // Метод не используется в текущей реализации
    // Статус синхронизации логируется, но не сохраняется в БД
    logger.debug('updateSyncStatus called (no-op)', { status, recordsProcessed });
  }
}

module.exports = { ServicesSync };