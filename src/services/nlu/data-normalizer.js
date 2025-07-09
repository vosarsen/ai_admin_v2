// src/services/nlu/data-normalizer.js
const { SERVICE_MAP, STAFF_MAP } = require('./constants');

/**
 * Normalizes extracted entities to standard formats
 */
class DataNormalizer {
  /**
   * Normalize service name
   * @param {string} service - Raw service name
   * @returns {string|null} Normalized service name
   */
  normalizeService(service) {
    if (!service) return null;
    
    const normalized = SERVICE_MAP[service.toLowerCase()];
    return normalized || service;
  }

  /**
   * Normalize staff name
   * @param {string} staff - Raw staff name
   * @returns {string|null} Normalized staff name
   */
  normalizeStaff(staff) {
    if (!staff) return null;
    
    const normalized = STAFF_MAP[staff.toLowerCase()];
    return normalized || staff;
  }

  /**
   * Normalize date
   * @param {string} date - Raw date
   * @returns {string|null} Normalized date in YYYY-MM-DD format
   */
  normalizeDate(date) {
    if (!date) return null;
    
    // If already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    const today = new Date();
    
    if (date === 'сегодня') {
      return today.toISOString().split('T')[0];
    }
    
    if (date === 'завтра') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    
    return date;
  }

  /**
   * Normalize time
   * @param {string} time - Raw time
   * @returns {string|null} Normalized time in HH:MM format
   */
  normalizeTime(time) {
    if (!time) return null;
    
    // If already in HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      const [hours, minutes] = time.split(':');
      return `${hours.padStart(2, '0')}:${minutes}`;
    }
    
    return time;
  }

  /**
   * Format date for user display
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {string} User-friendly date
   */
  formatDateForUser(date) {
    if (!date) return '';
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    if (date === today) return 'сегодня';
    if (date === tomorrowStr) return 'завтра';
    
    return date;
  }

  /**
   * Normalize all entities in a parsed result
   * @param {Object} entities - Raw entities
   * @returns {Object} Normalized entities
   */
  normalizeEntities(entities) {
    return {
      service: this.normalizeService(entities.service),
      staff: this.normalizeStaff(entities.staff),
      date: this.normalizeDate(entities.date),
      time: this.normalizeTime(entities.time),
      info_type: entities.info_type || null,
      time_preference: entities.time_preference || null
    };
  }
}

module.exports = DataNormalizer;