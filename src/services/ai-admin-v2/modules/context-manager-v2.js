// src/services/ai-admin-v2/modules/context-manager-v2.js
/**
 * Улучшенный менеджер контекста v2
 * Использует новый ContextServiceV2 с правильным разделением данных
 */

const logger = require('../../../utils/logger').child({ module: 'context-manager-v2' });
const contextServiceV2 = require('../../context/context-service-v2');
const dataLoader = require('./cached-data-loader');
const intermediateContext = require('../../context/intermediate-context');
const performanceMetrics = require('./performance-metrics');
const LRUCache = require('./lru-cache');
const config = require('../config/modules-config');

class ContextManagerV2 {
  constructor() {
    // LRU кеш контекстов в памяти
    this.memoryCache = new LRUCache(
      config.cache.contextCacheSize || 50,
      config.cache.contextCacheTTL || 300000 // 5 минут
    );
    
    // Метрики кэша
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // Периодическая очистка памяти
    this.cleanupInterval = setInterval(() => {
      this.memoryCache.cleanup();
      logger.debug('Memory cache cleanup completed', this.memoryCache.getStats());
    }, config.contextManager?.memoryCheckInterval || 60000);
  }

  /**
   * Загрузка полного контекста с многоуровневым кешированием
   */
  async loadFullContext(phone, companyId) {
    const startTime = Date.now();
    const cacheKey = `${phone}@${companyId}`;
    
    logger.info(`Loading context for ${phone}, company ${companyId}`);
    
    // 1. Проверяем кеш в памяти
    const memoryCached = this.getFromMemoryCache(cacheKey);
    if (memoryCached && this._isContextFresh(memoryCached)) {
      logger.info(`✅ Context loaded from memory cache in ${Date.now() - startTime}ms`);
      performanceMetrics.updateCacheMetrics(true);
      return { ...memoryCached, startTime: Date.now() };
    }
    
    // 2. Получаем контекст из нового сервиса (он сам проверит Redis кэш)
    const contextFromV2 = await contextServiceV2.getFullContext(phone, companyId);
    
    // 3. Дополняем данными из базы если нужно
    const enrichedContext = await this._enrichContextWithDatabaseData(
      contextFromV2, 
      phone, 
      companyId
    );
    
    // 4. Сохраняем в память для быстрого доступа
    this.saveToMemoryCache(cacheKey, enrichedContext);
    
    logger.info(`✅ Context loaded in ${Date.now() - startTime}ms`);
    return { ...enrichedContext, startTime: Date.now() };
  }

  /**
   * Обогащение контекста данными из базы
   */
  async _enrichContextWithDatabaseData(context, phone, companyId) {
    // Если контекст уже содержит все необходимые данные - не загружаем повторно
    if (context.company && context.services && context.staff) {
      return context;
    }
    
    logger.info('Enriching context with database data...');
    
    // Параллельная загрузка недостающих данных
    const [company, services, staff, staffSchedules, businessStats] = await Promise.all([
      context.company || dataLoader.loadCompanyData(companyId).catch(e => {
        logger.error('Failed to load company:', e.message);
        return null;
      }),
      
      context.services || dataLoader.loadServices(companyId).catch(e => {
        logger.error('Failed to load services:', e.message);
        return [];
      }),
      
      context.staff || dataLoader.loadStaff(companyId).catch(e => {
        logger.error('Failed to load staff:', e.message);
        return [];
      }),
      
      context.staffSchedules || dataLoader.loadStaffSchedules(companyId).catch(e => {
        logger.error('Failed to load schedules:', e.message);
        return {};
      }),
      
      context.businessStats || dataLoader.loadBusinessStats(companyId).catch(e => {
        logger.error('Failed to load stats:', e.message);
        return null;
      })
    ]);
    
    // Сортируем услуги с учетом предпочтений клиента
    const sortedServices = this._sortServicesForClient(
      services, 
      context.client, 
      businessStats
    );
    
    return {
      ...context,
      company,
      services: sortedServices,
      staff,
      staffSchedules,
      businessStats,
      // Сохраняем все важные поля из оригинального контекста
      phone: context.phone,
      companyId: context.companyId,
      client: context.client,
      currentSelection: context.currentSelection,
      pendingAction: context.pendingAction,
      messages: context.messages,
      preferences: context.preferences,
      dialogState: context.dialogState,
      lastActivity: context.lastActivity,
      isNewClient: context.isNewClient,
      hasActiveDialog: context.hasActiveDialog
    };
  }

  /**
   * Сохранение контекста после обработки сообщения
   * ВАЖНО: Атомарное сохранение всех изменений
   */
  async saveContext(phone, companyId, updates) {
    const startTime = Date.now();
    
    logger.info('Saving context with updates:', {
      phone,
      companyId,
      updateKeys: Object.keys(updates)
    });
    
    try {
      // 1. Сохраняем изменения в диалоге (текущий выбор)
      if (updates.selection || updates.clientName || updates.pendingAction !== undefined) {
        await contextServiceV2.updateDialogContext(phone, companyId, {
          selection: updates.selection,
          clientName: updates.clientName,
          pendingAction: updates.pendingAction,
          state: updates.state || 'active'
        });
      }
      
      // 2. Сохраняем сообщения если есть
      if (updates.userMessage) {
        await contextServiceV2.addMessage(phone, companyId, {
          sender: 'user',
          text: updates.userMessage,
          timestamp: new Date().toISOString()
        });
      }
      
      if (updates.botResponse) {
        await contextServiceV2.addMessage(phone, companyId, {
          sender: 'bot',
          text: updates.botResponse,
          timestamp: new Date().toISOString()
        });
      }
      
      // 3. Обновляем предпочтения если обнаружены
      if (updates.preferences) {
        await contextServiceV2.savePreferences(phone, companyId, updates.preferences);
      }
      
      // 4. Инвалидируем кэши
      const cacheKey = `${phone}@${companyId}`;
      this.memoryCache.delete(cacheKey);
      await contextServiceV2.invalidateFullContextCache(phone, companyId);
      
      logger.info(`Context saved successfully in ${Date.now() - startTime}ms`);
      return { success: true };
      
    } catch (error) {
      logger.error('Failed to save context:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Сохранение контекста из выполненных команд
   */
  async saveCommandContext(phone, companyId, executedCommands, commandResults) {
    if (!executedCommands || executedCommands.length === 0) {
      return;
    }
    
    const selection = {};
    const preferences = {};
    
    // Извлекаем информацию из выполненных команд
    executedCommands.forEach(cmd => {
      if (cmd.params?.service_name) {
        selection.service = cmd.params.service_name;
      }
      if (cmd.params?.staff_name) {
        selection.staff = cmd.params.staff_name;
      }
      if (cmd.params?.time) {
        selection.time = cmd.params.time;
      }
      if (cmd.params?.date) {
        selection.date = cmd.params.date;
        // Важно: сохраняем дату из SEARCH_SLOTS чтобы AI помнил какой день обсуждался
        logger.info(`Saving date from ${cmd.command}: ${cmd.params.date}`);
      }
    });
    
    // Извлекаем информацию из результатов команд
    if (commandResults && commandResults.length > 0) {
      commandResults.forEach(result => {
        // Сохраняем информацию о мастере из поиска слотов
        if (result.command === 'SEARCH_SLOTS' && result.success && result.data?.length > 0) {
          const firstSlot = result.data[0];
          if (firstSlot.staff_name && !selection.staff) {
            selection.staff = firstSlot.staff_name;
          }
        }
        
        // Сохраняем созданную запись
        if (result.command === 'CREATE_BOOKING' && result.success) {
          // После создания записи очищаем выбор
          this.clearDialogAfterBooking(phone, companyId);
          
          // Сохраняем предпочтения на основе записи
          if (result.data?.service_id) {
            preferences.favoriteServiceId = result.data.service_id;
          }
          if (result.data?.staff_id) {
            preferences.favoriteStaffId = result.data.staff_id;
          }
        }
      });
    }
    
    // Сохраняем если есть что сохранять
    if (Object.keys(selection).length > 0 || Object.keys(preferences).length > 0) {
      await this.saveContext(phone, companyId, {
        selection,
        preferences: Object.keys(preferences).length > 0 ? preferences : undefined
      });
    }
  }

  /**
   * Очистка диалога после создания записи
   */
  async clearDialogAfterBooking(phone, companyId) {
    logger.info(`Clearing dialog context after booking for ${phone}`);
    
    // Очищаем контекст диалога но сохраняем предпочтения
    await contextServiceV2.clearDialogContext(phone, companyId);
    
    // Очищаем кэш в памяти
    const cacheKey = `${phone}@${companyId}`;
    this.memoryCache.delete(cacheKey);
  }

  /**
   * Обработка ожидающих действий
   */
  async handlePendingActions(message, phone, companyId) {
    const context = await contextServiceV2.getDialogContext(phone, companyId);
    
    if (!context?.pendingAction) {
      return { handled: false };
    }
    
    // Обработка отмены записи
    if (context.pendingAction.type === 'cancellation') {
      const { messageProcessor } = require('./message-processor');
      return await messageProcessor.handlePendingCancellation(
        message,
        phone,
        companyId,
        context
      );
    }
    
    // Другие ожидающие действия можно добавить здесь
    
    return { handled: false };
  }

  /**
   * Установка статуса обработки
   */
  async setProcessingStatus(phone, companyId, status) {
    await contextServiceV2.setProcessingStatus(phone, companyId, status);
    await intermediateContext.setProcessingStatus(phone, status);
  }

  /**
   * Проверка свежести контекста
   */
  _isContextFresh(context) {
    if (!context.timestamp) return false;
    
    const age = Date.now() - new Date(context.timestamp).getTime();
    const maxAge = 5 * 60 * 1000; // 5 минут
    
    return age < maxAge;
  }

  /**
   * Сортировка услуг для клиента
   */
  _sortServicesForClient(services, client, businessStats) {
    if (!services || services.length === 0) return [];
    
    return services.map(service => {
      let score = 0;
      
      // Популярность услуги
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
        score += 100;
      }
      
      // Для новых клиентов приоритет популярным услугам
      if (!client && service.category?.toLowerCase().includes('стрижк')) {
        score += 50;
      }
      
      return { ...service, score };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Работа с кэшем в памяти
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
    this.memoryCache.set(key, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Получение статистики
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
   * Очистка ресурсов
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.memoryCache.clear();
  }
}

module.exports = new ContextManagerV2();