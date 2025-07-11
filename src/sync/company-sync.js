// src/sync/company-sync.js
const { YclientsClient } = require('../integrations/yclients/client');
const { supabase } = require('../database/supabase');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Синхронизация данных компании из YClients в Supabase
 * Загружает информацию о компании через YClients API и обновляет локальную БД
 */
class CompanySync {
  constructor() {
    this.yclientsClient = new YclientsClient();
    this.syncInterval = null;
  }

  /**
   * Синхронизировать данные компании
   * @param {string} companyId - ID компании в YClients
   * @returns {Promise<Object>} Результат синхронизации
   */
  async syncCompany(companyId = config.yclients.companyId) {
    const startTime = Date.now();
    logger.info(`🏢 Starting company sync for ID: ${companyId}`);

    try {
      // 1. Получаем данные компании из YClients
      const companyData = await this.fetchCompanyData(companyId);
      
      if (!companyData) {
        throw new Error('Failed to fetch company data from YClients');
      }

      // 2. Подготавливаем данные для сохранения
      const preparedData = this.prepareCompanyData(companyId, companyData);

      // 3. Сохраняем в Supabase
      const result = await this.saveToDatabase(preparedData);

      const duration = Date.now() - startTime;
      logger.info(`✅ Company sync completed in ${duration}ms`, {
        companyId,
        companyName: preparedData.title,
        duration
      });

      return {
        success: true,
        companyId,
        companyName: preparedData.title,
        duration,
        data: result
      };

    } catch (error) {
      logger.error('❌ Company sync failed', {
        companyId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        companyId,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Получить данные компании из YClients API
   * @param {string} companyId - ID компании
   * @returns {Promise<Object|null>} Данные компании или null при ошибке
   */
  async fetchCompanyData(companyId) {
    try {
      logger.debug(`📡 Fetching company data from YClients for ID: ${companyId}`);
      
      const response = await this.yclientsClient.getCompanyInfo(companyId);
      
      if (!response.success || !response.data) {
        logger.error('Failed to fetch company data', { response });
        return null;
      }

      logger.debug('📊 Company data received', {
        companyId,
        title: response.data.title,
        hasAddress: !!response.data.address,
        hasCoordinates: !!(response.data.coordinate_lat && response.data.coordinate_lon)
      });

      return response.data;

    } catch (error) {
      logger.error('Error fetching company data from YClients', {
        companyId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Подготовить данные компании для сохранения
   * @param {string} yclientsId - ID компании в YClients
   * @param {Object} rawData - Сырые данные из API
   * @returns {Object} Подготовленные данные
   */
  prepareCompanyData(yclientsId, rawData) {
    // Извлекаем нужные поля
    const prepared = {
      yclients_id: yclientsId,
      title: rawData.title || rawData.name || 'Unknown Company',
      address: rawData.address || null,
      phone: rawData.phone || rawData.phone_number || null,
      email: rawData.email || null,
      website: rawData.site || rawData.website || null,
      timezone: rawData.timezone_name || rawData.timezone || 'Europe/Moscow',
      working_hours: this.parseWorkingHours(rawData.schedule),
      coordinate_lat: rawData.coordinate_lat ? parseFloat(rawData.coordinate_lat) : null,
      coordinate_lon: rawData.coordinate_lon ? parseFloat(rawData.coordinate_lon) : null,
      raw_data: rawData, // Сохраняем полный ответ для возможного использования в будущем
      active: rawData.active !== false, // По умолчанию считаем активной
      settings: {
        currency: rawData.currency || 'RUB',
        country: rawData.country || 'Russia',
        city: rawData.city || null,
        business_type: rawData.business_type || null,
        ...((rawData.settings || {}))
      }
    };

    // Обновляем поле name для обратной совместимости
    prepared.name = prepared.title;

    logger.debug('📦 Company data prepared', {
      yclients_id: prepared.yclients_id,
      title: prepared.title,
      hasCoordinates: !!(prepared.coordinate_lat && prepared.coordinate_lon),
      timezone: prepared.timezone
    });

    return prepared;
  }

  /**
   * Парсить расписание работы
   * @param {Array|Object} schedule - Расписание из API
   * @returns {Object} Структурированное расписание
   */
  parseWorkingHours(schedule) {
    if (!schedule) return {};

    try {
      // Если schedule - это массив дней недели
      if (Array.isArray(schedule)) {
        const hours = {};
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        schedule.forEach((day, index) => {
          if (day && typeof day === 'object') {
            hours[dayNames[index]] = {
              open: day.start_time || day.open || null,
              close: day.end_time || day.close || null,
              is_working: day.is_working !== false
            };
          }
        });
        
        return hours;
      }

      // Если schedule уже объект
      if (typeof schedule === 'object') {
        return schedule;
      }

      return {};
    } catch (error) {
      logger.warn('Failed to parse working hours', { error: error.message });
      return {};
    }
  }

  /**
   * Сохранить данные компании в Supabase
   * @param {Object} companyData - Подготовленные данные компании
   * @returns {Promise<Object>} Результат сохранения
   */
  async saveToDatabase(companyData) {
    try {
      logger.debug('💾 Saving company data to Supabase', {
        yclients_id: companyData.yclients_id,
        title: companyData.title
      });

      // Используем upsert для обновления существующей записи или создания новой
      const { data, error } = await supabase
        .from('companies')
        .upsert(companyData, {
          onConflict: 'yclients_id',
          returning: 'representation'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('✅ Company data saved successfully', {
        id: data.id,
        yclients_id: data.yclients_id,
        title: data.title
      });

      return data;

    } catch (error) {
      logger.error('Database save error', {
        error: error.message,
        details: error.details || error
      });
      throw new Error(`Failed to save company data: ${error.message}`);
    }
  }

  /**
   * Запустить периодическую синхронизацию
   * @param {number} intervalMinutes - Интервал в минутах (по умолчанию 60)
   * @param {string} companyId - ID компании для синхронизации
   */
  startPeriodicSync(intervalMinutes = 60, companyId = config.yclients.companyId) {
    // Останавливаем предыдущую синхронизацию, если есть
    this.stopPeriodicSync();

    logger.info(`🔄 Starting periodic company sync every ${intervalMinutes} minutes`);

    // Выполняем первую синхронизацию сразу
    this.syncCompany(companyId);

    // Устанавливаем интервал
    this.syncInterval = setInterval(() => {
      this.syncCompany(companyId);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Остановить периодическую синхронизацию
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('🛑 Periodic company sync stopped');
    }
  }

  /**
   * Синхронизировать несколько компаний
   * @param {Array<string>} companyIds - Массив ID компаний
   * @returns {Promise<Array>} Результаты синхронизации
   */
  async syncMultipleCompanies(companyIds) {
    logger.info(`🏢 Starting sync for ${companyIds.length} companies`);

    const results = await Promise.allSettled(
      companyIds.map(id => this.syncCompany(id))
    );

    const summary = {
      total: companyIds.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || !r.value.success).length
    };

    logger.info('📊 Multiple companies sync completed', summary);

    return results.map((result, index) => ({
      companyId: companyIds[index],
      ...(result.status === 'fulfilled' ? result.value : { success: false, error: result.reason })
    }));
  }

  /**
   * Получить статус последней синхронизации
   * @param {string} companyId - ID компании
   * @returns {Promise<Object>} Информация о последней синхронизации
   */
  async getLastSyncInfo(companyId) {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('updated_at, title, active')
        .eq('yclients_id', companyId)
        .single();

      if (error || !data) {
        return {
          synced: false,
          companyId
        };
      }

      return {
        synced: true,
        companyId,
        lastSync: data.updated_at,
        companyName: data.title,
        active: data.active
      };

    } catch (error) {
      logger.error('Error getting last sync info', { error: error.message });
      return {
        synced: false,
        companyId,
        error: error.message
      };
    }
  }
}

// Экспортируем класс и создаем singleton экземпляр
const companySyncInstance = new CompanySync();

module.exports = {
  CompanySync,
  companySync: companySyncInstance,
  // Удобные функции для прямого использования
  syncCompany: (companyId) => companySyncInstance.syncCompany(companyId),
  startPeriodicSync: (interval, companyId) => companySyncInstance.startPeriodicSync(interval, companyId),
  stopPeriodicSync: () => companySyncInstance.stopPeriodicSync()
};