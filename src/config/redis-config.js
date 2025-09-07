// src/config/redis-config.js
const logger = require('../utils/logger');
const envConfig = require('./environments/index');

/**
 * Централизованная конфигурация Redis
 * Использует environment-specific настройки
 */
function getRedisConfig() {
  const mainConfig = require('./index');
  
  // Определяем окружение
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = !isProduction;
  
  // Базовая конфигурация из environment-specific файлов
  const config = {
    host: envConfig.redis?.host || 'localhost',
    port: envConfig.redis?.port || (isDevelopment ? 6380 : 6379),
    password: mainConfig.redis.password || process.env.REDIS_PASSWORD,
    db: 0, // Явно указываем базу данных 0
    connectTimeout: 10000,
    lazyConnect: true,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    showFriendlyErrorStack: isDevelopment
  };
  
  // ВАЖНО: Проверяем наличие пароля
  if (!config.password) {
    logger.error('⚠️ CRITICAL: Redis password is not set!');
    if (isProduction) {
      throw new Error('Redis password is required in production environment!');
    } else {
      logger.warn('Running without Redis password in development mode');
    }
  }
  
  logger.info('Redis config:', {
    host: config.host,
    port: config.port,
    db: config.db,
    hasPassword: !!config.password,
    passwordLength: config.password ? config.password.length : 0,
    env: process.env.NODE_ENV || 'development'
  });
  
  return config;
}

/**
 * Получить конфигурацию для BullMQ
 * BullMQ требует отдельные поля host/port/password
 */
function getBullMQRedisConfig() {
  const config = getRedisConfig();
  return {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db
  };
}

module.exports = { getRedisConfig, getBullMQRedisConfig };