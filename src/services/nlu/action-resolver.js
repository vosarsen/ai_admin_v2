// src/services/nlu/action-resolver.js
const logger = require('../../utils/logger');

/**
 * Determines actions based on intent and entities
 */
class ActionResolver {
  /**
   * Determine action based on intent and entities
   * @param {Object} parsed - Object with intent and entities
   * @returns {string} Action name
   */
  determineAction(parsed) {
    const { intent, entities } = parsed;
    
    if (intent === 'booking') {
      // If we have specific date, time and staff - create booking
      if (entities.date && entities.time && entities.staff) {
        return 'create_booking';
      }
      // Otherwise search for available slots
      return 'search_slots';
    }
    
    if (intent === 'reschedule') return 'reschedule_booking';
    if (intent === 'cancel') return 'cancel_booking';  
    if (intent === 'info') return 'get_info';
    
    return 'none';
  }

  /**
   * Ensure parsed result always has action field
   * @param {Object} parsed - Parsed result with intent and entities
   * @returns {Object} Parsed result with action field guaranteed
   */
  ensureAction(parsed) {
    if (!parsed.action) {
      parsed.action = this.determineAction(parsed);
    }
    return parsed;
  }
}

module.exports = ActionResolver;