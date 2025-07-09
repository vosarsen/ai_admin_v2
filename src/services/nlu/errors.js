// src/services/nlu/errors.js

/**
 * Base error class for NLU-related errors
 * @class NLUError
 * @extends Error
 * @description Provides structured error information with codes and details
 */
class NLUError extends Error {
  /**
   * Creates an instance of NLUError
   * @constructor
   * @param {string} message - Error message
   * @param {string} code - Error code for identification
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'NLUError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Convert error to JSON representation
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Error thrown when AI service fails to respond
 * @class AIServiceError
 * @extends NLUError
 */
class AIServiceError extends NLUError {
  constructor(message, originalError) {
    super(message, 'AI_SERVICE_ERROR', {
      originalError: originalError?.message || originalError
    });
    this.name = 'AIServiceError';
  }
}

/**
 * Error thrown when parsing AI response fails
 * @class AIResponseParseError
 * @extends NLUError
 */
class AIResponseParseError extends NLUError {
  constructor(response, parseError) {
    super('Failed to parse AI response', 'AI_PARSE_ERROR', {
      response: response?.substring(0, 200),
      parseError: parseError?.message || parseError
    });
    this.name = 'AIResponseParseError';
  }
}

/**
 * Error thrown when input validation fails
 * @class ValidationError
 * @extends NLUError
 */
class ValidationError extends NLUError {
  constructor(errors, inputType) {
    super(`Validation failed for ${inputType}`, 'VALIDATION_ERROR', {
      errors,
      inputType
    });
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when context is missing required fields
 * @class InvalidContextError
 * @extends NLUError
 */
class InvalidContextError extends NLUError {
  constructor(missingFields) {
    super('Invalid context: missing required fields', 'INVALID_CONTEXT', {
      missingFields
    });
    this.name = 'InvalidContextError';
  }
}

/**
 * Error thrown when message format is invalid
 * @class InvalidMessageError
 * @extends NLUError
 */
class InvalidMessageError extends NLUError {
  constructor(reason, messageInfo) {
    super(`Invalid message: ${reason}`, 'INVALID_MESSAGE', {
      reason,
      messageInfo
    });
    this.name = 'InvalidMessageError';
  }
}

/**
 * Error thrown when entity extraction fails
 * @class EntityExtractionError
 * @extends NLUError
 */
class EntityExtractionError extends NLUError {
  constructor(message, extractionDetails) {
    super(message, 'EXTRACTION_ERROR', extractionDetails);
    this.name = 'EntityExtractionError';
  }
}

/**
 * Error thrown when action resolution fails
 * @class ActionResolutionError
 * @extends NLUError
 */
class ActionResolutionError extends NLUError {
  constructor(intent, entities) {
    super(`Cannot determine action for intent: ${intent}`, 'ACTION_RESOLUTION_ERROR', {
      intent,
      entities
    });
    this.name = 'ActionResolutionError';
  }
}

module.exports = {
  NLUError,
  AIServiceError,
  AIResponseParseError,
  ValidationError,
  InvalidContextError,
  InvalidMessageError,
  EntityExtractionError,
  ActionResolutionError
};