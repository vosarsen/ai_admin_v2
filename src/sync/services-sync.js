/**
 * Синхронизация услуг из YClients в Supabase
 */

const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'services-sync' });
const { YCLIENTS_CONFIG, createYclientsHeaders, delay } = require('./sync-utils');
const axios = require('axios');

class ServicesSync {
  constructor() {
    this.config = YCLIENTS_CONFIG;
    this.tableName = 'services';
  }

  /**
   * Синхронизировать все услуги компании
   * @returns {Promise<Object>} Результат синхронизации
   */
  async sync() {
    const startTime = Date.now();
    
    try {
      logger.info('🛍️ Starting services synchronization...');
      
      // Получаем услуги из YClients API
      const services = await this.fetchServices();
      
      if (!services || services.length === 0) {
        logger.warn('No services found in YClients');
        return { 
          success: true, 
          processed: 0, 
          errors: 0, 
          total: 0,
          duration: Date.now() - startTime 
        };
      }

      logger.info(`📋 Found ${services.length} services to sync`);

      // Обрабатываем и сохраняем услуги
      const result = await this.saveServices(services);
      
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Services sync completed in ${duration}ms`, {
        processed: result.processed,
        errors: result.errors,
        total: services.length
      });

      return {
        success: true,
        ...result,
        duration
      };

    } catch (error) {
      logger.error('❌ Services sync failed', {
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
   * Получить услуги из YClients API
   * @returns {Promise<Array>} Массив услуг
   */
  async fetchServices() {
    try {
      const url = `${this.config.BASE_URL}/company/${this.config.COMPANY_ID}/services`;
      const headers = createYclientsHeaders(true);
      
      logger.debug('Fetching services from YClients', { url });
      
      const response = await axios.get(url, { headers });
      
      if (response.data?.success === false) {
        throw new Error(response.data?.meta?.message || 'API returned error');
      }
      
      return response.data?.data || [];
      
    } catch (error) {
      logger.error('Failed to fetch services from YClients', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Сохранить услуги в Supabase
   * @param {Array} services - Массив услуг
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveServices(services) {
    let processed = 0;
    let errors = 0;
    const errorDetails = [];

    for (const service of services) {
      try {
        const serviceData = this.prepareServiceData(service);
        
        const { error } = await supabase
          .from(this.tableName)
          .upsert(serviceData, { 
            onConflict: 'yclients_id,company_id',
            ignoreDuplicates: false 
          });

        if (error) {
          errors++;
          errorDetails.push({
            service: service.title,
            error: error.message
          });
          
          if (errors <= 5) {
            logger.warn(`Failed to save service: ${service.title}`, { error: error.message });
          }
        } else {
          processed++;
          
          if (processed % 10 === 0) {
            logger.debug(`Progress: ${processed}/${services.length} services processed`);
          }
        }

      } catch (error) {
        errors++;
        errorDetails.push({
          service: service.title || 'Unknown',
          error: error.message
        });
        
        if (errors <= 5) {
          logger.error('Error processing service', {
            service: service.title,
            error: error.message
          });
        }
      }
    }

    if (errors > 0) {
      logger.warn(`Services sync completed with ${errors} errors`, {
        errorCount: errors,
        firstErrors: errorDetails.slice(0, 5)
      });
    }

    return { processed, errors, errorDetails };
  }

  /**
   * Подготовить данные услуги для сохранения
   * @param {Object} service - Сырые данные услуги из API
   * @returns {Object} Подготовленные данные
   */
  prepareServiceData(service) {
    return {
      yclients_id: service.id,
      company_id: this.config.COMPANY_ID,
      title: service.title || 'Unnamed Service',
      category_id: service.category_id || null,
      category_title: service.category?.title || null,
      price_min: service.price_min || 0,
      price_max: service.price_max || service.price_min || 0,
      discount: service.discount || 0,
      duration: service.seance_length || null,
      seance_length: service.seance_length || null,
      is_active: service.active === 1 || service.active === "1",
      is_bookable: service.bookable !== 0 && service.bookable !== "0",
      description: service.comment || null,
      weight: service.weight || 0,
      last_sync_at: new Date().toISOString(),
      raw_data: service // Сохраняем полные данные для отладки
    };
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

module.exports = { ServicesSync };