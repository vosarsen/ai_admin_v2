/**
 * Синхронизация расписаний мастеров из YClients в PostgreSQL
 * Migrated from Supabase to Repository Pattern (2025-11-26)
 */

const postgres = require('../database/postgres');
const StaffScheduleRepository = require('../repositories/StaffScheduleRepository');
const logger = require('../utils/logger').child({ module: 'schedules-sync' });
const { YCLIENTS_CONFIG, createYclientsHeaders, delay, formatDateForAPI } = require('./sync-utils');
const axios = require('axios');

class SchedulesSync {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.tableName = 'staff_schedules';
    this.scheduleRepo = new StaffScheduleRepository(postgres.pool);
  }

  /**
   * Синхронизировать расписания всех мастеров на 30 дней вперед
   * @returns {Promise<Object>} Результат синхронизации
   */
  async sync() {
    const startTime = Date.now();
    
    try {
      logger.info('⏰ Starting schedules synchronization...');
      
      // Получаем список мастеров
      const staff = await this.fetchStaff();
      
      if (!staff || staff.length === 0) {
        logger.warn('No staff found for schedule sync');
        return { 
          success: true, 
          processed: 0, 
          errors: 0, 
          total: 0,
          duration: Date.now() - startTime 
        };
      }

      logger.info(`📋 Found ${staff.length} staff members to sync schedules`);

      // Очищаем старые расписания
      await this.cleanupOldSchedules();
      
      // Синхронизируем расписания для каждого мастера
      const result = await this.syncAllSchedules(staff);
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Schedules sync completed in ${duration}ms`, {
        processed: result.processed,
        errors: result.errors,
        total: result.total
      });

      return {
        success: true,
        ...result,
        duration
      };

    } catch (error) {
      logger.error('❌ Schedules sync failed', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Получить список мастеров
   * @returns {Promise<Array>} Массив мастеров
   */
  async fetchStaff() {
    try {
      const url = `${this.config.BASE_URL}/book_staff/${this.config.COMPANY_ID}`;
      const headers = createYclientsHeaders(false); // Только bearer token
      
      logger.debug('Fetching bookable staff from YClients', { url });
      
      const response = await axios.get(url, { headers });
      
      if (response.data?.success === false) {
        throw new Error(response.data?.meta?.message || 'API returned error');
      }
      
      // Фильтруем только активных мастеров
      const staff = (response.data?.data || [])
        .filter(s => s.bookable && !s.hidden && !s.fired);
      
      return staff;
      
    } catch (error) {
      logger.error('Failed to fetch staff from YClients', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Синхронизировать расписания всех мастеров
   * @param {Array} staff - Массив мастеров
   * @returns {Promise<Object>} Результат синхронизации
   */
  async syncAllSchedules(staff) {
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalSlots = 0;

    for (const staffMember of staff) {
      try {
        logger.debug(`Syncing schedule for ${staffMember.name} (ID: ${staffMember.id})`);
        
        // Получаем расписание на 30 дней вперед
        const schedules = await this.fetchStaffSchedule(staffMember.id);
        
        if (schedules && schedules.length > 0) {
          const result = await this.saveSchedules(staffMember, schedules);
          totalProcessed += result.processed;
          totalErrors += result.errors;
          totalSlots += schedules.length;
          
          logger.debug(`Saved ${result.processed} schedule days for ${staffMember.name}`);
        }
        
        // Задержка между запросами
        await delay(this.config.API_DELAY_MS);
        
      } catch (error) {
        totalErrors++;
        logger.error(`Failed to sync schedule for ${staffMember.name}`, {
          staffId: staffMember.id,
          error: error.message
        });
      }
    }

    return {
      processed: totalProcessed,
      errors: totalErrors,
      total: totalSlots
    };
  }

  /**
   * Получить расписание мастера на 30 дней
   * @param {number} staffId - ID мастера
   * @param {number} daysAhead - Количество дней вперёд (по умолчанию 30)
   * @returns {Promise<Array>} Массив расписаний по дням
   */
  async fetchStaffSchedule(staffId, daysAhead = 30) {
    try {
      const url = `${this.config.BASE_URL}/book_dates/${this.config.COMPANY_ID}`;
      const headers = createYclientsHeaders(false);

      // Период на daysAhead дней вперед
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysAhead);

      const params = {
        staff_id: staffId,
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate)
      };

      const response = await axios.get(url, { headers, params });

      if (response.data?.success === false) {
        throw new Error(response.data?.meta?.message || 'API returned error');
      }

      // Возвращаем массив дат с расписаниями
      return response.data?.data?.booking_dates || [];

    } catch (error) {
      logger.error('Failed to fetch staff schedule', {
        staffId,
        daysAhead,
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Сохранить расписания в PostgreSQL (батчевый upsert)
   * @param {Object} staffMember - Данные мастера
   * @param {Array} schedules - Массив дат (строки формата YYYY-MM-DD)
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveSchedules(staffMember, schedules) {
    // Подготавливаем данные для всех расписаний
    const preparedSchedules = [];

    for (const dateString of schedules) {
      // Валидация даты
      if (!dateString || typeof dateString !== 'string') {
        logger.warn(`Invalid date for ${staffMember.name}: ${dateString}`);
        continue;
      }

      preparedSchedules.push({
        yclients_staff_id: staffMember.id,
        company_id: this.config.COMPANY_ID,
        staff_name: staffMember.name,
        date: dateString,
        is_working: true,
        has_booking_slots: true,
        working_hours: null,
        last_updated: new Date().toISOString()
      });
    }

    if (preparedSchedules.length === 0) {
      return { processed: 0, errors: 0 };
    }

    try {
      const result = await this.scheduleRepo.syncBulkUpsert(preparedSchedules);
      return { processed: result.count, errors: 0 };
    } catch (error) {
      logger.error('❌ Batch upsert failed for schedules', { error: error.message });
      return { processed: 0, errors: preparedSchedules.length };
    }
  }

  /**
   * Очистить старые расписания (старше 7 дней)
   * @returns {Promise<void>}
   */
  async cleanupOldSchedules() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const query = `
        DELETE FROM staff_schedules
        WHERE date < $1
      `;
      await postgres.query(query, [formatDateForAPI(sevenDaysAgo)]);
      logger.debug('Old schedules cleaned up');

    } catch (error) {
      logger.error('Error during schedule cleanup', { error: error.message });
    }
  }

  /**
   * Синхронизировать расписания только на сегодня + завтра (инкрементальная синхронизация)
   * @returns {Promise<Object>} Результат синхронизации
   */
  async syncTodayOnly() {
    const startTime = Date.now();

    try {
      logger.info('🔄 Starting TODAY-ONLY schedules synchronization...');

      // Получаем список мастеров
      const staff = await this.fetchStaff();

      if (!staff || staff.length === 0) {
        logger.warn('No staff found for today-only sync');
        return {
          success: true,
          processed: 0,
          errors: 0,
          total: 0,
          duration: Date.now() - startTime,
          mode: 'today-only'
        };
      }

      logger.info(`📋 Found ${staff.length} staff members for today-only sync`);

      // Синхронизируем расписания только на 2 дня (сегодня + завтра)
      const result = await this.syncAllSchedulesToday(staff);

      const duration = Date.now() - startTime;

      logger.info(`✅ TODAY-ONLY schedules sync completed in ${duration}ms`, {
        processed: result.processed,
        errors: result.errors,
        total: result.total,
        mode: 'today-only'
      });

      return {
        success: true,
        ...result,
        duration,
        mode: 'today-only'
      };

    } catch (error) {
      logger.error('❌ TODAY-ONLY schedules sync failed', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        mode: 'today-only'
      };
    }
  }

  /**
   * Синхронизировать расписания только на сегодня + завтра для всех мастеров
   * @param {Array} staff - Массив мастеров
   * @returns {Promise<Object>} Результат синхронизации
   */
  async syncAllSchedulesToday(staff) {
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalSlots = 0;

    for (const staffMember of staff) {
      try {
        logger.debug(`Syncing TODAY schedule for ${staffMember.name} (ID: ${staffMember.id})`);

        // Получаем расписание только на 2 дня (сегодня + завтра)
        const schedules = await this.fetchStaffSchedule(staffMember.id, 2);

        if (schedules && schedules.length > 0) {
          const result = await this.saveSchedules(staffMember, schedules);
          totalProcessed += result.processed;
          totalErrors += result.errors;
          totalSlots += schedules.length;

          logger.debug(`Saved ${result.processed} TODAY schedule days for ${staffMember.name}`);
        }

        // Задержка между запросами
        await delay(this.config.API_DELAY_MS);

      } catch (error) {
        totalErrors++;
        logger.error(`Failed to sync TODAY schedule for ${staffMember.name}`, {
          staffId: staffMember.id,
          error: error.message
        });
      }
    }

    return {
      processed: totalProcessed,
      errors: totalErrors,
      total: totalSlots
    };
  }

  /**
   * Обновить статус синхронизации
   * @param {string} status - Статус синхронизации
   * @param {number} recordsProcessed - Количество обработанных записей
   * @param {string} errorMessage - Сообщение об ошибке
   */
  async updateSyncStatus(status, recordsProcessed = 0, errorMessage = null) {
    // Метод не используется в текущей реализации
    // Статус синхронизации логируется, но не сохраняется в БД
    logger.debug('updateSyncStatus called (no-op)', { status, recordsProcessed });
  }
}

module.exports = { SchedulesSync };