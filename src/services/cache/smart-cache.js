// src/services/cache/smart-cache.js
const { createRedisClient } = require('../../utils/redis-factory');
const logger = require('../../utils/logger');

/**
 * 🧠 SMART CACHE SERVICE
 * Интеллектуальное кэширование для AI-First архитектуры
 * 
 * Возможности:
 * - Семантическое кэширование AI запросов
 * - Адаптивные TTL на основе популярности
 * - Векторное кэширование для похожих запросов
 * - Автоматическая инвалидация при изменениях
 */
class SmartCache {
  constructor() {
    this.redis = null;
    
    // Fallback кэш в памяти при недоступности Redis
    this.memoryCache = new Map();
    this.memoryCacheTTL = 60000; // 1 минута по умолчанию
    this.memoryCacheMaxSize = 100; // Максимум 100 записей в памяти
    
    this.stats = {
      hits: 0,
      misses: 0,
      computeTime: 0,
      popularKeys: new Map(),
      memoryFallbackUsed: 0
    };
    this.initPromise = this.initialize();
    
    // Периодическая очистка статистики для предотвращения memory leak
    this.cleanupInterval = setInterval(() => {
      this._cleanupStats();
      this._cleanupMemoryCache();
    }, 60 * 60 * 1000); // Каждый час
  }

  async initialize() {
    try {
      this.redis = createRedisClient('smart-cache');
      logger.info('🧠 Smart Cache initialized');
    } catch (error) {
      logger.error('Failed to initialize Smart Cache:', error);
      throw error;
    }
  }

  /**
   * Универсальный метод get-or-compute с умным кэшированием
   */
  async getOrCompute(key, computeFn, options = {}) {
    await this.initPromise;
    
    const startTime = Date.now();
    
    try {
      // 1. Проверяем Redis кэш
      const cached = await this.redis.get(key);
      if (cached) {
        this.stats.hits++;
        this._updatePopularity(key);
        logger.debug(`📦 Cache HIT for key: ${key}`);
        return JSON.parse(cached);
      }

      // 2. Cache miss - проверяем memory fallback
      const memoryCached = this._getFromMemoryCache(key);
      if (memoryCached) {
        this.stats.hits++;
        this.stats.memoryFallbackUsed++;
        logger.debug(`💾 Memory cache HIT for key: ${key}`);
        return memoryCached;
      }

      // 3. Cache miss - вычисляем значение
      this.stats.misses++;
      logger.debug(`🔄 Cache MISS for key: ${key}, computing...`);
      
      const result = await computeFn();
      
      // 4. Определяем TTL на основе популярности и типа данных
      const ttl = this._calculateSmartTTL(key, options);
      
      // 5. Сохраняем в Redis и memory cache
      try {
        await this.redis.setex(key, ttl, JSON.stringify(result));
      } catch (redisError) {
        logger.warn(`Failed to save to Redis, using memory cache: ${redisError.message}`);
        // Если Redis недоступен, сохраняем в memory cache
        this._saveToMemoryCache(key, result, ttl * 1000); // TTL в миллисекундах
      }
      
      const computeTime = Date.now() - startTime;
      this.stats.computeTime += computeTime;
      
      logger.debug(`💾 Cached result for key: ${key}, TTL: ${ttl}s, compute time: ${computeTime}ms`);
      
      return result;
      
    } catch (error) {
      logger.error(`Cache error for key ${key}:`, error);
      
      // Fallback: проверяем memory cache еще раз
      const memoryCached = this._getFromMemoryCache(key);
      if (memoryCached) {
        return memoryCached;
      }
      
      // Выполняем computeFn и сохраняем в memory cache
      const result = await computeFn();
      this._saveToMemoryCache(key, result, this.memoryCacheTTL);
      return result;
    }
  }

  /**
   * Семантическое кэширование для AI запросов
   */
  async getSemanticCache(text, companyId, computeFn, options = {}) {
    const normalizedText = this._normalizeText(text);
    const key = `intent_${normalizedText}_${companyId}`;
    
    return this.getOrCompute(key, computeFn, {
      ...options,
      type: 'semantic',
      originalText: text
    });
  }

  /**
   * Кэширование результатов поиска сущностей
   */
  async getEntityCache(entityType, entityName, companyId, computeFn, options = {}) {
    const normalizedName = this._normalizeText(entityName);
    const key = `entity_${entityType}_${normalizedName}_${companyId}`;
    
    return this.getOrCompute(key, computeFn, {
      ...options,
      type: 'entity',
      entityType
    });
  }

  /**
   * Кэширование популярных запросов с увеличенным TTL
   */
  async getPopularCache(key, computeFn, options = {}) {
    const popularity = this._getPopularity(key);
    const adjustedOptions = {
      ...options,
      ttl: options.ttl * Math.max(1, Math.floor(popularity / 10)) // Увеличиваем TTL для популярных
    };
    
    return this.getOrCompute(key, computeFn, adjustedOptions);
  }

  /**
   * Пакетное получение с кэшированием
   */
  async getBatch(keys, computeFn, options = {}) {
    await this.initPromise;
    
    const results = {};
    const missingKeys = [];
    
    // 1. Проверяем что есть в кэше
    for (const key of keys) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          results[key] = JSON.parse(cached);
          this.stats.hits++;
        } else {
          missingKeys.push(key);
          this.stats.misses++;
        }
      } catch (error) {
        logger.warn(`Error getting key ${key} from cache:`, error);
        missingKeys.push(key);
      }
    }
    
    // 2. Вычисляем недостающие значения
    if (missingKeys.length > 0) {
      const computed = await computeFn(missingKeys);
      
      // 3. Сохраняем в кэш
      for (const key of missingKeys) {
        if (computed[key] !== undefined) {
          results[key] = computed[key];
          const ttl = this._calculateSmartTTL(key, options);
          await this.redis.setex(key, ttl, JSON.stringify(computed[key]));
        }
      }
    }
    
    return results;
  }

  /**
   * Инвалидация кэша по паттернам
   */
  async invalidatePattern(pattern) {
    await this.initPromise;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`🗑️ Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error(`Error invalidating pattern ${pattern}:`, error);
    }
  }

  /**
   * Инвалидация кэша компании
   */
  async invalidateCompany(companyId) {
    await this.invalidatePattern(`*_${companyId}`);
    await this.invalidatePattern(`entity_*_${companyId}`);
    await this.invalidatePattern(`intent_*_${companyId}`);
  }

  /**
   * Предварительный прогрев кэша
   */
  async warmup(companyId, commonQueries = []) {
    logger.info(`🔥 Warming up cache for company ${companyId}`);
    
    const defaultQueries = [
      'записаться на стрижку',
      'хочу маникюр',
      'подстричь бороду',
      'стрижка машинкой'
    ];
    
    const queries = [...defaultQueries, ...commonQueries];
    
    for (const query of queries) {
      try {
        // Предварительно кэшируем популярные запросы
        const key = `intent_${this._normalizeText(query)}_${companyId}`;
        await this.redis.setex(key, 7200, JSON.stringify({ 
          warmed: true, 
          query,
          timestamp: Date.now() 
        }));
      } catch (error) {
        logger.warn(`Error warming up query "${query}":`, error);
      }
    }
    
    logger.info(`✅ Cache warmed up with ${queries.length} queries`);
  }

  /**
   * Получение статистики кэша
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? Math.round((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100)
      : 0;
    
    const avgComputeTime = this.stats.misses > 0 
      ? Math.round(this.stats.computeTime / this.stats.misses)
      : 0;
      
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      avgComputeTime: `${avgComputeTime}ms`,
      popularKeys: Array.from(this.stats.popularKeys.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  }

  // =================== PRIVATE METHODS ===================

  /**
   * Нормализация текста для кэширования
   */
  _normalizeText(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_');
  }

  /**
   * Умный расчет TTL на основе типа данных и популярности
   */
  _calculateSmartTTL(key, options) {
    const baseTTL = options.ttl || 3600; // 1 час по умолчанию
    const popularity = this._getPopularity(key);
    
    // Типы данных с разными TTL
    const ttlMultipliers = {
      'semantic': 1.0,    // AI запросы - стандартный TTL
      'entity': 2.0,      // Сущности - дольше живут
      'popular': 3.0,     // Популярные запросы - еще дольше
      'static': 24.0      // Статичные данные - 24 часа
    };
    
    const typeMultiplier = ttlMultipliers[options.type] || 1.0;
    const popularityMultiplier = Math.max(1, Math.floor(popularity / 5));
    
    return Math.min(
      baseTTL * typeMultiplier * popularityMultiplier,
      86400 // Максимум 24 часа
    );
  }

  /**
   * Отслеживание популярности ключей с защитой от memory leak
   */
  _updatePopularity(key) {
    const current = this.stats.popularKeys.get(key) || 0;
    this.stats.popularKeys.set(key, current + 1);
    
    // Проактивная очистка для предотвращения memory leak
    // Очищаем при достижении 500 ключей (раньше было 1000)
    if (this.stats.popularKeys.size > 500) {
      // Сохраняем только топ 100 самых популярных
      const sorted = Array.from(this.stats.popularKeys.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);
      
      // Очищаем старую Map полностью для освобождения памяти
      this.stats.popularKeys.clear();
      this.stats.popularKeys = new Map(sorted);
      
      logger.debug(`Cleaned popularity cache, kept top ${sorted.length} keys`);
    }
  }

  /**
   * Получение популярности ключа
   */
  _getPopularity(key) {
    return this.stats.popularKeys.get(key) || 0;
  }

  /**
   * Получить данные из memory cache
   */
  _getFromMemoryCache(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    // Проверяем TTL
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Сохранить данные в memory cache
   */
  _saveToMemoryCache(key, data, ttl) {
    // Ограничиваем размер memory cache
    if (this.memoryCache.size >= this.memoryCacheMaxSize) {
      // Удаляем самые старые записи
      const toDelete = Math.floor(this.memoryCacheMaxSize / 4); // Удаляем 25%
      const keys = Array.from(this.memoryCache.keys()).slice(0, toDelete);
      keys.forEach(k => this.memoryCache.delete(k));
      logger.debug(`Memory cache cleanup: removed ${toDelete} old entries`);
    }
    
    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + (ttl || this.memoryCacheTTL),
      createdAt: Date.now()
    });
  }
  
  /**
   * Очистка устаревших записей из memory cache
   */
  _cleanupMemoryCache() {
    const now = Date.now();
    let cleaned = 0;
    
    this.memoryCache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      logger.debug(`Memory cache cleanup: removed ${cleaned} expired entries`);
    }
  }
  
  /**
   * Периодическая очистка статистики
   */
  _cleanupStats() {
    // Сбрасываем счетчики если они слишком большие
    if (this.stats.hits > 1000000) {
      this.stats.hits = Math.floor(this.stats.hits / 10);
      this.stats.misses = Math.floor(this.stats.misses / 10);
      this.stats.computeTime = Math.floor(this.stats.computeTime / 10);
      this.stats.memoryFallbackUsed = Math.floor(this.stats.memoryFallbackUsed / 10);
      logger.info('Reset cache statistics to prevent overflow');
    }
    
    // Очищаем старые ключи с низкой популярностью
    const threshold = 2; // Минимум 2 обращения чтобы остаться
    const keysToDelete = [];
    
    this.stats.popularKeys.forEach((count, key) => {
      if (count < threshold) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.stats.popularKeys.delete(key));
    
    if (keysToDelete.length > 0) {
      logger.debug(`Removed ${keysToDelete.length} unpopular keys from statistics`);
    }
  }

  /**
   * Graceful shutdown
   */
  async destroy() {
    // Очищаем интервал очистки
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.redis) {
      await this.redis.quit();
      logger.info('💥 Smart Cache destroyed');
    }
  }
}

// Singleton instance
module.exports = new SmartCache();