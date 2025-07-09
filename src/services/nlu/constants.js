// src/services/nlu/constants.js

/**
 * NLU Service Configuration Constants
 */
module.exports = {
  // Confidence thresholds
  CONFIDENCE: {
    HIGH_THRESHOLD: 0.7,          // Minimum confidence to trust AI result
    DEFAULT_AI: 0.8,              // Default confidence for AI extraction
    DEFAULT_PATTERN: 0.6,         // Default confidence for pattern extraction
    DEFAULT_FALLBACK: 0.5,        // Default confidence for fallback
    LOW_THRESHOLD: 0.1            // Below this is considered unreliable
  },
  
  // Logging limits
  LOGGING: {
    RESPONSE_PREVIEW_LENGTH: 500,  // Characters to show in log preview
    RESPONSE_SHORT_PREVIEW: 200    // Shorter preview for parsing logs
  },
  
  // AI prompt configuration
  AI_PROMPT: {
    CONFIDENCE_HIGH: 0.9,         // When all entities are clear
    CONFIDENCE_MEDIUM_MIN: 0.5,   // Lower bound for partial matches
    CONFIDENCE_MEDIUM_MAX: 0.7    // Upper bound for partial matches
  },
  
  // Time normalization map (this is generic and can stay)
  TIME_MAP: {
    'утром': '09:00',
    'днем': '12:00',
    'днём': '12:00',
    'вечером': '18:00'
  }
  
  // Entity maps removed - will be loaded dynamically from Supabase
  // SERVICE_MAP, STAFF_MAP, AVAILABLE_SERVICES, AVAILABLE_STAFF deprecated
};