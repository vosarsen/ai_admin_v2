// src/middlewares/rate-limiter.js
const smartCache = require('../services/cache/smart-cache');
const logger = require('../utils/logger');

/**
 * 🛡️ SMART RATE LIMITER
 * Защита от spam и rapid-fire атак с использованием Redis
 * 
 * Возможности:
 * - Sliding window rate limiting
 * - Per-phone number limits
 * - Burst protection
 * - Smart caching для performance
 */
class SmartRateLimiter {
  constructor(options = {}) {
    this.limits = {
      // Основные лимиты (по ТЗ: 30 запросов/минуту на номер)
      perMinute: options.perMinute || 30,
      perHour: options.perHour || 150,
      perDay: options.perDay || 500,
      
      // Burst protection
      burstLimit: options.burstLimit || 5,    // Максимум 5 запросов за 10 секунд
      burstWindow: options.burstWindow || 10, // 10 секунд
      
      // Global limits
      globalPerMinute: options.globalPerMinute || 1000,
      globalPerHour: options.globalPerHour || 10000
    };
    
    this.redis = null;
    this.fallbackMode = false;
    this.memoryStore = new Map(); // Fallback для случаев когда Redis недоступен
    
    this.initPromise = this.initialize();
  }

  async initialize() {
    try {
      // Используем существующий Redis через smart cache
      await smartCache.initPromise;
      this.redis = smartCache.redis;
      logger.info('🛡️ Smart Rate Limiter initialized with Redis');
    } catch (error) {
      logger.error('Rate limiter Redis init failed, using memory fallback:', error);
      this.fallbackMode = true;
    }
  }

  /**
   * Основной middleware для rate limiting
   */
  middleware() {
    return async (req, res, next) => {
      await this.initPromise;
      
      try {
        const identifier = this._getIdentifier(req);
        const isAllowed = await this._checkRateLimit(identifier, req);
        
        if (!isAllowed.allowed) {
          logger.warn(`🚫 Rate limit exceeded for ${identifier}:`, isAllowed);
          
          return res.status(429).json({
            success: false,
            error: 'Слишком много запросов. Попробуйте через минуту.',
            retryAfter: isAllowed.retryAfter || 60,
            details: isAllowed
          });
        }
        
        // Добавляем заголовки с информацией о лимитах
        res.set({
          'X-RateLimit-Limit': this.limits.perMinute,
          'X-RateLimit-Remaining': isAllowed.remaining || 0,
          'X-RateLimit-Reset': isAllowed.resetTime || Date.now() + 60000
        });
        
        next();
        
      } catch (error) {
        logger.error('Rate limiter error:', error);
        // В случае ошибки пропускаем запрос (fail open)
        next();
      }
    };
  }

  /**
   * Проверка rate limit для идентификатора
   */
  async _checkRateLimit(identifier, req) {
    const now = Date.now();
    const checks = [
      { 
        key: `rate:burst:${identifier}`, 
        limit: this.limits.burstLimit, 
        window: this.limits.burstWindow * 1000,
        type: 'burst'
      },
      { 
        key: `rate:minute:${identifier}`, 
        limit: this.limits.perMinute, 
        window: 60 * 1000,
        type: 'minute'
      },
      { 
        key: `rate:hour:${identifier}`, 
        limit: this.limits.perHour, 
        window: 60 * 60 * 1000,
        type: 'hour'
      },
      { 
        key: `rate:day:${identifier}`, 
        limit: this.limits.perDay, 
        window: 24 * 60 * 60 * 1000,
        type: 'day'
      }
    ];

    // Проверяем каждый лимит
    for (const check of checks) {
      const result = await this._checkSlidingWindow(check.key, check.limit, check.window, now);
      
      if (!result.allowed) {
        logger.info(`🚫 Rate limit hit: ${check.type} limit for ${identifier}`);
        return {
          allowed: false,
          type: check.type,
          limit: check.limit,
          current: result.current,
          retryAfter: Math.ceil(result.retryAfter / 1000),
          resetTime: now + result.retryAfter
        };
      }
    }

    // Проверяем global limits
    const globalMinute = await this._checkSlidingWindow(
      'rate:global:minute', 
      this.limits.globalPerMinute, 
      60 * 1000, 
      now
    );
    
    if (!globalMinute.allowed) {
      logger.warn('🚫 Global rate limit exceeded');
      return {
        allowed: false,
        type: 'global',
        retryAfter: 60
      };
    }

    // Все проверки пройдены
    return {
      allowed: true,
      remaining: Math.min(
        this.limits.perMinute - (await this._getCurrentCount(`rate:minute:${identifier}`, 60 * 1000, now)),
        this.limits.perHour - (await this._getCurrentCount(`rate:hour:${identifier}`, 60 * 60 * 1000, now))
      ),
      resetTime: now + 60000
    };
  }

  /**
   * Sliding window rate limiting algorithm
   */
  async _checkSlidingWindow(key, limit, windowMs, now) {
    const windowStart = now - windowMs;
    
    if (this.fallbackMode) {
      return this._checkSlidingWindowMemory(key, limit, windowMs, now);
    }

    try {
      // 1. Удаляем старые записи
      await this.redis.zremrangebyscore(key, 0, windowStart);
      
      // 2. Считаем текущие запросы
      const current = await this.redis.zcard(key);
      
      if (current >= limit) {
        // 3. Находим время до сброса
        const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        const retryAfter = oldest.length > 0 ? 
          (parseInt(oldest[1]) + windowMs) - now : 
          windowMs;
          
        return {
          allowed: false,
          current,
          retryAfter: Math.max(1000, retryAfter) // Минимум 1 секунда
        };
      }
      
      // 4. Добавляем текущий запрос
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      
      // 5. Устанавливаем TTL
      await this.redis.expire(key, Math.ceil(windowMs / 1000) + 10);
      
      return {
        allowed: true,
        current: current + 1
      };
      
    } catch (error) {
      logger.error('Redis sliding window error:', error);
      // Fallback к memory
      return this._checkSlidingWindowMemory(key, limit, windowMs, now);
    }
  }

  /**
   * Memory fallback для sliding window
   */
  _checkSlidingWindowMemory(key, limit, windowMs, now) {
    if (!this.memoryStore.has(key)) {
      this.memoryStore.set(key, []);
    }
    
    const requests = this.memoryStore.get(key);
    const windowStart = now - windowMs;
    
    // Удаляем старые записи
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= limit) {
      const retryAfter = (validRequests[0] + windowMs) - now;
      return {
        allowed: false,
        current: validRequests.length,
        retryAfter: Math.max(1000, retryAfter)
      };
    }
    
    // Добавляем текущий запрос
    validRequests.push(now);
    this.memoryStore.set(key, validRequests);
    
    return {
      allowed: true,
      current: validRequests.length
    };
  }

  /**
   * Получение текущего количества запросов
   */
  async _getCurrentCount(key, windowMs, now) {
    const windowStart = now - windowMs;
    
    if (this.fallbackMode) {
      const requests = this.memoryStore.get(key) || [];
      return requests.filter(time => time > windowStart).length;
    }
    
    try {
      await this.redis.zremrangebyscore(key, 0, windowStart);
      return await this.redis.zcard(key);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Извлечение идентификатора для rate limiting
   */
  _getIdentifier(req) {
    // Для WhatsApp webhook - используем номер телефона
    if (req.body && req.body.from) {
      return req.body.from.replace('@c.us', '');
    }
    
    // Для API запросов - используем IP
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Получение статистики rate limiter
   */
  async getStats() {
    const now = Date.now();
    const stats = {
      mode: this.fallbackMode ? 'memory' : 'redis',
      limits: this.limits,
      timestamp: now
    };
    
    if (this.fallbackMode) {
      stats.memoryKeys = this.memoryStore.size;
    } else {
      try {
        const keys = await this.redis.keys('rate:*');
        stats.redisKeys = keys.length;
      } catch (error) {
        stats.redisKeys = 'error';
      }
    }
    
    return stats;
  }

  /**
   * Очистка данных rate limiter
   */
  async clear(identifier = null) {
    if (identifier) {
      const patterns = [
        `rate:burst:${identifier}`,
        `rate:minute:${identifier}`,
        `rate:hour:${identifier}`,
        `rate:day:${identifier}`
      ];
      
      if (this.fallbackMode) {
        patterns.forEach(key => this.memoryStore.delete(key));
      } else {
        try {
          await this.redis.del(...patterns);
        } catch (error) {
          logger.error('Error clearing rate limit:', error);
        }
      }
      
      logger.info(`🗑️ Cleared rate limits for ${identifier}`);
    } else {
      // Очистка всех данных
      if (this.fallbackMode) {
        this.memoryStore.clear();
      } else {
        try {
          const keys = await this.redis.keys('rate:*');
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } catch (error) {
          logger.error('Error clearing all rate limits:', error);
        }
      }
      
      logger.info('🗑️ Cleared all rate limits');
    }
  }
}

// Создаем и экспортируем singleton
const rateLimiter = new SmartRateLimiter();
module.exports = rateLimiter.middleware();
