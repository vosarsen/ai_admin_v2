// src/services/ai-admin-v2/modules/cached-data-loader.js
const dataLoader = require('./data-loader');
const localCache = require('../../../utils/local-cache');
const logger = require('../../../utils/logger').child({ module: 'cached-data-loader' });

/**
 * Обертка над data-loader с локальным кэшированием
 * Снижает нагрузку на БД и ускоряет обработку
 */
class CachedDataLoader {
  constructor() {
    this.dataLoader = dataLoader;
    this.cache = localCache;
  }

  /**
   * Загрузить данные компании с кэшем
   */
  async loadCompanyData(companyId) {
    const cacheKey = `company:${companyId}`;
    
    return this.cache.getOrSet('company', cacheKey, async () => {
      logger.debug(`Loading company data from DB: ${companyId}`);
      return this.dataLoader.loadCompany(companyId);
    });
  }

  /**
   * Загрузить услуги с кэшем
   */
  async loadServices(companyId) {
    const cacheKey = `services:${companyId}`;
    
    return this.cache.getOrSet('services', cacheKey, async () => {
      logger.debug(`Loading services from DB: ${companyId}`);
      return this.dataLoader.loadServices(companyId);
    });
  }

  /**
   * Загрузить персонал с кэшем
   */
  async loadStaff(companyId) {
    const cacheKey = `staff:${companyId}`;
    
    return this.cache.getOrSet('services', cacheKey, async () => {
      logger.debug(`Loading staff from DB: ${companyId}`);
      return this.dataLoader.loadStaff(companyId);
    });
  }

  /**
   * Загрузить клиента с кэшем
   */
  async loadClient(phone, companyId) {
    const cacheKey = `client:${companyId}:${phone}`;
    
    return this.cache.getOrSet('clients', cacheKey, async () => {
      logger.debug(`Loading client from DB: ${phone}`);
      return this.dataLoader.loadClient(phone, companyId);
    });
  }

  /**
   * Загрузить расписание (не кэшируем - часто меняется)
   */
  async loadSchedules(companyId, staffIds) {
    // Расписание не кэшируем, так как оно критично для актуальности
    return this.dataLoader.loadSchedules(companyId, staffIds);
  }

  /**
   * Загрузить записи клиента с кэшем
   */
  async loadBookings(clientId, companyId) {
    const cacheKey = `bookings:${companyId}:${clientId}`;
    
    // Кэшируем только на 2 минуты, так как записи могут меняться
    return this.cache.getOrSet('slots', cacheKey, async () => {
      logger.debug(`Loading bookings from DB: ${clientId}`);
      return this.dataLoader.loadBookings(clientId, companyId);
    }, 120); // 2 минуты
  }

  /**
   * Загрузить последние сообщения с кэшем
   */
  async loadRecentMessages(phone, companyId) {
    const cacheKey = `messages:${companyId}:${phone}`;
    
    // Кэшируем на 1 минуту для быстрого доступа
    return this.cache.getOrSet('context', cacheKey, async () => {
      logger.debug(`Loading messages from DB: ${phone}`);
      return this.dataLoader.loadRecentMessages(phone, companyId);
    }, 60); // 1 минута
  }

  /**
   * Загрузить полный контекст с кэшированием
   */
  async loadFullContext(phone, companyId) {
    const startTime = Date.now();
    const contextKey = `full-context:${companyId}:${phone}`;
    
    // Пробуем получить весь контекст из кэша
    const cachedContext = this.cache.get('context', contextKey);
    if (cachedContext) {
      logger.info(`Full context loaded from cache in ${Date.now() - startTime}ms`);
      return cachedContext;
    }

    // Загружаем параллельно с использованием кэшей
    const [company, services, staff, client] = await Promise.all([
      this.loadCompanyData(companyId),
      this.loadServices(companyId),
      this.loadStaff(companyId),
      this.loadClient(phone, companyId)
    ]);

    let bookings = [];
    let staffSchedules = [];
    let recentMessages = [];
    let conversation = [];

    // Загружаем расписание для всех (нужно знать кто работает)
    const staffIds = staff.map(s => s.id);
    staffSchedules = await this.loadStaffSchedules(companyId, staffIds);

    // Загружаем дополнительные данные если есть клиент
    if (client) {
      [bookings, recentMessages, conversation] = await Promise.all([
        this.loadBookings(client.id, companyId),
        this.loadRecentMessages(phone, companyId),
        this.loadConversation(phone, companyId)
      ]);
    } else {
      // Даже если клиента нет в БД, загружаем историю из Redis
      conversation = await this.loadConversation(phone, companyId);
    }

    // Загружаем промежуточный контекст
    const intermediateContext = require('../../context/intermediate-context');
    const intermediate = await intermediateContext.getIntermediateContext(phone);
    
    // Загружаем Redis контекст для доступа к lastActivity и lastMessageDate
    const contextService = require('../../context');
    const cleanPhone = phone.replace('@c.us', '');
    const redisContext = await contextService.getContext(cleanPhone, companyId);
    
    const context = {
      phone,
      company,
      services,
      staff,
      client,
      bookings,
      staffSchedules,
      recentMessages,
      conversation,
      companyId,
      intermediateContext: intermediate,
      redisContext, // Добавляем Redis контекст для доступа к lastActivity и lastMessageDate
      startTime,
      loadTime: Date.now() - startTime
    };

    // Кэшируем полный контекст на 5 минут
    this.cache.set('context', contextKey, context, 300);
    
    logger.info(`Full context loaded in ${context.loadTime}ms (cached for 5 min)`);
    return context;
  }

  /**
   * Загрузить историю разговора с кэшем
   */
  async loadConversation(phone, companyId) {
    const cacheKey = `conversation:${companyId}:${phone}`;
    
    return this.cache.getOrSet('context', cacheKey, async () => {
      logger.debug(`Loading conversation from Redis: ${phone}`);
      
      // Загружаем из Redis через contextService
      const contextService = require('../../context');
      const cleanPhone = phone.replace('@c.us', '');
      
      try {
        const redisContext = await contextService.getContext(cleanPhone, companyId);
        // ВАЖНО: сообщения возвращаются в поле lastMessages, а не messages!
        const messages = redisContext?.lastMessages || redisContext?.messages || [];
        logger.debug(`Loaded ${messages.length} messages from Redis for ${cleanPhone}`);
        
        // Преобразуем формат сообщений из Redis в формат для промпта
        return messages.map(msg => ({
          // Поддерживаем оба формата: role/content и sender/text
          sender: msg.sender || (msg.role === 'user' ? 'user' : 'bot'),
          text: msg.text || msg.content || '',
          timestamp: msg.timestamp
        }));
      } catch (error) {
        logger.error('Failed to load conversation from Redis:', error);
        return [];
      }
    }, 300); // 5 минут
  }

  /**
   * Загрузить статистику бизнеса с кэшем
   */
  async loadBusinessStats(companyId) {
    const cacheKey = `stats:${companyId}`;
    
    return this.cache.getOrSet('services', cacheKey, async () => {
      logger.debug(`Loading business stats from DB: ${companyId}`);
      return this.dataLoader.loadBusinessStats(companyId);
    }, 600); // 10 минут
  }

  /**
   * Загрузить расписание персонала с кэшем
   */
  async loadStaffSchedules(companyId) {
    const cacheKey = `schedules:${companyId}`;
    
    return this.cache.getOrSet('services', cacheKey, async () => {
      logger.debug(`Loading staff schedules from DB: ${companyId}`);
      return this.dataLoader.loadStaffSchedules(companyId);
    }, 300); // 5 минут
  }


  /**
   * Инвалидировать кэш при изменениях
   */
  invalidateCache(entityType, entityId, companyId = null) {
    this.cache.invalidateRelated(entityType, entityId);
    
    // Дополнительная инвалидация для полного контекста
    if (companyId) {
      const contextKeys = this.cache.caches.context.keys();
      contextKeys.forEach(key => {
        if (key.includes(`full-context:${companyId}:`)) {
          this.cache.delete('context', key);
        }
      });
    }
  }

  /**
   * Получить статистику кэширования
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Все остальные методы проксируем напрямую
   */
  async saveContext(...args) {
    return this.dataLoader.saveContext(...args);
  }

  async updateClientPreferences(...args) {
    // Инвалидируем кэш клиента
    const [clientId, companyId] = args;
    this.invalidateCache('client', clientId, companyId);
    
    return this.dataLoader.updateClientPreferences(...args);
  }

  sortServicesForClient(...args) {
    return this.dataLoader.sortServicesForClient(...args);
  }

  formatScheduleInfo(...args) {
    return this.dataLoader.formatScheduleInfo(...args);
  }
}

// Экспортируем singleton
module.exports = new CachedDataLoader();