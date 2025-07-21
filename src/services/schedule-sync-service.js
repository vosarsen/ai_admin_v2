/**
 * Сервис автоматической синхронизации расписания мастеров
 * Обновляет данные из YClients в Supabase
 */

const { supabase } = require('../database/supabase');
const { YclientsClient } = require('../integrations/yclients/client');
const logger = require('../utils/logger').child({ module: 'schedule-sync-service' });
const config = require('../config');

class ScheduleSyncService {
  constructor() {
    this.yclientsClient = new YclientsClient();
    this.companyId = config.yclients.companyId || 962302;
    this.syncInterval = null;
    this.lastSyncTime = null;
  }

  /**
   * Синхронизация расписания на указанную дату
   */
  async syncScheduleForDate(date) {
    try {
      logger.info(`Syncing schedule for date: ${date}`);
      
      // Получаем список активных мастеров
      const { data: staffList } = await supabase
        .from('staff')
        .select('*')
        .eq('company_id', this.companyId)
        .eq('is_active', true);
      
      if (!staffList || staffList.length === 0) {
        logger.warn('No active staff found for sync');
        return { success: false, message: 'No active staff' };
      }
      
      const updates = [];
      
      // Для каждого мастера проверяем доступность
      for (const staff of staffList) {
        try {
          const result = await this.yclientsClient.getAvailableSlots(
            staff.yclients_id,
            date,
            {},
            this.companyId
          );
          
          const slots = result?.data?.data || [];
          const hasSlots = slots && slots.length > 0;
          
          updates.push({
            staff_id: staff.yclients_id,
            staff_name: staff.name,
            date: date,
            is_working: hasSlots,
            has_booking_slots: hasSlots,
            slots_count: slots.length,
            last_updated: new Date().toISOString()
          });
          
          logger.info(`${staff.name} on ${date}: ${hasSlots ? `${slots.length} slots` : 'no slots'}`);
          
        } catch (error) {
          logger.error(`Error checking slots for ${staff.name}:`, error);
        }
      }
      
      // Обновляем все записи одним запросом
      if (updates.length > 0) {
        const { error } = await supabase
          .from('staff_schedules')
          .upsert(updates, {
            onConflict: 'staff_id,date'
          });
        
        if (error) {
          logger.error('Error updating schedules:', error);
          return { success: false, error };
        }
      }
      
      return { 
        success: true, 
        updatedCount: updates.length,
        date: date 
      };
      
    } catch (error) {
      logger.error(`Sync error for date ${date}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Синхронизация расписания на следующие N дней
   */
  async syncScheduleForDays(days = 7) {
    logger.info(`Starting schedule sync for next ${days} days`);
    const results = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const result = await this.syncScheduleForDate(dateStr);
      results.push(result);
      
      // Небольшая задержка между запросами
      if (i < days - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    logger.info(`Schedule sync completed: ${successCount}/${days} days synced successfully`);
    
    this.lastSyncTime = new Date();
    
    return {
      success: successCount === days,
      totalDays: days,
      successfulDays: successCount,
      lastSyncTime: this.lastSyncTime,
      results
    };
  }

  /**
   * Запуск автоматической синхронизации по расписанию
   */
  startAutoSync(intervalMinutes = 30) {
    if (this.syncInterval) {
      logger.warn('Auto sync already running');
      return;
    }
    
    logger.info(`Starting auto sync every ${intervalMinutes} minutes`);
    
    // Первая синхронизация сразу
    this.syncScheduleForDays(7);
    
    // Затем по интервалу
    this.syncInterval = setInterval(() => {
      logger.info('Running scheduled sync...');
      this.syncScheduleForDays(7);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Остановка автоматической синхронизации
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Auto sync stopped');
    }
  }

  /**
   * Получение статуса синхронизации
   */
  getStatus() {
    return {
      isRunning: !!this.syncInterval,
      lastSyncTime: this.lastSyncTime,
      timeSinceLastSync: this.lastSyncTime 
        ? `${Math.round((Date.now() - this.lastSyncTime.getTime()) / 60000)} minutes ago`
        : 'Never'
    };
  }
}

// Создаем singleton экземпляр
const scheduleSyncService = new ScheduleSyncService();

module.exports = scheduleSyncService;