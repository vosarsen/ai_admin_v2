// src/services/context/index.js
const { createRedisClient } = require('../../utils/redis-factory');
const config = require('../../config');
const logger = require('../../utils/logger');
const DataTransformers = require('../../utils/data-transformers');

class ContextService {
  constructor() {
    // Используем фабрику для создания Redis клиента с правильной конфигурацией
    const redisClient = createRedisClient('context');
    
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
    
    this.contextTTL = 24 * 60 * 60; // 24 hours
    this.maxMessages = 20; // Keep last 20 messages
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
        lastBooking
      ] = await Promise.all([
        this._getClient(normalizedPhone, companyId),
        this._getMessages(contextKey),
        this._getServices(companyId),
        this._getStaff(companyId),
        this._getLastBooking(normalizedPhone, companyId)
      ]);

      return {
        phone: normalizedPhone,
        companyId,
        client,
        lastMessages: messages,
        services,
        staff,
        lastBooking,
        timestamp: new Date().toISOString()
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
      const cached = await this.redis.hget(`clients:${companyId}`, phone);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // TODO: Fetch from Supabase if not in cache
      // For now, return null (new client)
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
      await this.redis.hset(
        `clients:${companyId}`, 
        phone, 
        JSON.stringify({
          ...clientInfo,
          lastUpdated: new Date().toISOString()
        })
      );
      
      // Set TTL on the hash
      await this.redis.expire(`clients:${companyId}`, 7 * 24 * 60 * 60); // 7 days
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