// src/services/nlu/data-normalizer.js
const { SERVICE_MAP, STAFF_MAP, TIME_MAP } = require('./constants');

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
    return normalized || service.toLowerCase();
  }

  /**
   * Public alias for normalizeService
   */
  normalizeServiceName(service) {
    return this.normalizeService(service);
  }

  /**
   * Normalize staff name
   * @param {string} staff - Raw staff name
   * @returns {string|null} Normalized staff name
   */
  normalizeStaff(staff) {
    if (!staff) return null;
    
    const lowerStaff = staff.toLowerCase();
    
    // Check for 'any' staff preference
    if (lowerStaff === 'любой' || lowerStaff === 'без разницы' || lowerStaff === 'кто угодно') {
      return 'любой';
    }
    
    const normalized = STAFF_MAP[lowerStaff];
    if (normalized) return normalized;
    
    // Capitalize first letter for unknown names
    return staff.charAt(0).toUpperCase() + staff.slice(1).toLowerCase();
  }
  
  /**
   * Public alias for normalizeStaff
   */
  normalizeStaffName(staff) {
    return this.normalizeStaff(staff);
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
    
    if (date === 'послезавтра') {
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);
      return dayAfter.toISOString().split('T')[0];
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
    
    // Check for time expressions
    const normalized = TIME_MAP[time.toLowerCase()];
    if (normalized) return normalized;
    
    // Check for hour-only patterns
    const hourMatch = time.match(/(?:в\s+)?(\d{1,2})(?:\s*час|$)/);
    if (hourMatch) {
      const hour = parseInt(hourMatch[1]);
      if (hour >= 0 && hour <= 23) {
        return `${hour.toString().padStart(2, '0')}:00`;
      }
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
    if (!entities || typeof entities !== 'object') {
      return {};
    }
    
    const normalized = {};
    
    // Only normalize fields that exist
    if ('service' in entities) {
      normalized.service = this.normalizeService(entities.service);
    }
    if ('staff' in entities) {
      normalized.staff = this.normalizeStaff(entities.staff);
    }
    if ('date' in entities) {
      normalized.date = this.normalizeDate(entities.date);
    }
    if ('time' in entities) {
      normalized.time = this.normalizeTime(entities.time);
    }
    if ('info_type' in entities) {
      normalized.info_type = entities.info_type || null;
    }
    if ('time_preference' in entities) {
      normalized.time_preference = entities.time_preference || null;
    }
    
    // Preserve any other fields
    Object.keys(entities).forEach(key => {
      if (!(key in normalized)) {
        normalized[key] = entities[key];
      }
    });
    
    return normalized;
  }
}

module.exports = DataNormalizer;