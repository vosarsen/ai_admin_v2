// src/utils/local-cache.js
const NodeCache = require('node-cache');
const logger = require('./logger').child({ module: 'local-cache' });

/**
 * Локальный in-memory кэш для часто используемых данных
 * Снижает количество запросов к БД и Redis
 */
class LocalCache {
  constructor(options = {}) {
    // Настройки по умолчанию
    this.options = {
      defaultTTL: options.defaultTTL || 300, // 5 минут по умолчанию
      checkPeriod: options.checkPeriod || 60, // Проверка истекших ключей каждую минуту
      maxKeys: options.maxKeys || 1000, // Максимум 1000 ключей
      deleteOnExpire: true,
      useClones: false // Не клонировать объекты для производительности
    };

    // Создаем отдельные кэши для разных типов данных
    this.caches = {
      // Контексты пользователей (TTL 5 минут)
      context: new NodeCache({
        stdTTL: this.options.defaultTTL,
        checkperiod: this.options.checkPeriod,
        deleteOnExpire: this.options.deleteOnExpire,
        useClones: this.options.useClones
      }),
      
      // Данные компаний (TTL 10 минут)
      company: new NodeCache({
        stdTTL: 600,
        checkperiod: 120,
        deleteOnExpire: true,
        useClones: false
      }),
      
      // Услуги и персонал (TTL 15 минут)
      services: new NodeCache({
        stdTTL: 900,
        checkperiod: 180,
        deleteOnExpire: true,
        useClones: false
      }),
      
      // Клиенты (TTL 10 минут)
      clients: new NodeCache({
        stdTTL: 600,
        checkperiod: 120,
        deleteOnExpire: true,
        useClones: false
      }),
      
      // Слоты для записи (TTL 2 минуты - часто меняются)
      slots: new NodeCache({
        stdTTL: 120,
        checkperiod: 30,
        deleteOnExpire: true,
        useClones: false
      })
    };

    // Счетчики для мониторинга
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };

    // Подписываемся на события для сбора статистики
    Object.entries(this.caches).forEach(([name, cache]) => {
      cache.on('expired', (key, value) => {
        this.stats.evictions++;
        logger.debug(`Cache expired: ${name}:${key}`);
      });
      
      cache.on('flush', () => {
        logger.info(`Cache flushed: ${name}`);
      });
    });
  }

  /**
   * Получить значение из кэша
   */
  get(cacheType, key) {
    if (!this.caches[cacheType]) {
      logger.warn(`Unknown cache type: ${cacheType}`);
      return null;
    }

    const value = this.caches[cacheType].get(key);
    
    if (value !== undefined) {
      this.stats.hits++;
      logger.debug(`Cache hit: ${cacheType}:${key}`);
      return value;
    }
    
    this.stats.misses++;
    logger.debug(`Cache miss: ${cacheType}:${key}`);
    return null;
  }

  /**
   * Сохранить значение в кэш
   */
  set(cacheType, key, value, ttl = null) {
    if (!this.caches[cacheType]) {
      logger.warn(`Unknown cache type: ${cacheType}`);
      return false;
    }

    try {
      const success = ttl 
        ? this.caches[cacheType].set(key, value, ttl)
        : this.caches[cacheType].set(key, value);
      
      if (success) {
        this.stats.sets++;
        logger.debug(`Cache set: ${cacheType}:${key}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Cache set error: ${cacheType}:${key}`, error);
      return false;
    }
  }

  /**
   * Удалить значение из кэша
   */
  delete(cacheType, key) {
    if (!this.caches[cacheType]) {
      logger.warn(`Unknown cache type: ${cacheType}`);
      return false;
    }

    const deleted = this.caches[cacheType].del(key);
    if (deleted > 0) {
      this.stats.deletes++;
      logger.debug(`Cache delete: ${cacheType}:${key}`);
    }
    
    return deleted > 0;
  }

  /**
   * Очистить весь кэш определенного типа
   */
  flush(cacheType = null) {
    if (cacheType) {
      if (this.caches[cacheType]) {
        this.caches[cacheType].flushAll();
        logger.info(`Cache flushed: ${cacheType}`);
      }
    } else {
      // Очистить все кэши
      Object.entries(this.caches).forEach(([name, cache]) => {
        cache.flushAll();
      });
      logger.info('All caches flushed');
    }
  }

  /**
   * Получить или вычислить значение (cache-aside pattern)
   */
  async getOrSet(cacheType, key, factory, ttl = null) {
    // Пробуем получить из кэша
    const cached = this.get(cacheType, key);
    if (cached !== null) {
      return cached;
    }

    // Вычисляем значение
    try {
      const value = await factory();
      
      // Сохраняем в кэш
      if (value !== null && value !== undefined) {
        this.set(cacheType, key, value, ttl);
      }
      
      return value;
    } catch (error) {
      logger.error(`Factory error for ${cacheType}:${key}`, error);
      throw error;
    }
  }

  /**
   * Инвалидировать связанные кэши
   */
  invalidateRelated(entityType, entityId) {
    switch (entityType) {
      case 'client':
        // При изменении клиента инвалидируем его контекст
        this.delete('clients', `client:${entityId}`);
        this.delete('context', `context:${entityId}:*`);
        break;
        
      case 'booking':
        // При изменении записи инвалидируем слоты
        this.flush('slots');
        break;
        
      case 'service':
      case 'staff':
        // При изменении услуг/персонала
        this.flush('services');
        this.flush('slots');
        break;
        
      case 'company':
        // При изменении компании очищаем все
        this.flush();
        break;
    }
  }

  /**
   * Получить статистику кэша
   */
  getStats() {
    const cacheStats = {};
    
    Object.entries(this.caches).forEach(([name, cache]) => {
      cacheStats[name] = {
        keys: cache.keys().length,
        hits: cache.getStats().hits,
        misses: cache.getStats().misses,
        ksize: cache.getStats().ksize,
        vsize: cache.getStats().vsize
      };
    });

    const hitRate = this.stats.hits > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      overall: {
        ...this.stats,
        hitRate: `${hitRate}%`
      },
      caches: cacheStats
    };
  }

  /**
   * Обертка для кэширования результатов функций
   */
  memoize(cacheType, keyPrefix, fn, ttl = null) {
    return async (...args) => {
      // Создаем ключ из аргументов
      const key = `${keyPrefix}:${JSON.stringify(args)}`;
      
      return this.getOrSet(cacheType, key, () => fn(...args), ttl);
    };
  }
}

// Создаем singleton экземпляр
const localCache = new LocalCache({
  defaultTTL: 300, // 5 минут
  checkPeriod: 60, // Проверка каждую минуту
  maxKeys: 1000
});

// Экспортируем и экземпляр, и класс
module.exports = localCache;
module.exports.LocalCache = LocalCache;