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
  
  // Entity normalization maps
  SERVICE_MAP: {
    'маникюр': 'маникюр',
    'ногти': 'маникюр',
    'ноготочки': 'маникюр',
    'педикюр': 'педикюр',
    'стопы': 'педикюр',
    'ножки': 'педикюр',
    'стрижка': 'стрижка',
    'подстричься': 'стрижка',
    'волосы': 'стрижка'
  },
  
  TIME_MAP: {
    'утром': '09:00',
    'днем': '12:00',
    'днём': '12:00',
    'вечером': '18:00'
  },
  
  STAFF_MAP: {
    'маша': 'Мария',
    'машенька': 'Мария',
    'мария': 'Мария',
    'оля': 'Ольга',
    'ольга': 'Ольга',
    'катя': 'Екатерина',
    'екатерина': 'Екатерина',
    'лена': 'Елена',
    'елена': 'Елена',
    'наташа': 'Наталья',
    'наталья': 'Наталья'
  },
  
  // Available services and staff for prompt
  AVAILABLE_SERVICES: ['маникюр', 'педикюр', 'стрижка', 'окрашивание'],
  AVAILABLE_STAFF: ['Мария', 'Ольга', 'Екатерина', 'Елена', 'Наталья']
};