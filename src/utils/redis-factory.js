// src/utils/redis-factory.js
const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

/**
 * Create a Redis client with authentication and error handling
 */
function createRedisClient(role = 'default') {
  // Validate Redis password is configured
  if (!config.redis.password && config.app.env === 'production') {
    throw new Error('Redis password is required in production. Please set REDIS_PASSWORD environment variable.');
  }

  // Parse Redis URL
  const redisUrl = new URL(config.redis.url);
  
  // Create client options
  const clientOptions = {
    host: redisUrl.hostname,
    port: redisUrl.port || 6379,
    password: config.redis.password,
    ...config.redis.options,
    lazyConnect: true // Don't connect immediately
  };

  // Add specific logger
  const redisLogger = logger.child({ service: 'redis', role });

  // Add retry strategy with logging
  clientOptions.retryStrategy = (times) => {
    if (times > 3) {
      redisLogger.error('Redis connection failed after 3 retries');
      return null;
    }
    const delay = Math.min(times * 200, 2000);
    redisLogger.warn(`Redis connection retry ${times}, waiting ${delay}ms`);
    return delay;
  };

  // Create client
  const client = new Redis(clientOptions);

  // Add event handlers
  client.on('connect', () => {
    redisLogger.info(`Redis client connected (role: ${role})`);
  });

  client.on('ready', () => {
    redisLogger.info(`Redis client ready (role: ${role})`);
  });

  client.on('error', (err) => {
    redisLogger.error(`Redis client error (role: ${role}):`, err);
  });

  client.on('close', () => {
    redisLogger.warn(`Redis client closed (role: ${role})`);
  });

  client.on('reconnecting', (delay) => {
    redisLogger.info(`Redis client reconnecting in ${delay}ms (role: ${role})`);
  });

  // Test connection
  client.connect().catch(err => {
    redisLogger.error(`Failed to connect to Redis (role: ${role}):`, err);
    throw err;
  });

  return client;
}

/**
 * Validate Redis configuration on startup
 */
async function validateRedisConfig() {
  const client = createRedisClient('validation');
  
  try {
    // Test basic operations
    await client.ping();
    await client.set('test:connection', 'ok', 'EX', 10);
    const result = await client.get('test:connection');
    
    if (result !== 'ok') {
      throw new Error('Redis read/write test failed');
    }
    
    await client.del('test:connection');
    logger.info('Redis configuration validated successfully');
    
    return true;
  } catch (error) {
    logger.error('Redis configuration validation failed:', error);
    throw error;
  } finally {
    await client.quit();
  }
}

module.exports = {
  createRedisClient,
  validateRedisConfig
};