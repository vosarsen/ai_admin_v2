// src/sync/sync-manager.js
const { logger } = require('../utils/logger');
const { UniversalYclientsSync } = require('../../universal-yclients-sync');

/**
 * 🔄 SYNC MANAGER - Централизованное управление синхронизацией
 * 
 * Интегрирует синхронизацию YClients -> Supabase в основное приложение
 * 
 * ФУНКЦИИ:
 * ✅ Автоматический запуск синхронизации при старте приложения
 * ✅ Периодическая синхронизация по расписанию
 * ✅ On-demand синхронизация через API endpoints
 * ✅ Мониторинг статуса синхронизации
 * ✅ Graceful shutdown при остановке приложения
 */
class SyncManager {
  constructor() {
    this.syncInstance = null;
    this.isInitialized = false;
    this.syncInterval = null;
    this.lastSyncStatus = {};
  }

  /**
   * Инициализация менеджера синхронизации
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        logger.info('Sync manager already initialized');
        return;
      }

      logger.info('🔄 Initializing sync manager...');
      
      // Создаем экземпляр синхронизатора
      this.syncInstance = new UniversalYclientsSync();
      
      // Проверяем статус последней синхронизации
      const status = await this.syncInstance.getSyncStatus();
      this.lastSyncStatus = this._processSyncStatus(status);
      
      logger.info('📊 Last sync status:', {
        services: this.lastSyncStatus.services?.last_sync_at || 'never',
        staff: this.lastSyncStatus.staff?.last_sync_at || 'never',
        clients: this.lastSyncStatus.clients?.last_sync_at || 'never',
        appointments: this.lastSyncStatus.appointments_cache?.last_sync_at || 'never'
      });

      // Проверяем, нужна ли начальная синхронизация
      const needsInitialSync = await this._checkNeedsInitialSync();
      if (needsInitialSync) {
        logger.info('🚀 Running initial sync...');
        await this.runFullSync();
      }

      // Запускаем периодическую синхронизацию
      this._startPeriodicSync();
      
      // НЕ запускаем встроенный cron scheduler, используем наш периодический sync
      // который более гибкий и частый для актуальности данных
      // this.syncInstance.startScheduledSync();
      
      this.isInitialized = true;
      logger.info('✅ Sync manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize sync manager:', error);
      throw error;
    }
  }

  /**
   * Проверка необходимости начальной синхронизации
   */
  async _checkNeedsInitialSync() {
    // Если хотя бы одна таблица никогда не синхронизировалась
    const criticalTables = ['services', 'staff', 'clients'];
    
    for (const table of criticalTables) {
      if (!this.lastSyncStatus[table] || !this.lastSyncStatus[table].last_sync_at) {
        logger.info(`Table ${table} was never synced, initial sync required`);
        return true;
      }
      
      // Если синхронизация была больше 24 часов назад
      const lastSync = new Date(this.lastSyncStatus[table].last_sync_at);
      const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSync > 24) {
        logger.info(`Table ${table} was synced ${Math.round(hoursSinceSync)} hours ago, sync recommended`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Запуск периодической синхронизации критических данных
   */
  _startPeriodicSync() {
    // Оптимизированная синхронизация
    this.syncInterval = setInterval(async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        
        // APPOINTMENTS синхронизируем только для истории, не для слотов
        // Слоты всегда берутся real-time из YClients API
        // Синхронизация appointments нужна только для аналитики
        
        // ПОЛНАЯ СИНХРОНИЗАЦИЯ - 2 раза в день
        // Ночью в 4:00 и днем в 14:00
        if ((hour === 4 || hour === 14) && minute === 0) {
          logger.info('🔄 Running twice-daily full sync...');
          
          // Clients (клиенты) - 7 запросов
          await this.syncClients();
          
          // Services (услуги) - 1 запрос
          await this.syncServices();
          
          // Staff (мастера) - 2 запроса
          await this.syncStaff();
          
          // Schedules (расписание мастеров) - ~32 запроса (оптимизировано с book_dates API)
          await this.syncSchedules();
          
          // Appointments (история записей для аналитики) - 1 запрос
          await this.syncAppointments();
          
          logger.info('✅ Twice-daily sync completed');
        }
        
        // Итого: 2×43 = 86 запросов в день (оптимизировано с 134)
        // Это менее 4 запросов в час - минимальная нагрузка на API
        
      } catch (error) {
        logger.error('Periodic sync failed:', error);
      }
    }, 60 * 1000); // Проверяем каждую минуту
  }

  /**
   * Полная синхронизация всех данных
   */
  async runFullSync() {
    try {
      logger.info('🔄 Starting full synchronization...');
      const results = await this.syncInstance.fullSync();
      
      // Обновляем статус
      this.lastSyncStatus = await this.syncInstance.getSyncStatus();
      
      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Full sync failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Синхронизация услуг
   */
  async syncServices() {
    try {
      logger.info('🛍️ Syncing services...');
      const result = await this.syncInstance.syncServices();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Services sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация мастеров
   */
  async syncStaff() {
    try {
      logger.info('👥 Syncing staff...');
      const result = await this.syncInstance.syncStaff();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Staff sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация клиентов
   */
  async syncClients() {
    try {
      logger.info('👤 Syncing clients...');
      const result = await this.syncInstance.syncClients();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Clients sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация записей
   */
  async syncAppointments() {
    try {
      logger.info('📅 Syncing appointments...');
      const result = await this.syncInstance.syncAppointments();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Appointments sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация расписаний мастеров
   * 
   * Использует оптимизированную логику с YClients book_dates API:
   * - Определяет is_working на основе working_dates (авторитетный источник)
   * - Добавляет has_booking_slots для отслеживания доступных слотов
   * - Снижена нагрузка на API: ~32 запроса вместо 56
   */
  async syncSchedules() {
    try {
      logger.info('⏰ Syncing schedules...');
      const result = await this.syncInstance.syncStaffSchedules();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Schedules sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить текущий статус синхронизации
   */
  async getSyncStatus() {
    try {
      const status = await this.syncInstance.getSyncStatus();
      this.lastSyncStatus = this._processSyncStatus(status);
      
      return {
        success: true,
        status: this.lastSyncStatus,
        isRunning: this.isInitialized,
        nextSync: this._getNextSyncTime()
      };
      
    } catch (error) {
      logger.error('Failed to get sync status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обработка статуса синхронизации
   */
  _processSyncStatus(statusArray) {
    const processed = {};
    
    for (const item of statusArray) {
      processed[item.table_name] = {
        last_sync_at: item.last_sync_at,
        sync_status: item.sync_status,
        records_processed: item.records_processed,
        error_message: item.error_message,
        duration_ms: item.sync_duration_ms
      };
    }
    
    return processed;
  }

  /**
   * Получить время следующей синхронизации
   */
  _getNextSyncTime() {
    const now = new Date();
    const next = new Date(now);
    
    // Следующая синхронизация через 30 минут
    next.setMinutes(Math.ceil(now.getMinutes() / 30) * 30);
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    if (next <= now) {
      next.setMinutes(next.getMinutes() + 30);
    }
    
    return next.toISOString();
  }

  /**
   * Остановка менеджера синхронизации
   */
  async shutdown() {
    logger.info('🛑 Shutting down sync manager...');
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.syncInstance) {
      this.syncInstance.stopSync();
      this.syncInstance = null;
    }
    
    this.isInitialized = false;
    logger.info('✅ Sync manager stopped');
  }
}

// Singleton instance
const syncManager = new SyncManager();

module.exports = { syncManager };