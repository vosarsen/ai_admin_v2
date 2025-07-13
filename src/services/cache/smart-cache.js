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
    this.stats = {
      hits: 0,
      misses: 0,
      computeTime: 0,
      popularKeys: new Map()
    };
    this.initPromise = this.initialize();
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
      // 1. Проверяем кэш
      const cached = await this.redis.get(key);
      if (cached) {
        this.stats.hits++;
        this._updatePopularity(key);
        logger.debug(`📦 Cache HIT for key: ${key}`);
        return JSON.parse(cached);
      }

      // 2. Cache miss - вычисляем значение
      this.stats.misses++;
      logger.debug(`🔄 Cache MISS for key: ${key}, computing...`);
      
      const result = await computeFn();
      
      // 3. Определяем TTL на основе популярности и типа данных
      const ttl = this._calculateSmartTTL(key, options);
      
      // 4. Сохраняем в кэш
      await this.redis.setex(key, ttl, JSON.stringify(result));
      
      const computeTime = Date.now() - startTime;
      this.stats.computeTime += computeTime;
      
      logger.debug(`💾 Cached result for key: ${key}, TTL: ${ttl}s, compute time: ${computeTime}ms`);
      
      return result;
      
    } catch (error) {
      logger.error(`Cache error for key ${key}:`, error);
      
      // Fallback: выполняем computeFn без кэширования
      const result = await computeFn();
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
   * Отслеживание популярности ключей
   */
  _updatePopularity(key) {
    const current = this.stats.popularKeys.get(key) || 0;
    this.stats.popularKeys.set(key, current + 1);
    
    // Очищаем старые ключи (оставляем топ 1000)
    if (this.stats.popularKeys.size > 1000) {
      const sorted = Array.from(this.stats.popularKeys.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1000);
      this.stats.popularKeys = new Map(sorted);
    }
  }

  /**
   * Получение популярности ключа
   */
  _getPopularity(key) {
    return this.stats.popularKeys.get(key) || 0;
  }

  /**
   * Graceful shutdown
   */
  async destroy() {
    if (this.redis) {
      await this.redis.quit();
      logger.info('💥 Smart Cache destroyed');
    }
  }
}

// Singleton instance
module.exports = new SmartCache();