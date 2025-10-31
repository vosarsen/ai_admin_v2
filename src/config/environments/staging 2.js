// src/config/environments/staging.js
module.exports = {
  redis: {
    host: 'localhost',
    port: 6379,
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://staging.example.com:3000'
  },
  
  logging: {
    level: 'debug',
    pretty: false
  },
  
  cache: {
    ttl: 600, // 10 минут
    enabled: true
  },
  
  security: {
    validateWebhooks: true,
    corsOrigin: process.env.CORS_ORIGIN || false
  }
};