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
    'стрижка': 'стрижка',
    'постричься': 'стрижка',
    'подстричься': 'стрижка',
    'борода': 'стрижка бороды',
    'стрижка бороды': 'стрижка бороды',
    'бритье': 'бритье',
    'побриться': 'бритье'
  },
  
  STAFF_MAP: {
    'бари': 'Бари',
    'сергей': 'Сергей',
    'сергею': 'Сергей',
    'рамзан': 'Рамзан'
  },
  
  // Available services and staff for prompt
  AVAILABLE_SERVICES: ['стрижка', 'стрижка бороды', 'бритье', 'моделирование бороды'],
  AVAILABLE_STAFF: ['Бари', 'Сергей', 'Рамзан']
};