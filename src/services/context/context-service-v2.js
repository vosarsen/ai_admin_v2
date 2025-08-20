// src/services/context/context-service-v2.js
/**
 * Улучшенный сервис управления контекстом v2
 * Решает проблемы потери контекста через правильное разделение данных
 */

const { createRedisClient } = require('../../utils/redis-factory');
const logger = require('../../utils/logger').child({ module: 'context-v2' });
const DataTransformers = require('../../utils/data-transformers');

// Конфигурация TTL для разных типов данных
const TTL_CONFIG = {
  // Контекст текущего диалога
  dialog: {
    messages: 24 * 60 * 60,         // 24 часа - история сообщений
    selection: 2 * 60 * 60,          // 2 часа - текущий выбор (услуга, мастер, время)
    pendingAction: 30 * 60,          // 30 минут - ожидающие действия
  },
  
  // Кэш данных из Supabase
  clientCache: 24 * 60 * 60,         // 24 часа - обновится при синхронизации
  
  // Персональные предпочтения
  preferences: 30 * 24 * 60 * 60,    // 30 дней - долгосрочные предпочтения
  
  // Полный контекст для AI
  fullContext: 12 * 60 * 60,         // 12 часов - кэш полного контекста
};

class ContextServiceV2 {
  constructor() {
    this.redis = createRedisClient('context-v2');
    
    // Префиксы для разных типов данных
    this.prefixes = {
      dialog: 'dialog:',           // Текущий диалог
      client: 'client:',           // Кэш клиента из Supabase
      preferences: 'prefs:',       // Долгосрочные предпочтения
      messages: 'messages:',       // История сообщений
      fullContext: 'full_ctx:',    // Кэш полного контекста
      processing: 'processing:',   // Статус обработки
    };
  }

  /**
   * Получить полный контекст для AI
   * Умно объединяет данные из разных источников
   */
  async getFullContext(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const contextKey = this._getKey('fullContext', companyId, normalizedPhone);
    
    logger.info(`Getting full context for ${normalizedPhone}, company ${companyId}`);
    
    try {
      // 1. Проверяем кэш полного контекста
      const cached = await this.redis.get(contextKey);
      if (cached) {
        logger.info('Full context found in cache');
        return JSON.parse(cached);
      }
      
      // 2. Собираем контекст из разных источников
      const [dialog, client, preferences, messages] = await Promise.all([
        this.getDialogContext(normalizedPhone, companyId),
        this.getClientCache(normalizedPhone, companyId),
        this.getPreferences(normalizedPhone, companyId),
        this.getMessages(normalizedPhone, companyId)
      ]);
      
      // 3. Умное объединение с приоритетами
      const fullContext = this._mergeContexts({
        dialog,      // Приоритет 1: текущий диалог
        client,      // Приоритет 2: данные клиента
        preferences, // Приоритет 3: предпочтения
        messages,    // История сообщений
        phone: normalizedPhone,
        companyId
      });
      
      // 4. Кэшируем на 12 часов
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
        lastUpdated: data.lastUpdated
      };
    } catch (error) {
      logger.error('Error getting dialog context:', error);
      return null;
    }
  }

  /**
   * Сохранить/обновить контекст диалога
   * АТОМАРНАЯ операция - все данные сохраняются за один раз
   */
  async updateDialogContext(phone, companyId, updates) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('dialog', companyId, normalizedPhone);
    
    logger.info('Updating dialog context:', {
      phone: normalizedPhone,
      companyId,
      updateKeys: Object.keys(updates)
    });
    
    try {
      // 1. Получаем существующий контекст
      const existing = await this.redis.hgetall(key);
      
      // 2. Умное слияние selection (не теряем выбор клиента)
      let selection = existing.selection ? JSON.parse(existing.selection) : {};
      if (updates.selection) {
        // Сохраняем старые значения если новые не переданы
        selection = {
          ...selection,  // Сохраняем старый выбор
          ...updates.selection,  // Добавляем новый
          // Критичные поля НИКОГДА не перезаписываем null/undefined
          service: updates.selection.service !== undefined ? updates.selection.service : selection.service,
          staff: updates.selection.staff !== undefined ? updates.selection.staff : selection.staff,
          time: updates.selection.time !== undefined ? updates.selection.time : selection.time,
          date: updates.selection.date !== undefined ? updates.selection.date : selection.date,
        };
        
        // Логируем для отладки
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
      
      // 4. Добавляем имя клиента если есть
      if (updates.clientName) {
        dataToSave.clientName = updates.clientName;
      } else if (existing.clientName) {
        dataToSave.clientName = existing.clientName;
      }
      
      // 5. Добавляем pending action если есть
      if (updates.pendingAction !== undefined) {
        dataToSave.pendingAction = JSON.stringify(updates.pendingAction);
      } else if (existing.pendingAction) {
        dataToSave.pendingAction = existing.pendingAction;
      }
      
      // 6. Сохраняем атомарно (hset требует пары ключ-значение)
      const fieldsToSet = [];
      Object.entries(dataToSave).forEach(([field, value]) => {
        fieldsToSet.push(field, value);
      });
      await this.redis.hset(key, ...fieldsToSet);
      
      // 7. Устанавливаем TTL
      await this.redis.expire(key, TTL_CONFIG.dialog.selection);
      
      // 8. Инвалидируем кэш полного контекста
      await this.invalidateFullContextCache(normalizedPhone, companyId);
      
      logger.info('Dialog context updated successfully');
      return { success: true };
      
    } catch (error) {
      logger.error('Error updating dialog context:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Сохранить сообщение в историю
   */
  async addMessage(phone, companyId, message) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('messages', companyId, normalizedPhone);
    
    try {
      const messageData = {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      };
      
      // Добавляем в список
      await this.redis.lpush(key, JSON.stringify(messageData));
      
      // Обрезаем до 50 последних
      await this.redis.ltrim(key, 0, 49);
      
      // Устанавливаем TTL
      await this.redis.expire(key, TTL_CONFIG.dialog.messages);
      
      return { success: true };
    } catch (error) {
      logger.error('Error adding message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить историю сообщений
   */
  async getMessages(phone, companyId, limit = 20) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('messages', companyId, normalizedPhone);
    
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
   */
  async saveClientCache(phone, companyId, clientData) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('client', companyId, normalizedPhone);
    
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
   */
  async getClientCache(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('client', companyId, normalizedPhone);
    
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
   */
  async savePreferences(phone, companyId, preferences) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('preferences', companyId, normalizedPhone);
    
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
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('preferences', companyId, normalizedPhone);
    
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
   */
  async clearDialogContext(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const dialogKey = this._getKey('dialog', companyId, normalizedPhone);
    
    try {
      await this.redis.del(dialogKey);
      await this.invalidateFullContextCache(normalizedPhone, companyId);
      
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
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('fullContext', companyId, normalizedPhone);
    
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
   */
  async setProcessingStatus(phone, companyId, status) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('processing', companyId, normalizedPhone);
    
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
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    const key = this._getKey('processing', companyId, normalizedPhone);
    
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
   * Генерация ключа с правильным префиксом
   */
  _getKey(type, companyId, phone) {
    const prefix = this.prefixes[type] || '';
    return `${prefix}${companyId}:${phone}`;
  }

  /**
   * Умное объединение контекстов с приоритетами
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
}

// Экспортируем singleton
module.exports = new ContextServiceV2();