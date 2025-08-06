/**
 * Синхронизация расписаний мастеров из YClients в Supabase
 */

const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'schedules-sync' });
const { YCLIENTS_CONFIG, createYclientsHeaders, delay, formatDateForAPI } = require('./sync-utils');
const axios = require('axios');

class SchedulesSync {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.tableName = 'staff_schedules';
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
   * @returns {Promise<Array>} Массив расписаний по дням
   */
  async fetchStaffSchedule(staffId) {
    try {
      const url = `${this.config.BASE_URL}/book_dates/${this.config.COMPANY_ID}`;
      const headers = createYclientsHeaders(false);
      
      // Период на 30 дней вперед
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
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
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Сохранить расписания в Supabase
   * @param {Object} staffMember - Данные мастера
   * @param {Array} schedules - Массив расписаний
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveSchedules(staffMember, schedules) {
    let processed = 0;
    let errors = 0;

    for (const schedule of schedules) {
      try {
        const scheduleData = {
          staff_id: staffMember.id,
          staff_name: staffMember.name,
          company_id: this.config.COMPANY_ID,
          date: schedule.date,
          is_working: schedule.is_working || false,
          has_booking_slots: schedule.has_free_slots || false,
          working_hours: schedule.working_hours || null,
          seances: schedule.seances || [],
          free_seances_count: schedule.free_seances_count || 0,
          busy_seances_count: schedule.busy_seances_count || 0,
          total_seances_count: schedule.total_seances_count || 0,
          last_sync_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from(this.tableName)
          .upsert(scheduleData, { 
            onConflict: 'staff_id,date,company_id',
            ignoreDuplicates: false 
          });

        if (error) {
          errors++;
          if (errors <= 5) {
            logger.warn(`Failed to save schedule for ${staffMember.name} on ${schedule.date}`, { 
              error: error.message 
            });
          }
        } else {
          processed++;
        }

      } catch (error) {
        errors++;
        if (errors <= 5) {
          logger.error('Error processing schedule', {
            staff: staffMember.name,
            date: schedule.date,
            error: error.message
          });
        }
      }
    }

    return { processed, errors };
  }

  /**
   * Очистить старые расписания (старше 7 дней)
   * @returns {Promise<void>}
   */
  async cleanupOldSchedules() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .lt('date', formatDateForAPI(sevenDaysAgo))
        .eq('company_id', this.config.COMPANY_ID);
      
      if (error) {
        logger.warn('Failed to cleanup old schedules', { error: error.message });
      } else {
        logger.debug('Old schedules cleaned up');
      }
      
    } catch (error) {
      logger.error('Error during schedule cleanup', { error: error.message });
    }
  }

  /**
   * Обновить статус синхронизации
   * @param {string} status - Статус синхронизации
   * @param {number} recordsProcessed - Количество обработанных записей
   * @param {string} errorMessage - Сообщение об ошибке
   */
  async updateSyncStatus(status, recordsProcessed = 0, errorMessage = null) {
    try {
      await supabase
        .from('sync_status')
        .upsert({
          table_name: this.tableName,
          company_id: this.config.COMPANY_ID,
          sync_status: status,
          last_sync_at: new Date().toISOString(),
          records_processed: recordsProcessed,
          error_message: errorMessage
        }, {
          onConflict: 'table_name,company_id'
        });
    } catch (error) {
      logger.error('Failed to update sync status', { error: error.message });
    }
  }
}

module.exports = { SchedulesSync };