// src/services/context/index.js
const { createRedisClient } = require('../../utils/redis-factory');
const config = require('../../config');
const logger = require('../../utils/logger');
const DataTransformers = require('../../utils/data-transformers');

class ContextService {
  constructor() {
    // Используем фабрику для создания Redis клиента с правильной конфигурацией
    const redisClient = createRedisClient('context');
    
    // Сохраняем прямую ссылку на клиент для операций без префикса
    this.redisRaw = redisClient;
    
    // Добавляем keyPrefix через proxy для сохранения функциональности
    this.redis = new Proxy(redisClient, {
      get(target, prop) {
        if (typeof target[prop] === 'function') {
          return function(...args) {
            // Добавляем префикс к первому аргументу (ключу) для методов работы с ключами
            const keyCommands = [
              'get', 'set', 'del', 'expire', 'ttl', 'exists', 'mget', 'mset',
              'lpush', 'rpush', 'lpop', 'rpop', 'lrange', 'ltrim', 'llen',
              'hget', 'hset', 'hdel', 'hgetall', 'hmset'
            ];
            
            if (keyCommands.includes(prop) && args[0] && typeof args[0] === 'string') {
              args[0] = `context:${args[0]}`;
            }
            return target[prop].apply(target, args);
          };
        }
        return target[prop];
      }
    });
    
    this.contextTTL = 30 * 24 * 60 * 60; // 30 days
    this.maxMessages = 50; // Keep last 50 messages for better context
    this.shortTTL = 24 * 60 * 60; // 24 hours for temporary data
    this.preferenceTTL = 365 * 24 * 60 * 60; // 1 year for preferences
  }

  /**
   * Get full context for conversation
   */
  async getContext(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const contextKey = `${companyId}:${normalizedPhone}`;
    
    try {
      // Get all context data in parallel
      const [
        client,
        messages,
        services,
        staff,
        lastBooking,
        contextData
      ] = await Promise.all([
        this._getClient(normalizedPhone, companyId),
        this._getMessages(contextKey),
        this._getServices(companyId),
        this._getStaff(companyId),
        this._getLastBooking(normalizedPhone, companyId),
        this.redis.hgetall(contextKey)
      ]);

      // Логируем что получили из Redis
      logger.info('Context data from Redis:', {
        contextKey,
        hasContextData: !!contextData,
        contextKeys: Object.keys(contextData || {}),
        dataField: contextData?.data,
        fullData: JSON.stringify(contextData)
      });
      
      // Если клиент не найден в кэше, но есть имя в контексте
      let finalClient = client;
      if (!finalClient && contextData) {
        let savedData = {};
        try {
          savedData = contextData.data ? JSON.parse(contextData.data) : {};
        } catch (e) {
          logger.error('Failed to parse context data:', e);
        }
        
        logger.info('Parsed context data:', {
          savedData,
          hasClientName: !!savedData.clientName
        });
        
        if (savedData.clientName) {
          finalClient = {
            phone: normalizedPhone,
            name: savedData.clientName,
            company_id: companyId
          };
          logger.info(`Found client name in context data: ${savedData.clientName}`);
        }
      }

      return {
        phone: normalizedPhone,
        companyId,
        client: finalClient,
        lastMessages: messages,
        services,
        staff,
        lastBooking,
        timestamp: new Date().toISOString(),
        // Добавляем сохраненное имя для обратной совместимости
        clientName: finalClient?.name || contextData?.clientName
      };
    } catch (error) {
      logger.error('Failed to get context:', error);
      // Return minimal context on error
      return {
        phone: normalizedPhone,
        companyId,
        client: null,
        lastMessages: [],
        services: [],
        staff: [],
        lastBooking: null,
        error: error.message
      };
    }
  }

  /**
   * Update context after message processing
   */
  async updateContext(phone, companyId, update) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const contextKey = `${companyId}:${normalizedPhone}`;
    
    try {
      // Update last message
      if (update.lastMessage) {
        await this._addMessage(contextKey, update.lastMessage);
      }
      
      // Update client info if needed
      if (update.clientInfo) {
        await this._updateClient(normalizedPhone, companyId, update.clientInfo);
      }
      
      // Update last action
      if (update.lastAction) {
        await this.redis.hset(contextKey, 'lastAction', JSON.stringify({
          action: update.lastAction,
          result: update.actionResult,
          timestamp: new Date().toISOString()
        }));
      }
      
      // Refresh TTL
      await this.redis.expire(contextKey, this.contextTTL);
      
      logger.debug(`Context updated for ${normalizedPhone}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to update context:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get conversation messages
   */
  async _getMessages(contextKey) {
    try {
      const messages = await this.redis.lrange(`${contextKey}:messages`, 0, -1);
      return messages.map(msg => JSON.parse(msg)).reverse(); // Newest first
    } catch (error) {
      logger.error('Failed to get messages:', error);
      return [];
    }
  }

  /**
   * Add message to conversation
   */
  async _addMessage(contextKey, message) {
    const messageData = JSON.stringify({
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    });
    
    // Add to list
    await this.redis.lpush(`${contextKey}:messages`, messageData);
    
    // Trim to max messages
    await this.redis.ltrim(`${contextKey}:messages`, 0, this.maxMessages - 1);
    
    // Set TTL
    await this.redis.expire(`${contextKey}:messages`, this.contextTTL);
  }

  /**
   * Get client info from cache or database
   */
  async _getClient(phone, companyId) {
    try {
      // Check cache first
      // Note: Proxy уже добавляет префикс 'context:', поэтому не нужно его дублировать
      const cached = await this.redis.hget(`clients:${companyId}`, phone);
      if (cached) {
        logger.debug(`Found client in Redis cache for ${phone}`);
        return JSON.parse(cached);
      }
      
      // TODO: Fetch from Supabase if not in cache
      // For now, return null (new client)
      logger.debug(`No client found in cache for ${phone}`);
      return null;
    } catch (error) {
      logger.error('Failed to get client:', error);
      return null;
    }
  }

  /**
   * Update client info in cache
   */
  async _updateClient(phone, companyId, clientInfo) {
    try {
      const data = {
        ...clientInfo,
        lastUpdated: new Date().toISOString()
      };
      
      logger.debug(`Updating client in Redis: ${phone} in clients:${companyId}`, data);
      
      await this.redis.hset(
        `clients:${companyId}`, 
        phone, 
        JSON.stringify(data)
      );
      
      // Set TTL on the hash
      await this.redis.expire(`clients:${companyId}`, 7 * 24 * 60 * 60); // 7 days
      
      logger.info(`Client info saved in Redis for ${phone}`);
    } catch (error) {
      logger.error('Failed to update client:', error);
    }
  }

  /**
   * Get services from cache
   */
  async _getServices(companyId) {
    try {
      const cached = await this.redis.get(`services:${companyId}`);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // TODO: Fetch from YClients/Supabase if not in cache
      return [];
    } catch (error) {
      logger.error('Failed to get services:', error);
      return [];
    }
  }

  /**
   * Get staff from cache
   */
  async _getStaff(companyId) {
    try {
      const cached = await this.redis.get(`staff:${companyId}`);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // TODO: Fetch from YClients/Supabase if not in cache
      return [];
    } catch (error) {
      logger.error('Failed to get staff:', error);
      return [];
    }
  }

  /**
   * Get last booking info
   */
  async _getLastBooking(phone, companyId) {
    try {
      const bookingKey = `bookings:${companyId}:${phone}:last`;
      const cached = await this.redis.get(bookingKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // TODO: Fetch from database if not in cache
      return null;
    } catch (error) {
      logger.error('Failed to get last booking:', error);
      return null;
    }
  }

  /**
   * Cache services data
   */
  async cacheServices(companyId, services) {
    try {
      await this.redis.setex(
        `services:${companyId}`,
        30 * 60, // 30 minutes
        JSON.stringify(services)
      );
      logger.debug(`Cached ${services.length} services for company ${companyId}`);
    } catch (error) {
      logger.error('Failed to cache services:', error);
    }
  }

  /**
   * Cache staff data
   */
  async cacheStaff(companyId, staff) {
    try {
      await this.redis.setex(
        `staff:${companyId}`,
        30 * 60, // 30 minutes
        JSON.stringify(staff)
      );
      logger.debug(`Cached ${staff.length} staff for company ${companyId}`);
    } catch (error) {
      logger.error('Failed to cache staff:', error);
    }
  }

  /**
   * Save booking to context
   */
  async saveBooking(phone, companyId, booking) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    
    try {
      // Save as last booking
      await this.redis.setex(
        `bookings:${companyId}:${normalizedPhone}:last`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify({
          ...booking,
          savedAt: new Date().toISOString()
        })
      );
      
      // Add to booking history list
      await this.redis.lpush(
        `bookings:${companyId}:${normalizedPhone}:history`,
        JSON.stringify(booking)
      );
      
      // Keep only last 10 bookings
      await this.redis.ltrim(
        `bookings:${companyId}:${normalizedPhone}:history`,
        0, 9
      );
      
      logger.debug(`Saved booking for ${normalizedPhone}`);
    } catch (error) {
      logger.error('Failed to save booking:', error);
    }
  }

  /**
   * Set full context (missing method implementation)
   */
  async setContext(phone, companyId, contextData) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const contextKey = `${companyId}:${normalizedPhone}`;
    
    try {
      // Save main context data - использовать правильный формат для hset
      await this.redis.hset(contextKey, 
        'phone', normalizedPhone,
        'companyId', companyId,
        'lastActivity', new Date().toISOString(),
        'state', contextData.state || 'active',
        'data', JSON.stringify(contextData.data || {})
      );
      
      // Set TTL
      await this.redis.expire(contextKey, this.contextTTL);
      
      logger.debug(`Context set for ${normalizedPhone}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to set context:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save user preferences
   */
  async savePreferences(phone, companyId, preferences) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const prefKey = `preferences:${companyId}:${normalizedPhone}`;
    
    try {
      const existingPrefs = await this.redis.get(prefKey);
      const currentPrefs = existingPrefs ? JSON.parse(existingPrefs) : {};
      
      const updatedPrefs = {
        ...currentPrefs,
        ...preferences,
        lastUpdated: new Date().toISOString()
      };
      
      await this.redis.setex(
        prefKey,
        this.preferenceTTL,
        JSON.stringify(updatedPrefs)
      );
      
      logger.debug(`Preferences saved for ${normalizedPhone}:`, updatedPrefs);
      return { success: true, preferences: updatedPrefs };
    } catch (error) {
      logger.error('Failed to save preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const prefKey = `preferences:${companyId}:${normalizedPhone}`;
    
    try {
      const prefs = await this.redis.get(prefKey);
      return prefs ? JSON.parse(prefs) : null;
    } catch (error) {
      logger.error('Failed to get preferences:', error);
      return null;
    }
  }

  /**
   * Check if conversation can be continued
   */
  async canContinueConversation(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const contextKey = `${companyId}:${normalizedPhone}`;
    
    try {
      // Check if context exists
      const exists = await this.redis.exists(contextKey);
      if (!exists) return false;
      
      // Get last activity
      const lastActivity = await this.redis.hget(contextKey, 'lastActivity');
      if (!lastActivity) return false;
      
      // Check if conversation is not too old (e.g., last activity within 24 hours)
      const lastActivityTime = new Date(lastActivity);
      const hoursSinceLastActivity = (Date.now() - lastActivityTime.getTime()) / (1000 * 60 * 60);
      
      return hoursSinceLastActivity < 24;
    } catch (error) {
      logger.error('Failed to check conversation continuity:', error);
      return false;
    }
  }

  /**
   * Get conversation summary for continuation
   */
  async getConversationSummary(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const contextKey = `${companyId}:${normalizedPhone}`;
    
    try {
      const [messages, lastBooking, preferences] = await Promise.all([
        this._getMessages(contextKey),
        this._getLastBooking(normalizedPhone, companyId),
        this.getPreferences(normalizedPhone, companyId)
      ]);
      
      // Get last few messages for context
      const recentMessages = messages.slice(0, 5);
      
      return {
        hasHistory: messages.length > 0,
        messageCount: messages.length,
        recentMessages,
        lastBooking,
        preferences,
        canContinue: await this.canContinueConversation(phone, companyId)
      };
    } catch (error) {
      logger.error('Failed to get conversation summary:', error);
      return null;
    }
  }

  /**
   * Get cached full context from Redis
   */
  async getCachedFullContext(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const cacheKey = `full_context:${companyId}:${normalizedPhone}`;
    
    try {
      logger.debug(`Looking for cached context with key: ${cacheKey}`);
      const cached = await this.redisRaw.get(cacheKey);
      if (cached) {
        logger.info(`Full context found in Redis cache, size: ${cached.length} bytes`);
        return JSON.parse(cached);
      }
      logger.debug(`No cached context found for key: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.error('Error getting cached context:', error);
      return null;
    }
  }

  /**
   * Set cached full context in Redis with TTL
   */
  async setCachedFullContext(phone, companyId, context, ttl = 12 * 60 * 60) {
    logger.debug(`setCachedFullContext called with phone: "${phone}", companyId: ${companyId}`);
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    logger.debug(`Normalized phone: "${normalizedPhone}" from "${phone}"`);
    const cacheKey = `full_context:${companyId}:${normalizedPhone}`;
    
    try {
      const contextStr = JSON.stringify(context);
      logger.debug(`Caching context with key: ${cacheKey}, size: ${contextStr.length} bytes, TTL: ${ttl}s`);
      await this.redisRaw.setex(
        cacheKey,
        ttl, // 12 часов по умолчанию
        contextStr
      );
      logger.info(`Full context cached in Redis with key: ${cacheKey}`);
      return true;
    } catch (error) {
      logger.error('Error caching context:', error);
      return false;
    }
  }

  /**
   * Invalidate cached full context
   */
  async invalidateCachedContext(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const cacheKey = `full_context:${companyId}:${normalizedPhone}`;
    
    try {
      await this.redisRaw.del(cacheKey);
      logger.info('Cached context invalidated');
      return true;
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      return false;
    }
  }

  /**
   * Clear old contexts (for scheduled cleanup)
   */
  async clearOldContexts(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      // Get all context keys
      const keys = await this.redis.keys('context:*');
      let clearedCount = 0;
      
      for (const key of keys) {
        const lastActivity = await this.redis.hget(key.replace('context:', ''), 'lastActivity');
        if (lastActivity) {
          const activityDate = new Date(lastActivity);
          if (activityDate < cutoffDate) {
            await this.redis.del(key.replace('context:', ''));
            await this.redis.del(key.replace('context:', '') + ':messages');
            clearedCount++;
          }
        }
      }
      
      logger.info(`Cleared ${clearedCount} old contexts older than ${daysToKeep} days`);
      return { success: true, cleared: clearedCount };
    } catch (error) {
      logger.error('Failed to clear old contexts:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark context for important follow-up
   */
  async markForFollowUp(phone, companyId, reason, followUpDate) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const followUpKey = `followup:${companyId}:${normalizedPhone}`;
    
    try {
      await this.redis.setex(
        followUpKey,
        30 * 24 * 60 * 60, // 30 days
        JSON.stringify({
          reason,
          followUpDate,
          createdAt: new Date().toISOString()
        })
      );
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to mark for follow-up:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get metrics
   */
  async getMetrics() {
    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbsize();
      
      return {
        memoryUsage: info.match(/used_memory_human:(.+)/)?.[1],
        keys: dbSize,
        connected: this.redis.status === 'ready'
      };
    } catch (error) {
      logger.error('Failed to get context metrics:', error);
      return null;
    }
  }
}

// Singleton instance
module.exports = new ContextService();