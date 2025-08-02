// src/config/redis-config.js
const logger = require('../utils/logger');
const envConfig = require('./environments');

/**
 * Централизованная конфигурация Redis
 * Использует environment-specific настройки
 */
function getRedisConfig() {
  const config = {
    host: envConfig.redis.host || 'localhost',
    port: envConfig.redis.port || 6379,
    password: process.env.REDIS_PASSWORD,
    db: 0, // Явно указываем базу данных 0
    connectTimeout: 10000,
    lazyConnect: true,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  };
  
  logger.info('Redis config:', {
    host: config.host,
    port: config.port,
    db: config.db,
    hasPassword: !!config.password,
    env: process.env.NODE_ENV || 'development'
  });
  
  return config;
}

module.exports = { getRedisConfig };