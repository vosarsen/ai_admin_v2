/**
 * Синхронизация мастеров из YClients в Supabase
 */

const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'staff-sync' });
const { YCLIENTS_CONFIG, createYclientsHeaders, delay } = require('./sync-utils');
const axios = require('axios');
const staffDeclension = require('../services/declension/staff-declension');

class StaffSync {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.tableName = 'staff';
  }

  /**
   * Синхронизировать всех мастеров компании
   * @returns {Promise<Object>} Результат синхронизации
   */
  async sync() {
    const startTime = Date.now();
    
    try {
      logger.info('👥 Starting staff synchronization...');
      
      // Получаем мастеров из YClients API
      const staff = await this.fetchStaff();
      
      if (!staff || staff.length === 0) {
        logger.warn('No staff found in YClients');
        return { 
          success: true, 
          processed: 0, 
          errors: 0, 
          total: 0,
          duration: Date.now() - startTime 
        };
      }

      logger.info(`📋 Found ${staff.length} active staff members to sync`);

      // Получаем существующих мастеров из БД для сохранения склонений
      logger.info('📚 Loading existing staff from database...');
      const { data: existingStaff } = await supabase
        .from(this.tableName)
        .select('yclients_id, declensions')
        .eq('company_id', this.config.COMPANY_ID);
      
      // Создаем маппинг существующих склонений
      // ВАЖНО: staffMember.id из YClients API соответствует yclients_id в нашей БД
      const existingDeclensionsMap = new Map();
      if (existingStaff) {
        existingStaff.forEach(staffMember => {
          if (staffMember.declensions) {
            // Используем yclients_id как ключ, так как он будет сравниваться с staffMember.id из API
            existingDeclensionsMap.set(staffMember.yclients_id, staffMember.declensions);
          }
        });
      }
      logger.info(`📝 Found ${existingDeclensionsMap.size} existing staff declensions`);

      // Определяем новых мастеров (для которых нужно генерировать склонения)
      const newStaff = staff.filter(staffMember => 
        !existingDeclensionsMap.has(staffMember.id)
      );
      
      if (newStaff.length > 0) {
        logger.info(`🆕 Found ${newStaff.length} new staff members, generating declensions...`);
        const declensionsMap = await staffDeclension.generateBatchDeclensions(newStaff);
        
        // Добавляем новые склонения к мастерам
        newStaff.forEach(staffMember => {
          if (declensionsMap.has(staffMember.id)) {
            existingDeclensionsMap.set(staffMember.id, declensionsMap.get(staffMember.id));
          }
        });
      }
      
      // Применяем склонения ко всем мастерам (существующие или новые)
      staff.forEach(staffMember => {
        if (existingDeclensionsMap.has(staffMember.id)) {
          staffMember.declensions = existingDeclensionsMap.get(staffMember.id);
        }
      });

      // Сначала деактивируем всех существующих мастеров в базе
      await this.deactivateAllStaff();

      // Обрабатываем и сохраняем активных мастеров
      const result = await this.saveStaff(staff);
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Staff sync completed in ${duration}ms`, {
        processed: result.processed,
        errors: result.errors,
        total: staff.length
      });

      return {
        success: true,
        ...result,
        duration
      };

    } catch (error) {
      logger.error('❌ Staff sync failed', {
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
   * Получить мастеров из YClients API
   * @returns {Promise<Array>} Массив мастеров
   */
  async fetchStaff() {
    try {
      const url = `${this.config.BASE_URL}/company/${this.config.COMPANY_ID}/staff`;
      const headers = createYclientsHeaders(true);
      
      logger.debug('Fetching staff from YClients', { url });
      
      const response = await axios.get(url, { headers });
      
      if (response.data?.success === false) {
        throw new Error(response.data?.meta?.message || 'API returned error');
      }
      
      // Фильтруем только активных сотрудников
      const allStaff = response.data?.data || [];
      const activeStaff = allStaff.filter(staff => {
        // fired: 0 или "0" - работает, 1 или "1" - уволен
        // hidden: 0 или "0" - показывается, 1 или "1" - скрыт
        const isFired = staff.fired === 1 || staff.fired === "1" || staff.fired === true;
        const isHidden = staff.hidden === 1 || staff.hidden === "1" || staff.hidden === true;
        
        return !isFired && !isHidden;
      });
      
      logger.info(`Filtered ${activeStaff.length} active staff from ${allStaff.length} total`);
      
      return activeStaff;
      
    } catch (error) {
      logger.error('Failed to fetch staff from YClients', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Сохранить мастеров в Supabase
   * @param {Array} staffList - Массив мастеров
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveStaff(staffList) {
    let processed = 0;
    let errors = 0;
    const errorDetails = [];

    for (const staff of staffList) {
      try {
        const staffData = this.prepareStaffData(staff);
        
        const { error } = await supabase
          .from(this.tableName)
          .upsert(staffData, { 
            onConflict: 'yclients_id,company_id',
            ignoreDuplicates: false 
          });

        if (error) {
          errors++;
          errorDetails.push({
            staff: staff.name,
            error: error.message
          });
          
          if (errors <= 5) {
            logger.warn(`Failed to save staff: ${staff.name}`, { error: error.message });
          }
        } else {
          processed++;
          
          if (processed % 10 === 0) {
            logger.debug(`Progress: ${processed}/${staffList.length} staff processed`);
          }
        }

      } catch (error) {
        errors++;
        errorDetails.push({
          staff: staff.name || 'Unknown',
          error: error.message
        });
        
        if (errors <= 5) {
          logger.error('Error processing staff', {
            staff: staff.name,
            error: error.message
          });
        }
      }
    }

    if (errors > 0) {
      logger.warn(`Staff sync completed with ${errors} errors`, {
        errorCount: errors,
        firstErrors: errorDetails.slice(0, 5)
      });
    }

    return { processed, errors, errorDetails };
  }

  /**
   * Подготовить данные мастера для сохранения
   * @param {Object} staff - Сырые данные мастера из API
   * @returns {Object} Подготовленные данные
   */
  prepareStaffData(staff) {
    return {
      yclients_id: staff.id,
      company_id: this.config.COMPANY_ID,
      name: staff.name || 'Unnamed Staff',
      specialization: staff.specialization || staff.position?.title || null,
      position: staff.position?.title || null,
      phone: staff.phone || null,
      email: staff.email || null,
      avatar_url: staff.avatar || staff.avatar_big || null,
      is_active: staff.hidden === 0 || staff.hidden === "0",
      rating: staff.rating || 0,
      is_bookable: staff.bookable !== 0 && staff.bookable !== "0",
      information: staff.information || staff.comment || null,
      declensions: staff.declensions || null, // Сохраняем склонения
      last_sync_at: new Date().toISOString(),
      raw_data: staff // Сохраняем полные данные для отладки
    };
  }

  /**
   * Деактивировать всех сотрудников перед синхронизацией
   * @returns {Promise<void>}
   */
  async deactivateAllStaff() {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .update({ is_active: false })
        .eq('company_id', this.config.COMPANY_ID);
      
      if (error) {
        logger.warn('Failed to deactivate staff', { error: error.message });
      } else {
        logger.debug('All staff deactivated before sync');
      }
    } catch (error) {
      logger.error('Error deactivating staff', { error: error.message });
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

module.exports = { StaffSync };