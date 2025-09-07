// src/services/context/context-service-v2.js
/**
 * Улучшенный сервис управления контекстом v2
 * Решает проблемы потери контекста через правильное разделение данных
 */

const { createRedisClient } = require('../../utils/redis-factory');
const logger = require('../../utils/logger').child({ module: 'context-v2' });
const DataTransformers = require('../../utils/data-transformers');
const InternationalPhone = require('../../utils/international-phone');
const config = require('../../config/context-config');
const redisTTL = require('../../config/redis-ttl-config');

// Используем TTL из централизованной конфигурации
const TTL_CONFIG = {
  // Контекст текущего диалога
  dialog: {
    messages: redisTTL.dialog,
    selection: redisTTL.dialog,
    pendingAction: redisTTL.dialog,
  },
  
  // Кэш данных из Supabase
  clientCache: redisTTL.client,
  
  // Персональные предпочтения
  preferences: redisTTL.preferences,
  
  // Полный контекст для AI
  fullContext: redisTTL.fullContext,
};

class ContextServiceV2 {
  constructor() {
    this.redis = createRedisClient('context-v2');
    
    // Префиксы для разных типов данных
    this.prefixes = {
      dialog: 'dialog:',           // Текущий диалог
      client: 'client:',           // Кэш клиента из Supabase
      preferences: 'preferences:',  // Долгосрочные предпочтения
      messages: 'messages:',       // История сообщений
      fullContext: 'full_ctx:',    // Кэш полного контекста
      processing: 'processing:',   // Статус обработки
    };
  }

  /**
   * Получить полный контекст для AI
   * Использует Redis Pipeline для оптимизации
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @returns {Promise<Object>} Полный контекст для обработки AI
   */
  async getFullContext(phone, companyId) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const contextKey = this._getKey('fullContext', companyId, phone);
    
    logger.info(`Getting full context for ${normalizedPhone}, company ${companyId}`);
    
    try {
      // 1. Проверяем кэш полного контекста
      const cached = await this.redis.get(contextKey);
      if (cached) {
        logger.info('Full context found in cache');
        return JSON.parse(cached);
      }
      
      // 2. Используем Pipeline для параллельного получения всех данных
      const pipeline = this.redis.pipeline();
      
      // В pipeline используем стандартные Redis команды
      pipeline.hgetall(this._getKey('dialog', companyId, phone));
      pipeline.get(this._getKey('client', companyId, phone));
      pipeline.get(this._getKey('preferences', companyId, phone));
      pipeline.lrange(this._getKey('messages', companyId, phone), 0, 19);
      
      const results = await pipeline.exec();
      
      // 3. Обрабатываем результаты Pipeline
      const [dialogResult, clientResult, prefsResult, messagesResult] = results;
      
      const dialog = this._processPipelineResult(dialogResult, 'hash');
      const client = this._processPipelineResult(clientResult, 'string');
      const preferences = this._processPipelineResult(prefsResult, 'string');
      const messages = this._processPipelineResult(messagesResult, 'list');
      
      // 4. Умное объединение с приоритетами
      const fullContext = this._mergeContexts({
        dialog,
        client,
        preferences,
        messages: messages ? messages.map(m => {
          try {
            return JSON.parse(m);
          } catch (e) {
            logger.warn('Failed to parse message:', e);
            return m;
          }
        }).reverse() : [],
        phone: normalizedPhone,
        companyId
      });
      
      // 5. Кэшируем на 12 часов
      await this.redis.setex(
        contextKey,
        TTL_CONFIG.fullContext,
        JSON.stringify(fullContext)
      );
      
      logger.info('Full context assembled and cached');
      return fullContext;
      
    } catch (error) {
      logger.error('Error getting full context:', error);
      // Возвращаем минимальный контекст при ошибке
      return {
        phone: normalizedPhone,
        companyId,
        error: error.message
      };
    }
  }

  /**
   * Получить контекст текущего диалога
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @returns {Promise<Object|null>} Контекст диалога или null
   */
  async getDialogContext(phone, companyId) {
    const key = this._getKey('dialog', companyId, phone);
    
    try {
      const data = await this.redis.hgetall(key);
      if (!data || Object.keys(data).length === 0) {
        return null;
      }
      
      // Парсим JSON поля
      return {
        ...data,
        selection: data.selection ? JSON.parse(data.selection) : {},
        pendingAction: data.pendingAction ? JSON.parse(data.pendingAction) : null,
        lastUpdated: data.lastUpdated,
        // Добавляем флаги вопросов
        askedForTimeSelection: data.askedForTimeSelection === 'true',
        askedForTimeAt: data.askedForTimeAt || null,
        shownSlotsAt: data.shownSlotsAt || null
      };
    } catch (error) {
      logger.error('Error getting dialog context:', error);
      return null;
    }
  }

  /**
   * Сохранить/обновить контекст диалога
   * Использует WATCH и транзакции для защиты от race conditions
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @param {Object} updates - Обновления контекста
   * @returns {Promise<{success: boolean, error?: string}>} Результат операции
   */
  async updateDialogContext(phone, companyId, updates) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('dialog', companyId, phone);
    
    logger.info('Updating dialog context:', {
      phone: normalizedPhone,
      companyId,
      updateKeys: Object.keys(updates)
    });
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Используем WATCH для оптимистической блокировки
        await this.redis.watch(key);
        
        // 1. Получаем существующий контекст
        const existing = await this.redis.hgetall(key);
        
        // 2. Умное слияние selection (не теряем выбор клиента)
        let selection = existing.selection ? JSON.parse(existing.selection) : {};
        if (updates.selection) {
          selection = {
            ...selection,
            ...updates.selection,
            // Критичные поля НИКОГДА не перезаписываем null/undefined
            service: updates.selection.service !== undefined ? 
              updates.selection.service : selection.service,
            staff: updates.selection.staff !== undefined ? 
              updates.selection.staff : selection.staff,
            time: updates.selection.time !== undefined ? 
              updates.selection.time : selection.time,
            date: updates.selection.date !== undefined ? 
              updates.selection.date : selection.date,
          };
          
          logger.debug('Selection merge result:', {
            oldSelection: existing.selection ? JSON.parse(existing.selection) : {},
            newSelection: updates.selection,
            mergedSelection: selection
          });
        }
        
        // 3. Подготавливаем данные для сохранения
        const dataToSave = {
          phone: normalizedPhone,
          companyId: companyId.toString(),
          lastUpdated: new Date().toISOString(),
          state: updates.state || existing.state || 'active',
          selection: JSON.stringify(selection),
        };
        
        // Добавляем имя клиента если есть
        if (updates.clientName) {
          dataToSave.clientName = updates.clientName;
        } else if (existing.clientName) {
          dataToSave.clientName = existing.clientName;
        }
        
        // Добавляем pending action если есть
        if (updates.pendingAction !== undefined) {
          dataToSave.pendingAction = JSON.stringify(updates.pendingAction);
        } else if (existing.pendingAction) {
          dataToSave.pendingAction = existing.pendingAction;
        }
        
        // Добавляем флаги для отслеживания вопросов
        if (updates.askedForTimeSelection !== undefined) {
          dataToSave.askedForTimeSelection = updates.askedForTimeSelection.toString();
        } else if (existing.askedForTimeSelection) {
          dataToSave.askedForTimeSelection = existing.askedForTimeSelection;
        }
        
        if (updates.askedForTimeAt !== undefined) {
          dataToSave.askedForTimeAt = updates.askedForTimeAt;
        } else if (existing.askedForTimeAt) {
          dataToSave.askedForTimeAt = existing.askedForTimeAt;
        }
        
        if (updates.shownSlotsAt !== undefined) {
          dataToSave.shownSlotsAt = updates.shownSlotsAt;
        } else if (existing.shownSlotsAt) {
          dataToSave.shownSlotsAt = existing.shownSlotsAt;
        }
        
        // 4. Используем транзакцию для атомарного обновления
        const multi = this.redis.multi();
        
        // Удаляем старый ключ и создаем новый атомарно
        multi.del(key);
        
        // Добавляем все поля
        for (const [field, value] of Object.entries(dataToSave)) {
          multi.hset(key, field, value);
        }
        
        // Устанавливаем TTL
        multi.expire(key, TTL_CONFIG.dialog.selection);
        
        // Инвалидируем кэш полного контекста
        multi.del(this._getKey('fullContext', companyId, phone));
        
        // 5. Выполняем транзакцию
        const result = await multi.exec();
        
        if (result === null) {
          // Транзакция отменена из-за изменения данных
          retryCount++;
          logger.warn(`Transaction retry ${retryCount} for ${normalizedPhone}`);
          await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
          continue;
        }
        
        logger.info('Dialog context updated successfully');
        return { success: true };
        
      } catch (error) {
        logger.error('Error updating dialog context:', error);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
          continue;
        }
        
        return { success: false, error: error.message };
      }
    }
    
    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Сохранить сообщение в историю
   * Использует Pipeline для атомарной операции
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @param {Object} message - Объект сообщения
   * @returns {Promise<{success: boolean, error?: string}>} Результат операции
   */
  async addMessage(phone, companyId, message) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('messages', companyId, phone);
    
    try {
      const messageData = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      };
      
      // Используем Pipeline для атомарной операции
      const pipeline = this.redis.pipeline();
      
      // Добавляем в список
      pipeline.lpush(key, JSON.stringify(messageData));
      // Обрезаем до 50 последних
      pipeline.ltrim(key, 0, 49);
      // Устанавливаем TTL
      pipeline.expire(key, TTL_CONFIG.dialog.messages);
      
      await pipeline.exec();
      
      return { success: true };
    } catch (error) {
      logger.error('Error adding message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить историю сообщений
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @param {number} [limit=20] - Максимальное количество сообщений
   * @returns {Promise<Array>} Массив сообщений в хронологическом порядке
   */
  async getMessages(phone, companyId, limit = 20) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('messages', companyId, phone);
    
    try {
      const messages = await this.redis.lrange(key, 0, limit - 1);
      return messages.map(m => JSON.parse(m)).reverse();
    } catch (error) {
      logger.error('Error getting messages:', error);
      return [];
    }
  }

  /**
   * Сохранить кэш клиента из Supabase
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @param {Object} clientData - Данные клиента для кэширования
   * @returns {Promise<{success: boolean, error?: string}>} Результат операции
   */
  async saveClientCache(phone, companyId, clientData) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('client', companyId, phone);
    
    try {
      await this.redis.setex(
        key,
        TTL_CONFIG.clientCache,
        JSON.stringify({
          ...clientData,
          cachedAt: new Date().toISOString()
        })
      );
      
      return { success: true };
    } catch (error) {
      logger.error('Error saving client cache:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить кэш клиента
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @returns {Promise<Object|null>} Кэшированные данные клиента или null
   */
  async getClientCache(phone, companyId) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('client', companyId, phone);
    
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting client cache:', error);
      return null;
    }
  }

  /**
   * Сохранить долгосрочные предпочтения
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @param {Object} preferences - Предпочтения клиента
   * @returns {Promise<{success: boolean, preferences?: Object, error?: string}>} Результат операции
   */
  async savePreferences(phone, companyId, preferences) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('preferences', companyId, phone);
    
    try {
      // Получаем существующие предпочтения
      const existing = await this.redis.get(key);
      const current = existing ? JSON.parse(existing) : {};
      
      // Объединяем с новыми
      const updated = {
        ...current,
        ...preferences,
        lastUpdated: new Date().toISOString()
      };
      
      await this.redis.setex(
        key,
        TTL_CONFIG.preferences,
        JSON.stringify(updated)
      );
      
      return { success: true, preferences: updated };
    } catch (error) {
      logger.error('Error saving preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить предпочтения
   */
  async getPreferences(phone, companyId) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('preferences', companyId, phone);
    
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting preferences:', error);
      return null;
    }
  }

  /**
   * Очистить контекст диалога (после создания записи)
   * Использует Pipeline для атомарного удаления
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @returns {Promise<{success: boolean, error?: string}>} Результат операции
   */
  async clearDialogContext(phone, companyId) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const dialogKey = this._getKey('dialog', companyId, phone);
    const contextKey = this._getKey('fullContext', companyId, phone);
    
    try {
      // Используем Pipeline для атомарного удаления
      const pipeline = this.redis.pipeline();
      
      pipeline.del(dialogKey);
      pipeline.del(contextKey);
      
      await pipeline.exec();
      
      logger.info(`Dialog context cleared for ${normalizedPhone}`);
      return { success: true };
    } catch (error) {
      logger.error('Error clearing dialog context:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Инвалидировать кэш полного контекста
   */
  async invalidateFullContextCache(phone, companyId) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('fullContext', companyId, phone);
    
    try {
      await this.redis.del(key);
      logger.debug('Full context cache invalidated');
      return true;
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      return false;
    }
  }

  /**
   * Установить статус обработки
   * @param {string} phone - Номер телефона клиента
   * @param {number} companyId - ID компании
   * @param {string} status - Статус обработки
   * @returns {Promise<boolean>} Успешность операции
   */
  async setProcessingStatus(phone, companyId, status) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('processing', companyId, phone);
    
    try {
      await this.redis.setex(
        key,
        300, // 5 минут
        JSON.stringify({
          status,
          timestamp: Date.now()
        })
      );
      return true;
    } catch (error) {
      logger.error('Error setting processing status:', error);
      return false;
    }
  }

  /**
   * Проверить статус обработки
   */
  async getProcessingStatus(phone, companyId) {
    const normalizedPhone = this._normalizePhoneForKey(phone);
    const key = this._getKey('processing', companyId, phone);
    
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      parsed.age = Date.now() - parsed.timestamp;
      return parsed;
    } catch (error) {
      logger.error('Error getting processing status:', error);
      return null;
    }
  }

  /**
   * ПРИВАТНЫЕ МЕТОДЫ
   */
  
  /**
   * Нормализация телефона для единообразных ключей
   * Всегда возвращает формат без + для использования в Redis ключах
   */
  _normalizePhoneForKey(phone) {
    if (!phone) return '';
    
    // Используем централизованную утилиту для нормализации
    const normalized = InternationalPhone.normalize(phone);
    
    if (!normalized) {
      logger.warn(`Failed to normalize phone for key: ${phone}`);
      // Fallback - просто удаляем все нецифровые символы
      return phone.toString().replace(/[^\d]/g, '');
    }
    
    return normalized;
  }
  
  /**
   * Генерация ключа с правильным префиксом
   */
  _getKey(type, companyId, phone) {
    const prefix = this.prefixes[type] || '';
    const normalizedPhone = this._normalizePhoneForKey(phone);
    return `${prefix}${companyId}:${normalizedPhone}`;
  }

  /**
   * Обработка результатов Pipeline
   * Результаты приходят в формате [error, data]
   */
  _processPipelineResult(result, type) {
    if (!result) {
      return null;
    }
    
    const [error, data] = result;
    
    if (error) {
      logger.error('Pipeline operation error:', error);
      return null;
    }
    
    switch (type) {
      case 'hash':
        if (data && Object.keys(data).length > 0) {
          try {
            return {
              ...data,
              selection: data.selection ? JSON.parse(data.selection) : {},
              pendingAction: data.pendingAction ? JSON.parse(data.pendingAction) : null
            };
          } catch (e) {
            logger.error('Error parsing hash data:', e);
            return data;
          }
        }
        return null;
      
      case 'string':
        if (data) {
          try {
            return JSON.parse(data);
          } catch (e) {
            logger.error('Error parsing string data:', e);
            return data;
          }
        }
        return null;
      
      case 'list':
        return data || [];
      
      default:
        return data;
    }
  }

  /**
   * Умное объединение контекстов с приоритетами
   * @private
   * @param {Object} params - Параметры для объединения
   * @param {Object} params.dialog - Контекст диалога
   * @param {Object} params.client - Данные клиента
   * @param {Object} params.preferences - Предпочтения
   * @param {Array} params.messages - История сообщений
   * @param {string} params.phone - Номер телефона
   * @param {number} params.companyId - ID компании
   * @returns {Object} Объединённый контекст
   */
  _mergeContexts({ dialog, client, preferences, messages, phone, companyId }) {
    // Базовая структура
    const merged = {
      phone,
      companyId,
      timestamp: new Date().toISOString(),
      
      // Информация о клиенте (приоритет: диалог > кэш)
      client: {
        phone,
        name: dialog?.clientName || client?.name || null,
        id: client?.id || null,
        visits_count: client?.visits_count || 0,
        last_visit: client?.last_visit || null,
        favorite_service_id: preferences?.favoriteServiceId || client?.favorite_service_id || null,
        favorite_staff_id: preferences?.favoriteStaffId || client?.favorite_staff_id || null,
      },
      
      // Текущий выбор в диалоге
      currentSelection: dialog?.selection || {},
      
      // Ожидающие действия
      pendingAction: dialog?.pendingAction || null,
      
      // История сообщений
      messages: messages || [],
      
      // Долгосрочные предпочтения
      preferences: preferences || {},
      
      // Метаданные
      dialogState: dialog?.state || 'new',
      lastActivity: dialog?.lastUpdated || new Date().toISOString(),
    };
    
    // Добавляем флаг новый/существующий клиент
    merged.isNewClient = !client || !client.id;
    
    // Добавляем флаг активного диалога
    merged.hasActiveDialog = !!dialog && dialog.state === 'active';
    
    return merged;
  }

  /**
   * Получить метрики использования
   */
  async getMetrics() {
    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbsize();
      
      return {
        memoryUsage: info.match(/used_memory_human:(.+)/)?.[1],
        totalKeys: dbSize,
        connected: this.redis.status === 'ready'
      };
    } catch (error) {
      logger.error('Error getting metrics:', error);
      return null;
    }
  }

  /**
   * Health check для системы контекста
   * @returns {Promise<Object>} Статус здоровья системы
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        redis: { status: 'unknown' },
        memory: { status: 'unknown' },
        performance: { status: 'unknown' }
      },
      metrics: {}
    };

    try {
      // 1. Проверка Redis подключения
      const startPing = Date.now();
      await this.redis.ping();
      const pingTime = Date.now() - startPing;
      
      health.checks.redis = {
        status: 'healthy',
        responseTime: `${pingTime}ms`,
        connected: this.redis.status === 'ready'
      };
      
      // 2. Проверка памяти
      const metrics = await this.getMetrics();
      if (metrics) {
        health.metrics = metrics;
        health.checks.memory = {
          status: 'healthy',
          usage: metrics.memoryUsage,
          totalKeys: metrics.totalKeys
        };
      }
      
      // 3. Проверка производительности (тест записи/чтения)
      const testKey = '_health_check_test';
      const testData = { test: true, timestamp: Date.now() };
      
      const startWrite = Date.now();
      await this.redis.setex(testKey, 10, JSON.stringify(testData));
      const writeTime = Date.now() - startWrite;
      
      const startRead = Date.now();
      const readData = await this.redis.get(testKey);
      const readTime = Date.now() - startRead;
      
      await this.redis.del(testKey);
      
      health.checks.performance = {
        status: writeTime < 100 && readTime < 50 ? 'healthy' : 'degraded',
        writeTime: `${writeTime}ms`,
        readTime: `${readTime}ms`
      };
      
      // Определяем общий статус
      const allHealthy = Object.values(health.checks).every(
        check => check.status === 'healthy'
      );
      
      if (!allHealthy) {
        const degraded = Object.values(health.checks).some(
          check => check.status === 'degraded'
        );
        health.status = degraded ? 'degraded' : 'unhealthy';
      }
      
    } catch (error) {
      logger.error('Health check failed:', error);
      health.status = 'unhealthy';
      health.checks.redis = {
        status: 'unhealthy',
        error: error.message
      };
    }
    
    return health;
  }

  /**
   * Получить статистику использования контекста
   * @param {string} companyId - ID компании
   * @returns {Promise<Object>} Статистика использования
   */
  async getUsageStats(companyId) {
    try {
      const pattern = `*${companyId}:*`;
      const keys = await this.redis.keys(pattern);
      
      const stats = {
        totalContexts: 0,
        activeDialogs: 0,
        cachedClients: 0,
        messageHistories: 0,
        preferences: 0,
        avgContextSize: 0
      };
      
      let totalSize = 0;
      
      for (const key of keys) {
        // Подсчитываем типы ключей
        if (key.includes('dialog:')) {
          stats.activeDialogs++;
          // Для hash используем hgetall и считаем размер JSON
          try {
            const data = await this.redis.hgetall(key);
            if (data) {
              totalSize += JSON.stringify(data).length;
            }
          } catch (e) {
            logger.debug(`Error reading dialog key ${key}:`, e);
          }
        }
        else if (key.includes('client:')) {
          stats.cachedClients++;
          // Для строк используем get
          try {
            const value = await this.redis.get(key);
            if (value) {
              totalSize += value.length;
            }
          } catch (e) {
            logger.debug(`Error reading client key ${key}:`, e);
          }
        }
        else if (key.includes('messages:')) {
          stats.messageHistories++;
          // Для списков используем lrange и считаем общий размер
          try {
            const messages = await this.redis.lrange(key, 0, -1);
            if (messages) {
              totalSize += JSON.stringify(messages).length;
            }
          } catch (e) {
            logger.debug(`Error reading messages key ${key}:`, e);
          }
        }
        else if (key.includes('preferences:')) {
          stats.preferences++;
          // Для строк используем get
          try {
            const value = await this.redis.get(key);
            if (value) {
              totalSize += value.length;
            }
          } catch (e) {
            logger.debug(`Error reading preferences key ${key}:`, e);
          }
        }
        else if (key.includes('full_ctx:') || key.includes('fullContext:')) {
          // Кэш полного контекста - это строка
          try {
            const value = await this.redis.get(key);
            if (value) {
              totalSize += value.length;
            }
          } catch (e) {
            logger.debug(`Error reading full context key ${key}:`, e);
          }
        }
        else if (key.includes('processing:')) {
          // Статус обработки - это строка
          try {
            const value = await this.redis.get(key);
            if (value) {
              totalSize += value.length;
            }
          } catch (e) {
            logger.debug(`Error reading processing key ${key}:`, e);
          }
        }
        else {
          // Для неизвестных ключей пробуем get
          try {
            const value = await this.redis.get(key);
            if (value) {
              totalSize += value.length;
            }
          } catch (e) {
            // Если не строка, пробуем как hash
            try {
              const data = await this.redis.hgetall(key);
              if (data && Object.keys(data).length > 0) {
                totalSize += JSON.stringify(data).length;
              }
            } catch (e2) {
              logger.debug(`Unknown key type ${key}`);
            }
          }
        }
      }
      
      stats.totalContexts = keys.length;
      stats.avgContextSize = keys.length > 0 
        ? Math.round(totalSize / keys.length) 
        : 0;
      
      return stats;
    } catch (error) {
      logger.error('Error getting usage stats:', error);
      return null;
    }
  }
}

// Экспортируем singleton
module.exports = new ContextServiceV2();