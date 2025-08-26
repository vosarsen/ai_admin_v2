/**
 * Unified Context Service
 * Единый фасад для управления контекстом
 * Постепенная миграция со старой системы на context-v2
 */

const logger = require('../../utils/logger').child({ module: 'unified-context' });
const contextServiceV2 = require('./context-service-v2');
const contextServiceOld = require('./index');
const intermediateContext = require('./intermediate-context');
const DataTransformers = require('../../utils/data-transformers');
const config = require('../../config/context-config');

class UnifiedContextService {
  constructor() {
    this.v2 = contextServiceV2;
    this.v1 = contextServiceOld;
    this.intermediate = intermediateContext;
    
    // Флаг для постепенной миграции
    this.useV2 = process.env.USE_CONTEXT_V2 === 'true' || false;
    
    // Метрики для мониторинга миграции
    this.metrics = {
      v1Calls: 0,
      v2Calls: 0,
      migrationErrors: 0
    };
  }

  /**
   * Получить полный контекст
   * Пытается получить из v2, fallback на v1
   */
  async getContext(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    
    try {
      // Всегда пытаемся получить из v2 сначала
      const v2Context = await this.v2.getFullContext(normalizedPhone, companyId);
      
      // Если в v2 есть данные - используем их
      if (v2Context && v2Context.currentSelection && Object.keys(v2Context.currentSelection).length > 0) {
        this.metrics.v2Calls++;
        logger.debug('Using context from v2 system');
        return this._normalizeContext(v2Context, 'v2');
      }
      
      // Fallback на старую систему
      const v1Context = await this.v1.getContext(normalizedPhone, companyId);
      this.metrics.v1Calls++;
      logger.debug('Using context from v1 system');
      
      // Мигрируем данные в v2 для следующего раза
      await this._migrateToV2(normalizedPhone, companyId, v1Context);
      
      return this._normalizeContext(v1Context, 'v1');
      
    } catch (error) {
      logger.error('Error getting context:', error);
      this.metrics.migrationErrors++;
      
      // В случае ошибки возвращаем минимальный контекст
      return this._getMinimalContext(normalizedPhone, companyId);
    }
  }

  /**
   * Сохранить контекст
   * Сохраняет в обе системы для обратной совместимости
   */
  async saveContext(phone, companyId, updates) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    
    logger.info('Saving context through unified service', {
      phone: normalizedPhone,
      companyId,
      updateKeys: Object.keys(updates)
    });
    
    const errors = [];
    
    // Сохраняем в v2
    try {
      await this.v2.updateDialogContext(normalizedPhone, companyId, {
        selection: updates.selection,
        clientName: updates.clientName,
        pendingAction: updates.pendingAction,
        state: updates.state || 'active'
      });
      
      // Сохраняем сообщения если есть
      if (updates.userMessage) {
        await this.v2.addMessage(normalizedPhone, companyId, {
          sender: 'user',
          text: updates.userMessage,
          timestamp: new Date().toISOString()
        });
      }
      
      if (updates.botResponse) {
        await this.v2.addMessage(normalizedPhone, companyId, {
          sender: 'bot',
          text: updates.botResponse,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to save to v2:', error);
      errors.push({ system: 'v2', error: error.message });
    }
    
    // Сохраняем в старую систему для совместимости
    try {
      const oldFormatData = {};
      
      if (updates.selection) {
        oldFormatData.lastService = updates.selection.service;
        oldFormatData.lastDate = updates.selection.date;
        oldFormatData.lastStaff = updates.selection.staff;
        oldFormatData.lastTime = updates.selection.time;
      }
      
      if (updates.clientName) {
        oldFormatData.clientName = updates.clientName;
      }
      
      await this.v1.setContext(normalizedPhone, companyId, {
        ...updates,
        data: JSON.stringify(oldFormatData),
        lastActivity: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to save to v1:', error);
      errors.push({ system: 'v1', error: error.message });
    }
    
    if (errors.length === 2) {
      // Обе системы упали - это критично
      throw new Error(`Failed to save context: ${JSON.stringify(errors)}`);
    }
    
    return { success: true, errors };
  }

  /**
   * Очистить контекст
   */
  async clearContext(phone, companyId) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    
    const results = await Promise.allSettled([
      this.v2.clearDialogContext(normalizedPhone, companyId),
      this.v1.clearContext(normalizedPhone, companyId)
    ]);
    
    const errors = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);
    
    if (errors.length > 0) {
      logger.warn('Some errors while clearing context:', errors);
    }
    
    return { success: true, errors };
  }

  /**
   * Сохранить промежуточный контекст
   * Исправляем проблему отсутствия companyId
   */
  async saveIntermediateContext(phone, companyId, message, context) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    
    // Добавляем companyId в ключ для изоляции данных между компаниями
    const enhancedContext = {
      ...context,
      companyId // Критично важно!
    };
    
    return await this.intermediate.saveProcessingStart(
      `${companyId}:${normalizedPhone}`, // Ключ теперь включает companyId
      message,
      enhancedContext
    );
  }

  /**
   * Получить промежуточный контекст
   */
  async getIntermediateContext(phone, companyId, maxAge = 300000) {
    const normalizedPhone = DataTransformers.normalizePhoneNumber(phone);
    
    return await this.intermediate.getContext(
      `${companyId}:${normalizedPhone}`,
      maxAge
    );
  }

  /**
   * Приватные методы
   */
  
  /**
   * Нормализация контекста из разных систем
   */
  _normalizeContext(context, source) {
    if (source === 'v2') {
      return {
        ...context,
        // Добавляем поля для совместимости со старой системой
        data: JSON.stringify({
          lastService: context.currentSelection?.service,
          lastDate: context.currentSelection?.date,
          lastStaff: context.currentSelection?.staff,
          lastTime: context.currentSelection?.time
        })
      };
    }
    
    // v1 контекст
    return {
      ...context,
      // Добавляем поля для совместимости с v2
      currentSelection: this._extractSelectionFromV1(context),
      dialogState: context.state || 'active'
    };
  }

  /**
   * Извлечь selection из старого формата
   */
  _extractSelectionFromV1(v1Context) {
    if (!v1Context.data) return {};
    
    try {
      const parsed = typeof v1Context.data === 'string' 
        ? JSON.parse(v1Context.data) 
        : v1Context.data;
      
      return {
        service: parsed.lastService || parsed.selectedService,
        date: parsed.lastDate || parsed.selectedDate,
        staff: parsed.lastStaff || parsed.selectedStaff,
        time: parsed.lastTime || parsed.selectedTime
      };
    } catch (error) {
      logger.error('Failed to parse v1 context data:', error);
      return {};
    }
  }

  /**
   * Миграция данных из v1 в v2
   */
  async _migrateToV2(phone, companyId, v1Context) {
    if (!v1Context || !v1Context.data) return;
    
    try {
      const selection = this._extractSelectionFromV1(v1Context);
      
      if (Object.keys(selection).length > 0) {
        await this.v2.updateDialogContext(phone, companyId, {
          selection,
          clientName: v1Context.clientName,
          state: 'active'
        });
        
        logger.debug('Migrated v1 context to v2', { phone, selection });
      }
    } catch (error) {
      logger.error('Failed to migrate context to v2:', error);
      this.metrics.migrationErrors++;
    }
  }

  /**
   * Минимальный контекст при ошибках
   */
  _getMinimalContext(phone, companyId) {
    return {
      phone,
      companyId,
      client: null,
      messages: [],
      currentSelection: {},
      error: 'Failed to load full context'
    };
  }

  /**
   * Получить статистику использования
   */
  getMetrics() {
    const total = this.metrics.v1Calls + this.metrics.v2Calls;
    return {
      ...this.metrics,
      v2Usage: total > 0 ? (this.metrics.v2Calls / total * 100).toFixed(2) + '%' : '0%',
      migrationProgress: total > 0 ? (this.metrics.v2Calls / total * 100).toFixed(2) + '%' : '0%'
    };
  }
}

// Singleton
module.exports = new UnifiedContextService();