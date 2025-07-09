// src/services/nlu/input-validator.js
const logger = require('../../utils/logger');

/**
 * Validates input data for NLU Service
 */
class InputValidator {
  /**
   * Validate message input
   * @param {string} message - User message
   * @returns {Object} Validation result
   */
  validateMessage(message) {
    const errors = [];
    
    // Check if message exists
    if (!message) {
      errors.push('Message is required');
      return { isValid: false, errors, sanitized: '' };
    }
    
    // Check type
    if (typeof message !== 'string') {
      errors.push('Message must be a string');
      return { isValid: false, errors, sanitized: '' };
    }
    
    // Trim and check length
    const trimmed = message.trim();
    
    if (trimmed.length === 0) {
      errors.push('Message cannot be empty');
      return { isValid: false, errors, sanitized: '' };
    }
    
    if (trimmed.length > 1000) {
      errors.push('Message is too long (max 1000 characters)');
      return { isValid: false, errors, sanitized: trimmed.substring(0, 1000) };
    }
    
    // Check for suspicious patterns (base64, binary data)
    if (this._looksLikeBase64(trimmed)) {
      logger.warn('Message looks like base64 data');
      errors.push('Message appears to contain encoded data');
      return { isValid: false, errors, sanitized: '[ENCODED_DATA]' };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitized: trimmed 
    };
  }
  
  /**
   * Validate context object
   * @param {Object} context - User context
   * @returns {Object} Validation result
   */
  validateContext(context) {
    const errors = [];
    const sanitized = {};
    
    // Check if context exists
    if (!context) {
      errors.push('Context is required');
      return { isValid: false, errors, sanitized: {} };
    }
    
    // Check type
    if (typeof context !== 'object' || Array.isArray(context)) {
      errors.push('Context must be an object');
      return { isValid: false, errors, sanitized: {} };
    }
    
    // Validate required fields
    if (!context.phone) {
      errors.push('Context.phone is required');
    } else {
      sanitized.phone = String(context.phone).trim();
    }
    
    if (!context.companyId) {
      errors.push('Context.companyId is required');
    } else {
      sanitized.companyId = String(context.companyId).trim();
    }
    
    // Copy optional fields with validation
    if (context.client) {
      sanitized.client = this._validateClient(context.client);
    }
    
    if (context.services && Array.isArray(context.services)) {
      sanitized.services = context.services.slice(0, 100); // Limit array size
    }
    
    if (context.staff && Array.isArray(context.staff)) {
      sanitized.staff = context.staff.slice(0, 50); // Limit array size
    }
    
    if (context.lastMessages && Array.isArray(context.lastMessages)) {
      sanitized.lastMessages = context.lastMessages.slice(0, 10); // Keep last 10
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }
  
  /**
   * Validate parsed result
   * @param {Object} parsed - Parsed NLU result
   * @returns {Object} Validation result
   */
  validateParsedResult(parsed) {
    const errors = [];
    const sanitized = {};
    
    if (!parsed) {
      errors.push('Parsed result is required');
      return { isValid: false, errors, sanitized: {} };
    }
    
    // Validate intent
    if (!parsed.intent) {
      errors.push('Intent is required');
    } else if (typeof parsed.intent !== 'string') {
      errors.push('Intent must be a string');
    } else {
      sanitized.intent = parsed.intent.toLowerCase().trim();
    }
    
    // Validate entities
    if (!parsed.entities) {
      sanitized.entities = {};
    } else if (typeof parsed.entities !== 'object' || Array.isArray(parsed.entities)) {
      errors.push('Entities must be an object');
      sanitized.entities = {};
    } else {
      sanitized.entities = this._validateEntities(parsed.entities);
    }
    
    // Copy optional fields
    if (parsed.confidence !== undefined) {
      sanitized.confidence = this._validateConfidence(parsed.confidence);
    }
    
    if (parsed.action) {
      sanitized.action = String(parsed.action).trim();
    }
    
    if (parsed.reasoning) {
      sanitized.reasoning = String(parsed.reasoning).trim().substring(0, 500);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitized
    };
  }
  
  /**
   * Check if string looks like base64 encoded data
   * @private
   */
  _looksLikeBase64(str) {
    // Simple heuristic: long string with base64 characters
    if (str.length < 100) return false;
    
    // Check for base64 pattern
    const base64Pattern = /^[A-Za-z0-9+/]{50,}={0,2}$/;
    const chunk = str.substring(0, 100);
    
    return base64Pattern.test(chunk);
  }
  
  /**
   * Validate client object
   * @private
   */
  _validateClient(client) {
    if (!client || typeof client !== 'object') return null;
    
    const sanitized = {};
    
    if (client.id) sanitized.id = String(client.id);
    if (client.name) sanitized.name = String(client.name).substring(0, 100);
    if (client.email) sanitized.email = String(client.email).substring(0, 100);
    if (client.lastVisit) sanitized.lastVisit = String(client.lastVisit);
    
    return sanitized;
  }
  
  /**
   * Validate entities object
   * @private
   */
  _validateEntities(entities) {
    const sanitized = {};
    
    // Validate each entity type
    if (entities.service !== undefined) {
      sanitized.service = entities.service ? String(entities.service).trim() : null;
    }
    
    if (entities.staff !== undefined) {
      sanitized.staff = entities.staff ? String(entities.staff).trim() : null;
    }
    
    if (entities.date !== undefined) {
      sanitized.date = entities.date ? String(entities.date).trim() : null;
    }
    
    if (entities.time !== undefined) {
      sanitized.time = entities.time ? String(entities.time).trim() : null;
    }
    
    if (entities.info_type !== undefined) {
      sanitized.info_type = entities.info_type ? String(entities.info_type).trim() : null;
    }
    
    if (entities.time_preference !== undefined) {
      sanitized.time_preference = entities.time_preference ? String(entities.time_preference).trim() : null;
    }
    
    return sanitized;
  }
  
  /**
   * Validate confidence value
   * @private
   */
  _validateConfidence(confidence) {
    const num = Number(confidence);
    
    if (isNaN(num)) return 0.5;
    if (num < 0) return 0;
    if (num > 1) return 1;
    
    return num;
  }
}

module.exports = InputValidator;