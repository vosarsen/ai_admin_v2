// src/config/environments/production.js
module.exports = {
  redis: {
    // На продакшене Redis на том же сервере
    host: 'localhost',
    port: 6379,
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://46.149.70.219:3000'
  },
  
  logging: {
    level: 'info',
    pretty: false
  },
  
  cache: {
    ttl: 1800, // 30 минут
    enabled: true
  },
  
  security: {
    validateWebhooks: true,
    corsOrigin: process.env.CORS_ORIGIN || false
  },
  
  performance: {
    // Оптимизации для продакшена
    messageQueueConcurrency: 5,
    cachePoolSize: 10,
    dbPoolSize: 20
  }
};