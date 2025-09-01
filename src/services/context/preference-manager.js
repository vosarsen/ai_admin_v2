// src/services/context/preference-manager.js
/**
 * Менеджер предпочтений клиента
 * Автоматически сохраняет паттерны "как обычно"
 */

const contextServiceV2 = require('./context-service-v2');
const logger = require('../../utils/logger').child({ module: 'preference-manager' });

class PreferenceManager {
  constructor() {
    this.contextService = contextServiceV2;
  }

  /**
   * Сохранить "обычный" контекст после успешной записи
   * @param {string} phone - Телефон клиента
   * @param {number} companyId - ID компании
   * @param {Object} bookingData - Данные созданной записи
   */
  async saveUsualPreferences(phone, companyId, bookingData) {
    try {
      logger.info(`Saving usual preferences for ${phone}`);
      
      // Получаем текущие предпочтения
      const currentPrefs = await this.contextService.getPreferences(phone, companyId) || {};
      
      // Обновляем счетчики использования
      const serviceKey = `service_${bookingData.serviceId}`;
      const staffKey = `staff_${bookingData.staffId}`;
      const pairKey = `pair_${bookingData.serviceId}_${bookingData.staffId}`;
      const timeKey = this.getTimeCategory(bookingData.time);
      const dayKey = this.getDayCategory(bookingData.date);
      
      // Инициализируем объекты если их нет
      if (!currentPrefs.usageCount) currentPrefs.usageCount = {};
      if (!currentPrefs.lastUsed) currentPrefs.lastUsed = {};
      if (!currentPrefs.usualContext) currentPrefs.usualContext = {};
      
      // Увеличиваем счетчики
      currentPrefs.usageCount[serviceKey] = (currentPrefs.usageCount[serviceKey] || 0) + 1;
      currentPrefs.usageCount[staffKey] = (currentPrefs.usageCount[staffKey] || 0) + 1;
      currentPrefs.usageCount[pairKey] = (currentPrefs.usageCount[pairKey] || 0) + 1;
      currentPrefs.usageCount[timeKey] = (currentPrefs.usageCount[timeKey] || 0) + 1;
      currentPrefs.usageCount[dayKey] = (currentPrefs.usageCount[dayKey] || 0) + 1;
      
      // Сохраняем последнее использование
      currentPrefs.lastUsed.service = bookingData.serviceName;
      currentPrefs.lastUsed.serviceId = bookingData.serviceId;
      currentPrefs.lastUsed.staff = bookingData.staffName;
      currentPrefs.lastUsed.staffId = bookingData.staffId;
      currentPrefs.lastUsed.time = bookingData.time;
      currentPrefs.lastUsed.date = bookingData.date;
      
      // Определяем "обычный" контекст (если использовано 3+ раза)
      if (currentPrefs.usageCount[serviceKey] >= 3) {
        currentPrefs.favoriteService = bookingData.serviceName;
        currentPrefs.favoriteServiceId = bookingData.serviceId;
      }
      
      if (currentPrefs.usageCount[staffKey] >= 3) {
        currentPrefs.favoriteStaff = bookingData.staffName;
        currentPrefs.favoriteStaffId = bookingData.staffId;
      }
      
      if (currentPrefs.usageCount[pairKey] >= 2) {
        currentPrefs.usualContext.service = bookingData.serviceName;
        currentPrefs.usualContext.staff = bookingData.staffName;
        currentPrefs.usualContext.description = `${bookingData.serviceName} у ${bookingData.staffName}`;
      }
      
      // Определяем предпочитаемое время
      const timePrefs = Object.entries(currentPrefs.usageCount)
        .filter(([key]) => key.startsWith('time_'))
        .sort((a, b) => b[1] - a[1]);
      
      if (timePrefs.length > 0 && timePrefs[0][1] >= 2) {
        currentPrefs.preferredTime = timePrefs[0][0].replace('time_', '');
      }
      
      // Сохраняем обновленные предпочтения
      const result = await this.contextService.savePreferences(phone, companyId, currentPrefs);
      
      if (result.success) {
        logger.info('Preferences updated successfully', {
          favoriteService: currentPrefs.favoriteService,
          favoriteStaff: currentPrefs.favoriteStaff,
          usualContext: currentPrefs.usualContext
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Error saving usual preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить контекст "как обычно"
   * @param {string} phone - Телефон клиента
   * @param {number} companyId - ID компании
   */
  async getUsualContext(phone, companyId) {
    try {
      const prefs = await this.contextService.getPreferences(phone, companyId);
      
      if (!prefs || !prefs.usualContext) {
        return null;
      }
      
      return {
        description: prefs.usualContext.description,
        service: prefs.usualContext.service,
        staff: prefs.usualContext.staff,
        preferredTime: prefs.preferredTime,
        lastUsed: prefs.lastUsed,
        canSuggestUsual: !!prefs.usualContext.description
      };
    } catch (error) {
      logger.error('Error getting usual context:', error);
      return null;
    }
  }

  /**
   * Проверить, можно ли предложить "как обычно"
   */
  async canSuggestUsual(phone, companyId) {
    const usual = await this.getUsualContext(phone, companyId);
    return usual && usual.canSuggestUsual;
  }

  /**
   * Категоризация времени
   */
  getTimeCategory(time) {
    if (!time) return 'time_unknown';
    
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) return 'time_morning';
    if (hour < 18) return 'time_afternoon';
    return 'time_evening';
  }

  /**
   * Категоризация дня недели
   */
  getDayCategory(date) {
    if (!date) return 'day_unknown';
    
    const day = new Date(date).getDay();
    if (day === 0 || day === 6) return 'day_weekend';
    return 'day_weekday';
  }

  /**
   * Очистить устаревшие предпочтения
   */
  async cleanupOldPreferences(phone, companyId, daysOld = 180) {
    try {
      const prefs = await this.contextService.getPreferences(phone, companyId);
      
      if (!prefs || !prefs.lastUsed) {
        return;
      }
      
      const lastUsedDate = new Date(prefs.lastUsed.date);
      const daysSinceLastUse = Math.floor((Date.now() - lastUsedDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastUse > daysOld) {
        logger.info(`Cleaning up old preferences for ${phone} (${daysSinceLastUse} days old)`);
        
        // Сбрасываем счетчики, но сохраняем базовую информацию
        prefs.usageCount = {};
        prefs.usualContext = {};
        
        await this.contextService.savePreferences(phone, companyId, prefs);
      }
    } catch (error) {
      logger.error('Error cleaning up preferences:', error);
    }
  }
}

module.exports = new PreferenceManager();