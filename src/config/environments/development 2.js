// src/config/environments/development.js
module.exports = {
  redis: {
    // Для локальной разработки используем SSH туннель
    host: 'localhost',
    port: 6380,
    url: 'redis://localhost:6380'
  },
  
  api: {
    baseUrl: 'http://localhost:3000'
  },
  
  logging: {
    level: 'debug',
    pretty: true
  },
  
  cache: {
    ttl: 300, // 5 минут для разработки
    enabled: false // Отключаем кэш для удобства разработки
  },
  
  security: {
    validateWebhooks: false, // Упрощаем тестирование
    corsOrigin: '*'
  }
};