/**
 * Redis Pub/Sub Utilities
 *
 * Provides reliable publishing with retry logic for cross-process communication.
 * Used by baileys-service and ai-admin-api for WhatsApp events.
 *
 * @module utils/redis-pubsub
 */

const logger = require('./logger');

/**
 * Redis channels used in the application
 */
const CHANNELS = {
  WHATSAPP_EVENTS: 'whatsapp:events',
  WHATSAPP_HEALTH: 'whatsapp:health',
  WHATSAPP_HEALTH_TEST: 'whatsapp:health-test'
};

/**
 * Event types published on whatsapp:events channel
 */
const EVENT_TYPES = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  LOGOUT: 'logout',
  PING: 'ping',
  PONG: 'pong'
};

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Publish message to Redis channel with retry logic
 *
 * @param {Object} redisClient - Redis client instance
 * @param {string} channel - Redis channel name
 * @param {Object|string} message - Message to publish (object will be JSON.stringify'd)
 * @param {Object} options - Options
 * @param {number} options.retries - Number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in ms for exponential backoff (default: 1000)
 * @returns {Promise<boolean>} - True if published successfully
 */
async function publishWithRetry(redisClient, channel, message, options = {}) {
  const { retries = 3, baseDelay = 1000 } = options;
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await redisClient.publish(channel, messageStr);

      if (attempt > 0) {
        logger.info(`📤 Redis publish succeeded after ${attempt} retries`, {
          channel,
          subscribers: result
        });
      }

      return true;
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        logger.error('📤 Redis publish failed after all retries:', {
          channel,
          error: error.message,
          attempts: attempt + 1
        });
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`📤 Redis publish failed, retrying in ${delay}ms...`, {
        channel,
        error: error.message,
        attempt: attempt + 1,
        maxRetries: retries
      });

      await sleep(delay);
    }
  }

  return false;
}

/**
 * Publish WhatsApp connected event
 *
 * @param {Object} redisClient - Redis client instance
 * @param {string} companyId - Company ID (format: company_962302)
 * @param {string} phoneNumber - Connected phone number
 * @param {Object} options - Retry options
 * @returns {Promise<boolean>}
 */
async function publishConnectedEvent(redisClient, companyId, phoneNumber, options = {}) {
  const event = {
    type: EVENT_TYPES.CONNECTED,
    companyId,
    phoneNumber,
    timestamp: Date.now()
  };

  return publishWithRetry(redisClient, CHANNELS.WHATSAPP_EVENTS, event, options);
}

/**
 * Publish WhatsApp disconnected event
 *
 * @param {Object} redisClient - Redis client instance
 * @param {string} companyId - Company ID
 * @param {string} reason - Disconnect reason
 * @param {Object} options - Retry options
 * @returns {Promise<boolean>}
 */
async function publishDisconnectedEvent(redisClient, companyId, reason = 'unknown', options = {}) {
  const event = {
    type: EVENT_TYPES.DISCONNECTED,
    companyId,
    reason,
    timestamp: Date.now()
  };

  return publishWithRetry(redisClient, CHANNELS.WHATSAPP_EVENTS, event, options);
}

/**
 * Publish health ping (for health checks)
 *
 * @param {Object} redisClient - Redis client instance
 * @param {string} testId - Unique test ID for ping/pong correlation
 * @param {Object} options - Retry options
 * @returns {Promise<boolean>}
 */
async function publishPing(redisClient, testId, options = {}) {
  const event = {
    type: EVENT_TYPES.PING,
    testId,
    timestamp: Date.now()
  };

  return publishWithRetry(redisClient, CHANNELS.WHATSAPP_EVENTS, event, options);
}

/**
 * Publish health pong (response to ping)
 *
 * @param {Object} redisClient - Redis client instance
 * @param {string} testId - Test ID from ping
 * @param {string} service - Service name responding
 * @param {Object} options - Retry options
 * @returns {Promise<boolean>}
 */
async function publishPong(redisClient, testId, service, options = {}) {
  const event = {
    type: EVENT_TYPES.PONG,
    testId,
    service,
    timestamp: Date.now()
  };

  return publishWithRetry(redisClient, CHANNELS.WHATSAPP_HEALTH, event, options);
}

/**
 * Validate event structure
 *
 * @param {Object} event - Event to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateEvent(event) {
  const errors = [];

  if (!event) {
    return { valid: false, errors: ['Event is null or undefined'] };
  }

  if (!event.type) {
    errors.push('Missing required field: type');
  }

  if (!event.timestamp) {
    errors.push('Missing required field: timestamp');
  } else if (typeof event.timestamp !== 'number') {
    errors.push('timestamp must be a number');
  }

  // Type-specific validation
  if (event.type === EVENT_TYPES.CONNECTED) {
    if (!event.companyId) {
      errors.push('Missing required field for connected event: companyId');
    } else if (!/^company_\d+$/.test(event.companyId)) {
      errors.push('companyId must match format: company_<numeric_id>');
    }
  }

  if (event.type === EVENT_TYPES.PING || event.type === EVENT_TYPES.PONG) {
    if (!event.testId) {
      errors.push('Missing required field for ping/pong event: testId');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if event is stale (older than maxAge)
 *
 * @param {Object} event - Event with timestamp
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 60000 = 1 minute)
 * @returns {boolean}
 */
function isStaleEvent(event, maxAgeMs = 60000) {
  if (!event || !event.timestamp) {
    return true;
  }

  return (Date.now() - event.timestamp) > maxAgeMs;
}

module.exports = {
  CHANNELS,
  EVENT_TYPES,
  publishWithRetry,
  publishConnectedEvent,
  publishDisconnectedEvent,
  publishPing,
  publishPong,
  validateEvent,
  isStaleEvent,
  sleep
};
