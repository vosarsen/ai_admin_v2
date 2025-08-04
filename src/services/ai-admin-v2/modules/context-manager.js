const logger = require('../../../utils/logger').child({ module: 'context-manager' });
const contextService = require('../../context');
const dataLoader = require('../../data-loader');
const intermediateContext = require('../../context/intermediate-context');

/**
 * Простая реализация LRU кэша
 */
class LRUCache {
  constructor(maxSize = 100, ttl = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttl; // время жизни в миллисекундах
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Проверяем не истек ли TTL
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    // LRU: переместить в конец (самый свежий)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  set(key, value) {
    // Удаляем если уже существует (для LRU порядка)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Проверяем размер кэша
    if (this.cache.size >= this.maxSize) {
      // Удаляем самый старый элемент (первый в Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    // Добавляем в конец
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Периодическая очистка истекших элементов
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

/**
 * Модуль для управления контекстом разговора
 */
class ContextManager {
  constructor() {
    // LRU кеш контекстов в памяти
    this.memoryCache = new LRUCache(500, 5 * 60 * 1000); // 500 элементов, 5 минут TTL
    
    // Метрики кэша
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // Запускаем периодическую очистку
    this.cleanupInterval = setInterval(() => {
      this.memoryCache.cleanup();
      logger.debug('Memory cache cleanup completed', this.memoryCache.getStats());
    }, 60 * 1000); // каждую минуту
  }

  /**
   * Загрузка полного контекста с многоуровневым кешированием
   */
  async loadFullContext(phone, companyId) {
    const startTime = Date.now();
    const cacheKey = `${phone}@${companyId}`;
    
    // 1. Проверяем кеш в памяти
    const memoryCached = this.getFromMemoryCache(cacheKey);
    if (memoryCached) {
      logger.info(`✅ Context loaded from memory cache in ${Date.now() - startTime}ms`);
      return { ...memoryCached, startTime: Date.now() };
    }
    
    // 2. Проверяем Redis кеш
    logger.info(`Checking Redis cache for ${cacheKey}`);
    const redisCached = await contextService.getCachedFullContext(phone, companyId);
    if (redisCached) {
      logger.info(`✅ Context loaded from Redis cache in ${Date.now() - startTime}ms`);
      // Сохраняем в память для быстрого доступа
      this.saveToMemoryCache(cacheKey, redisCached);
      return { ...redisCached, startTime: Date.now() };
    }
    
    logger.info('❌ No cached context found, loading from database...');
    
    // 3. Загружаем из базы данных
    const context = await this.loadFromDatabase(phone, companyId);
    
    // 4. Сохраняем в кеши
    await this.saveToCache(cacheKey, context, phone, companyId);
    
    logger.info(`✅ Context loaded from database in ${Date.now() - startTime}ms`);
    return { ...context, startTime: Date.now() };
  }

  /**
   * Загрузка данных из базы
   */
  async loadFromDatabase(phone, companyId) {
    // Параллельная загрузка всех данных
    const [
      company, 
      clientFromDb, 
      services, 
      staff, 
      conversation, 
      businessStats, 
      staffSchedules, 
      redisContext,
      preferences,
      conversationSummary,
      intermediateCtx
    ] = await Promise.all([
      dataLoader.loadCompanyData(companyId),
      dataLoader.loadClient(phone, companyId),
      dataLoader.loadServices(companyId),
      dataLoader.loadStaff(companyId),
      dataLoader.loadConversation(phone, companyId),
      dataLoader.loadBusinessStats(companyId),
      dataLoader.loadStaffSchedules(companyId),
      contextService.getContext(phone.replace('@c.us', '')),
      dataLoader.loadClientPreferences(phone, companyId),
      dataLoader.generateConversationSummary(phone, companyId),
      intermediateContext.getIntermediateContext(phone)
    ]);
    
    // Обогащаем клиента информацией из Redis
    const client = this.enrichClientData(clientFromDb, redisContext);
    
    // Сортируем услуги для клиента
    const sortedServices = await this.sortServicesForClient(services, client, businessStats);
    
    return {
      phone,
      company,
      client,
      services: sortedServices,
      staff,
      staffSchedules,
      conversation,
      businessStats,
      redisContext,
      preferences,
      conversationSummary,
      intermediate: intermediateCtx,
      companyId
    };
  }

  /**
   * Получение статистики кэша
   */
  getCacheStats() {
    return {
      memory: {
        ...this.memoryCache.getStats(),
        metrics: this.cacheMetrics
      }
    };
  }

  /**
   * Очистка ресурсов при завершении
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.memoryCache.clear();
  }

  /**
   * Обогащение данных клиента
   */
  enrichClientData(clientFromDb, redisContext) {
    if (!clientFromDb && redisContext?.userName) {
      return {
        phone: redisContext.phone,
        name: redisContext.userName,
        fromRedis: true
      };
    }
    return clientFromDb;
  }

  /**
   * Сортировка услуг для клиента
   */
  async sortServicesForClient(services, client, businessStats) {
    if (!services || services.length === 0) return [];
    
    return services.map(service => {
      let score = 0;
      
      // Базовая популярность
      if (businessStats?.popularServices) {
        const popularity = businessStats.popularServices.find(
          ps => ps.service_id === service.id
        );
        if (popularity) {
          score += popularity.booking_count * 10;
        }
      }
      
      // Предпочтения клиента
      if (client?.favorite_service_id === service.id) {
        score += 1000;
      }
      
      // Категория для новых клиентов
      if (!client && service.category?.toLowerCase().includes('стрижк')) {
        score += 100;
      }
      
      return { ...service, score };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Сохранение контекста
   */
  async saveContext(context) {
    const { phone, redisContext } = context;
    
    // Сохраняем в Redis
    if (redisContext) {
      await contextService.setContext(phone.replace('@c.us', ''), redisContext);
    }
    
    // Обновляем кеши
    const cacheKey = `${phone}@${context.companyId}`;
    await this.saveToCache(cacheKey, context, phone, context.companyId);
  }

  /**
   * Инвалидация кеша
   */
  async invalidateCache(phone, companyId) {
    const cacheKey = `${phone}@${companyId}`;
    
    // Удаляем из памяти
    this.memoryCache.delete(cacheKey);
    
    // Удаляем из Redis
    await contextService.invalidateCachedContext(phone, companyId);
    
    logger.info(`Cache invalidated for ${cacheKey}`);
  }

  /**
   * Работа с кешем в памяти
   */
  getFromMemoryCache(key) {
    const cached = this.memoryCache.get(key);
    if (cached) {
      this.cacheMetrics.hits++;
      return cached;
    }
    
    this.cacheMetrics.misses++;
    return null;
  }

  saveToMemoryCache(key, data) {
    this.memoryCache.set(key, data);
  }

  async saveToCache(cacheKey, context, phone, companyId) {
    // Сохраняем в память
    this.saveToMemoryCache(cacheKey, context);
    
    // Сохраняем в Redis
    await contextService.cacheFullContext(phone, companyId, context);
  }

  /**
   * Обновление промежуточного контекста
   */
  async updateIntermediateContext(phone, data) {
    await intermediateContext.updateAfterAIAnalysis(
      phone,
      data.aiResponse,
      data.executedCommands || []
    );
  }

  /**
   * Получение истории разговора
   */
  async getConversationHistory(phone, companyId, limit = 10) {
    const conversation = await dataLoader.loadConversation(phone, companyId, limit);
    return conversation;
  }

  /**
   * Проверка и ожидание предыдущей обработки
   */
  async waitForPreviousProcessing(phone, timeout = 3000) {
    const intermediate = await intermediateContext.getIntermediateContext(phone);
    
    if (intermediate?.isRecent && intermediate.processingStatus === 'started') {
      logger.info('Found recent processing, waiting for completion...');
      
      const waitResult = await intermediateContext.waitForCompletion(phone, timeout);
      
      if (!waitResult) {
        logger.warn(`Previous message still processing after ${timeout}ms, continuing anyway`);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Установка статуса обработки
   */
  async setProcessingStatus(phone, status) {
    await intermediateContext.setProcessingStatus(phone, status);
  }

  /**
   * Обработка ожидающих действий
   */
  async handlePendingActions(message, phone, companyId, redisContext) {
    // Проверяем ожидающую отмену
    if (redisContext?.pendingCancellation) {
      const { messageProcessor } = require('./message-processor');
      return await messageProcessor.handlePendingCancellation(
        message,
        phone,
        companyId,
        redisContext
      );
    }
    
    // Другие ожидающие действия можно добавить здесь
    
    return { handled: false };
  }
}

module.exports = new ContextManager();