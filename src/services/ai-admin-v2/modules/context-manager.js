const logger = require('../../../utils/logger').child({ module: 'context-manager' });
const contextService = require('../../context');
const dataLoader = require('./data-loader');
const intermediateContext = require('../../context/intermediate-context');
const performanceMetrics = require('./performance-metrics');
const LRUCache = require('./lru-cache');
const config = require('../config/modules-config');

/**
 * Модуль для управления контекстом разговора
 */
class ContextManager {
  constructor() {
    // LRU кеш контекстов в памяти
    this.memoryCache = new LRUCache(config.cache.contextCacheSize, config.cache.contextCacheTTL);
    
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
    }, config.contextManager.memoryCheckInterval);
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
      performanceMetrics.updateCacheMetrics(true); // cache hit
      return { ...memoryCached, startTime: Date.now() };
    }
    
    // 2. Проверяем Redis кеш
    logger.info(`Checking Redis cache for ${cacheKey}`);
    const redisCached = await contextService.getCachedFullContext(phone, companyId);
    if (redisCached) {
      logger.info(`✅ Context loaded from Redis cache in ${Date.now() - startTime}ms`);
      performanceMetrics.updateCacheMetrics(true); // cache hit
      // Сохраняем в память для быстрого доступа
      this.saveToMemoryCache(cacheKey, redisCached);
      return { ...redisCached, startTime: Date.now() };
    }
    
    logger.info('❌ No cached context found, loading from database...');
    performanceMetrics.updateCacheMetrics(false); // cache miss
    
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
      dataLoader.loadCompanyData(companyId).catch(e => { console.log('[DEBUG] loadCompanyData failed:', e.message); throw e; }),
      dataLoader.loadClient(phone, companyId).catch(e => { console.log('[DEBUG] loadClient failed:', e.message); throw e; }),
      dataLoader.loadServices(companyId).catch(e => { console.log('[DEBUG] loadServices failed:', e.message); throw e; }),
      dataLoader.loadStaff(companyId).catch(e => { console.log('[DEBUG] loadStaff failed:', e.message); throw e; }),
      // ВАЖНО: Загружаем историю из Redis, а не из Supabase!
      contextService.getContext(phone.replace('@c.us', ''), companyId).then(ctx => {
        const messages = ctx?.lastMessages || ctx?.messages || [];
        console.log('[DEBUG] Redis context loaded, messages:', messages.length);
        // Преобразуем формат сообщений
        return messages.map(msg => ({
          sender: msg.sender || (msg.role === 'user' ? 'user' : 'bot'),
          text: msg.text || msg.content || '',
          timestamp: msg.timestamp
        }));
      }).catch(e => { 
        console.log('[DEBUG] loadConversation from Redis failed:', e.message); 
        return [];
      }),
      dataLoader.loadBusinessStats(companyId).catch(e => { console.log('[DEBUG] loadBusinessStats failed:', e.message); throw e; }),
      dataLoader.loadStaffSchedules(companyId).then(result => { console.log('[DEBUG] loadStaffSchedules success, keys:', Object.keys(result || {})); return result; }).catch(e => { console.log('[DEBUG] loadStaffSchedules failed:', e.message); return {}; }),
      contextService.getContext(phone.replace('@c.us', ''), companyId).catch(e => { console.log('[DEBUG] getContext failed:', e.message); throw e; }),
      dataLoader.loadClientPreferences(phone, companyId).catch(e => { console.log('[DEBUG] loadClientPreferences failed:', e.message); throw e; }),
      dataLoader.generateConversationSummary(phone, companyId).catch(e => { console.log('[DEBUG] generateConversationSummary failed:', e.message); throw e; }),
      intermediateContext.getIntermediateContext(phone).catch(e => { console.log('[DEBUG] getIntermediateContext failed:', e.message); throw e; })
    ]);
    
    // Отладочная информация по всем результатам Promise.all
    console.log('[DEBUG] Promise.all results:');
    console.log('[DEBUG] - company type:', typeof company);
    console.log('[DEBUG] - clientFromDb type:', typeof clientFromDb);
    console.log('[DEBUG] - services length:', services?.length);
    console.log('[DEBUG] - staff length:', staff?.length);
    console.log('[DEBUG] - conversation length:', conversation?.length);
    console.log('[DEBUG] - businessStats type:', typeof businessStats);
    console.log('[DEBUG] - staffSchedules type:', typeof staffSchedules, 'keys:', Object.keys(staffSchedules || {}));
    console.log('[DEBUG] - redisContext type:', typeof redisContext);
    console.log('[DEBUG] - preferences type:', typeof preferences);
    console.log('[DEBUG] - conversationSummary type:', typeof conversationSummary);
    console.log('[DEBUG] - intermediateCtx type:', typeof intermediateCtx);
    
    // Обогащаем клиента информацией из Redis
    const client = this.enrichClientData(clientFromDb, redisContext);
    
    // Сортируем услуги для клиента
    const sortedServices = await this.sortServicesForClient(services, client, businessStats);
    
    // Отладочная информация
    console.log(`[DEBUG CONTEXT] staffSchedules type:`, typeof staffSchedules);
    console.log(`[DEBUG CONTEXT] staffSchedules keys:`, Object.keys(staffSchedules || {}));
    console.log(`[DEBUG CONTEXT] staff count:`, staff?.length);
    
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
        score += config.contextManager.scoring.frequentService;
      }
      
      // Категория для новых клиентов
      if (!client && service.category?.toLowerCase().includes('стрижк')) {
        score += config.contextManager.scoring.hasBooking;
      }
      
      return { ...service, score };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Сохранение контекста
   */
  async saveContext(context) {
    const { phone, redisContext, companyId } = context;
    
    if (!phone) {
      logger.error('Cannot save context: phone is missing', { context: Object.keys(context) });
      return;
    }
    
    // Нормализуем номер телефона для сохранения
    const normalizedPhone = phone.replace('@c.us', '');
    
    // Сохраняем остальной контекст в Redis
    if (redisContext) {
      await contextService.setContext(normalizedPhone, companyId, redisContext);
    }
    
    // Обновляем кеши
    const cacheKey = `${phone}@${context.companyId}`;
    await this.saveToCache(cacheKey, context, normalizedPhone, context.companyId);
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
    await contextService.setCachedFullContext(phone, companyId, context);
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
  async waitForPreviousProcessing(phone, timeout = config.contextManager.processingTimeout) {
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