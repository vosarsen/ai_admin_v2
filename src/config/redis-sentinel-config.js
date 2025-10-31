/**
 * Redis Sentinel Configuration for High Availability
 */

const config = require('./index');

/**
 * Получить конфигурацию для Redis с поддержкой Sentinel
 */
function getRedisSentinelConfig() {
  // Если Sentinel включен
  if (process.env.REDIS_SENTINEL_ENABLED === 'true') {
    return {
      sentinels: [
        { 
          host: process.env.REDIS_SENTINEL_HOST1 || 'localhost', 
          port: parseInt(process.env.REDIS_SENTINEL_PORT1) || 26379 
        },
        { 
          host: process.env.REDIS_SENTINEL_HOST2 || 'localhost', 
          port: parseInt(process.env.REDIS_SENTINEL_PORT2) || 26380 
        },
        { 
          host: process.env.REDIS_SENTINEL_HOST3 || 'localhost', 
          port: parseInt(process.env.REDIS_SENTINEL_PORT3) || 26381 
        }
      ],
      name: process.env.REDIS_SENTINEL_MASTER || 'mymaster',
      password: config.redis.password,
      db: config.redis.db || 0,
      
      // Настройки подключения
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      },
      
      // Настройки Sentinel
      sentinelRetryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 100, 3000);
      },
      
      // Настройки для высокой доступности
      preferredSlaves: [
        { ip: process.env.REDIS_SLAVE1_IP, port: process.env.REDIS_SLAVE1_PORT },
        { ip: process.env.REDIS_SLAVE2_IP, port: process.env.REDIS_SLAVE2_PORT }
      ],
      
      // Таймауты
      connectTimeout: 10000,
      commandTimeout: 5000,
      
      // Опции для production
      enableOfflineQueue: true,
      lazyConnect: true,
      
      // Мониторинг
      showFriendlyErrorStack: config.app.env !== 'production'
    };
  }
  
  // Обычная конфигурация без Sentinel
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db || 0,
    
    // Настройки подключения
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 100, 3000);
    },
    
    // Таймауты
    connectTimeout: 10000,
    commandTimeout: 5000,
    
    // Опции
    enableOfflineQueue: true,
    lazyConnect: true,
    showFriendlyErrorStack: config.app.env !== 'production'
  };
}

/**
 * Проверка доступности Sentinel
 */
async function checkSentinelHealth() {
  const Redis = require('ioredis');
  const logger = require('../utils/logger');
  
  if (process.env.REDIS_SENTINEL_ENABLED !== 'true') {
    return { healthy: true, mode: 'standalone' };
  }
  
  try {
    const sentinel = new Redis.Sentinel(getRedisSentinelConfig().sentinels);
    
    // Получение информации о мастере
    const masterInfo = await sentinel.get('mymaster');
    
    // Получение списка slaves
    const slaves = await sentinel.slaves('mymaster');
    
    const health = {
      healthy: true,
      mode: 'sentinel',
      master: {
        host: masterInfo[0],
        port: masterInfo[1],
        status: 'ok'
      },
      slaves: slaves.map(slave => ({
        host: slave[0],
        port: slave[1],
        status: slave[2]
      })),
      sentinels: getRedisSentinelConfig().sentinels.length
    };
    
    logger.info('Redis Sentinel health check:', health);
    
    await sentinel.quit();
    return health;
    
  } catch (error) {
    logger.error('Redis Sentinel health check failed:', error);
    return {
      healthy: false,
      mode: 'sentinel',
      error: error.message
    };
  }
}

/**
 * Настройка автоматического переключения при failover
 */
function setupFailoverHandling(redisClient) {
  const logger = require('../utils/logger');
  
  if (process.env.REDIS_SENTINEL_ENABLED !== 'true') {
    return;
  }
  
  // Событие при переключении на новый мастер
  redisClient.on('+switch-master', (masterName, host, port) => {
    logger.warn(`Redis Sentinel: Switched to new master ${masterName} at ${host}:${port}`);
  });
  
  // Событие при недоступности мастера
  redisClient.on('+sdown', (masterName) => {
    logger.error(`Redis Sentinel: Master ${masterName} is down`);
  });
  
  // Событие при восстановлении мастера
  redisClient.on('-sdown', (masterName) => {
    logger.info(`Redis Sentinel: Master ${masterName} is back online`);
  });
  
  // Событие начала failover
  redisClient.on('+failover-state-reconf-slaves', (masterName) => {
    logger.warn(`Redis Sentinel: Failover in progress for ${masterName}`);
  });
  
  // Событие завершения failover
  redisClient.on('+failover-end', (masterName) => {
    logger.info(`Redis Sentinel: Failover completed for ${masterName}`);
  });
  
  // Обработка ошибок Sentinel
  redisClient.on('sentinel:error', (error) => {
    logger.error('Redis Sentinel error:', error);
  });
}

module.exports = {
  getRedisSentinelConfig,
  checkSentinelHealth,
  setupFailoverHandling
};