// src/services/nlu/action-resolver.js
const logger = require('../../utils/logger');
const { ActionResolutionError } = require('./errors');

/**
 * Determines actions based on intent and entities
 * @class ActionResolver
 * @description Maps user intents and entities to specific system actions
 */
class ActionResolver {
  /**
   * Determine action based on intent and entities
   * @param {Object} parsed - Parsed NLU result
   * @param {string} parsed.intent - User intent (booking|reschedule|cancel|info|other)
   * @param {Object} parsed.entities - Extracted entities
   * @param {string} [parsed.entities.date] - Booking date
   * @param {string} [parsed.entities.time] - Booking time
   * @param {string} [parsed.entities.staff] - Staff member
   * @returns {string} Action name (create_booking|search_slots|reschedule_booking|cancel_booking|get_info|none)
   * @throws {ActionResolutionError} If input is invalid or intent cannot be resolved
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
      // BUT only if time is specific (not time_preference like "evening")
      if (entities.date && entities.time && entities.staff && !entities.time_preference) {
        // Additional check: time should be in HH:MM format
        if (/^\d{1,2}:\d{2}$/.test(entities.time)) {
          return 'create_booking';
        }
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
   * @returns {Object} Same object with action field guaranteed
   * @description Mutates the input object by adding action field if missing
   * @example
   * const parsed = { intent: 'booking', entities: {} };
   * actionResolver.ensureAction(parsed);
   * console.log(parsed.action); // 'search_slots'
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