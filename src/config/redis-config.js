// src/config/redis-config.js
const logger = require('../utils/logger');

/**
 * Централизованная конфигурация Redis
 * Гарантирует, что все процессы используют одинаковые настройки
 */
function getRedisConfig() {
  // Определяем порт в зависимости от окружения
  const isLocal = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const port = isLocal ? 6380 : 6379; // Локально используем SSH туннель на 6380
  
  const config = {
    host: 'localhost',
    port: port,
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
    hasPassword: !!config.password
  });
  
  return config;
}

module.exports = { getRedisConfig };