// src/services/nlu/action-resolver.js
const logger = require('../../utils/logger');
const { ActionResolutionError } = require('./errors');

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
    // Validate input
    if (!parsed || typeof parsed !== 'object') {
      throw new ActionResolutionError('invalid_input', { parsed });
    }
    
    const { intent, entities } = parsed;
    
    // Validate intent
    if (!intent || typeof intent !== 'string') {
      throw new ActionResolutionError(intent || 'missing', entities);
    }
    
    // Validate entities
    if (!entities || typeof entities !== 'object') {
      logger.warn('Missing or invalid entities, using empty object');
      parsed.entities = {};
      // For booking intent without entities, still suggest search_slots
      if (intent === 'booking') {
        return 'search_slots';
      }
      return 'none';
    }
    
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
    if (!parsed || typeof parsed !== 'object') {
      return parsed;
    }
    
    if (!parsed.action) {
      try {
        parsed.action = this.determineAction(parsed);
      } catch (error) {
        logger.error('Failed to determine action:', error.toJSON ? error.toJSON() : error);
        parsed.action = 'none';
      }
    }
    return parsed;
  }
}

module.exports = ActionResolver;