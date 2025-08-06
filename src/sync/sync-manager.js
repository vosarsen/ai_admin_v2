/**
 * Централизованное управление синхронизацией данных YClients → Supabase
 * 
 * Координирует работу всех модулей синхронизации и управляет расписанием
 */

const logger = require('../utils/logger').child({ module: 'sync-manager' });
const cron = require('node-cron');

// Импортируем модули синхронизации
const { CompanyInfoSync } = require('./company-info-sync');
const { ServicesSync } = require('./services-sync');
const { StaffSync } = require('./staff-sync');
const { ClientsSync } = require('./clients-sync');
const { SchedulesSync } = require('./schedules-sync');
const { ClientRecordsSync } = require('./client-records-sync');

/**
 * Менеджер синхронизации данных
 */
class SyncManager {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
    this.cronJobs = [];
    
    // Инициализируем модули синхронизации
    this.modules = {
      company: new CompanyInfoSync(),
      services: new ServicesSync(),
      staff: new StaffSync(),
      clients: new ClientsSync(),
      schedules: new SchedulesSync(),
      clientRecords: new ClientRecordsSync()
    };
    
    // Расписание синхронизации (Moscow time UTC+3)
    this.schedule = {
      services: '0 1 * * *',     // 01:00 - Услуги (раз в день)
      staff: '0 2 * * *',        // 02:00 - Мастера (раз в день)
      clients: '0 3 * * *',      // 03:00 - Клиенты (раз в день)
      schedules: '0 */4 * * *',  // Каждые 4 часа - Расписания
      company: '0 0 * * 0'       // 00:00 воскресенье - Компания (раз в неделю)
    };
  }

  /**
   * Инициализация менеджера синхронизации
   */
  async initialize() {
    if (this.isInitialized) {
      logger.info('Sync manager already initialized');
      return;
    }

    try {
      logger.info('🔄 Initializing sync manager...');
      
      // Проверяем необходимость начальной синхронизации
      const needsInitialSync = await this.checkNeedsInitialSync();
      
      if (needsInitialSync) {
        logger.info('📊 Running initial synchronization...');
        await this.runFullSync();
      }
      
      // Запускаем периодическую синхронизацию
      this.startScheduledSync();
      
      this.isInitialized = true;
      logger.info('✅ Sync manager initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize sync manager', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Проверить необходимость начальной синхронизации
   */
  async checkNeedsInitialSync() {
    try {
      // Здесь можно проверить, когда была последняя синхронизация
      // Для простоты возвращаем false
      return false;
    } catch (error) {
      logger.error('Error checking sync status', { error: error.message });
      return true;
    }
  }

  /**
   * Запустить полную синхронизацию всех данных
   */
  async runFullSync() {
    if (this.isRunning) {
      logger.warn('Sync already running, skipping...');
      return { success: false, message: 'Sync already in progress' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const results = {};

    try {
      logger.info('🚀 Starting full synchronization...');
      
      // Синхронизируем в правильном порядке
      // 1. Компания (базовая информация)
      logger.info('1/5 🏢 Syncing company info...');
      results.company = await this.syncCompany();
      
      // 2. Услуги
      logger.info('2/5 🛍️ Syncing services...');
      results.services = await this.syncServices();
      
      // 3. Мастера
      logger.info('3/5 👥 Syncing staff...');
      results.staff = await this.syncStaff();
      
      // 4. Клиенты
      logger.info('4/5 👤 Syncing clients...');
      results.clients = await this.syncClients();
      
      // 5. Расписания
      logger.info('5/5 ⏰ Syncing schedules...');
      results.schedules = await this.syncSchedules();
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      logger.info(`✅ Full sync completed in ${duration} seconds`, {
        results
      });
      
      return {
        success: true,
        duration,
        results
      };
      
    } catch (error) {
      logger.error('Full sync failed', {
        error: error.message,
        results
      });
      
      return {
        success: false,
        error: error.message,
        results
      };
      
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Запустить периодическую синхронизацию по расписанию
   */
  startScheduledSync() {
    if (this.cronJobs.length > 0) {
      logger.warn('Scheduled sync already running');
      return;
    }

    logger.info('📅 Starting scheduled synchronization...');
    
    // Услуги - ежедневно в 01:00
    this.cronJobs.push(
      cron.schedule(this.schedule.services, async () => {
        logger.info('🛍️ Running scheduled services sync...');
        await this.syncServices();
      }, { timezone: 'Europe/Moscow' })
    );
    
    // Мастера - ежедневно в 02:00
    this.cronJobs.push(
      cron.schedule(this.schedule.staff, async () => {
        logger.info('👥 Running scheduled staff sync...');
        await this.syncStaff();
      }, { timezone: 'Europe/Moscow' })
    );
    
    // Клиенты - ежедневно в 03:00
    this.cronJobs.push(
      cron.schedule(this.schedule.clients, async () => {
        logger.info('👤 Running scheduled clients sync...');
        await this.syncClients();
      }, { timezone: 'Europe/Moscow' })
    );
    
    // Расписания - каждые 4 часа
    this.cronJobs.push(
      cron.schedule(this.schedule.schedules, async () => {
        logger.info('⏰ Running scheduled schedules sync...');
        await this.syncSchedules();
      }, { timezone: 'Europe/Moscow' })
    );
    
    // Компания - раз в неделю
    this.cronJobs.push(
      cron.schedule(this.schedule.company, async () => {
        logger.info('🏢 Running scheduled company sync...');
        await this.syncCompany();
      }, { timezone: 'Europe/Moscow' })
    );
    
    logger.info('✅ Scheduled sync started', {
      schedule: this.schedule
    });
  }

  /**
   * Остановить периодическую синхронизацию
   */
  stopScheduledSync() {
    if (this.cronJobs.length === 0) {
      logger.warn('No scheduled sync to stop');
      return;
    }

    logger.info('⏹️ Stopping scheduled synchronization...');
    
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs = [];
    
    logger.info('✅ Scheduled sync stopped');
  }

  /**
   * Синхронизация информации о компании
   */
  async syncCompany() {
    try {
      logger.info('🏢 Syncing company information...');
      const result = await this.modules.company.syncCompanyInfo();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Company sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация услуг
   */
  async syncServices() {
    try {
      logger.info('🛍️ Syncing services...');
      const result = await this.modules.services.sync();
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
      const result = await this.modules.staff.sync();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Staff sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация клиентов
   */
  async syncClients(options = {}) {
    try {
      logger.info('👤 Syncing clients...');
      const result = await this.modules.clients.sync(options);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Clients sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация расписаний
   */
  async syncSchedules() {
    try {
      logger.info('⏰ Syncing schedules...');
      const result = await this.modules.schedules.sync();
      return { success: true, ...result };
    } catch (error) {
      logger.error('Schedules sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация записей клиента по телефону
   */
  async syncClientRecords(phone) {
    try {
      logger.info(`📋 Syncing records for client: ${phone}`);
      const result = await this.modules.clientRecords.syncClientRecordsByPhone(phone);
      return { success: true, ...result };
    } catch (error) {
      logger.error('Client records sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Остановка менеджера синхронизации
   */
  async shutdown() {
    logger.info('🛑 Shutting down sync manager...');
    
    // Останавливаем периодическую синхронизацию
    this.stopScheduledSync();
    
    // Ждем завершения текущей синхронизации
    if (this.isRunning) {
      logger.info('Waiting for current sync to complete...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 1000);
      });
    }
    
    this.isInitialized = false;
    logger.info('✅ Sync manager stopped');
  }

  /**
   * Получить статус синхронизации
   */
  async getStatus() {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      scheduledJobs: this.cronJobs.length,
      schedule: this.schedule
    };
  }
}

// Singleton экземпляр
let syncManagerInstance = null;

/**
 * Получить экземпляр менеджера синхронизации
 */
function getSyncManager() {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}

module.exports = {
  SyncManager,
  getSyncManager
};