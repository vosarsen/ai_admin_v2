// src/utils/redis-factory.js
const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');
const { getCircuitBreaker } = require('./circuit-breaker');

/**
 * Create a Redis client with authentication and error handling
 */
function createRedisClient(role = 'default') {
  // Используем централизованную конфигурацию
  const { getRedisConfig } = require('../config/redis-config');
  
  try {
    const clientOptions = {
      ...getRedisConfig(),
      lazyConnect: true, // Don't connect immediately
      connectionName: `${role}-${Date.now()}` // Для идентификации в логах
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
    // Не бросаем ошибку сразу, даем Circuit Breaker обработать
  });

  // Оборачиваем клиента в Circuit Breaker для критичных операций
  const breaker = getCircuitBreaker(`redis-${role}`, {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 секунд
    timeout: 5000 // 5 секунд на операцию
  });

  // Создаем proxy для автоматического применения Circuit Breaker
  const wrappedClient = new Proxy(client, {
    get(target, prop) {
      // Специальная обработка для pipeline и multi - они возвращают объекты с методами
      if (prop === 'pipeline' || prop === 'multi') {
        return (...args) => {
          // Возвращаем оригинальный pipeline/multi без обертки
          // так как они имеют свою цепочку методов
          const pipelineOrMulti = target[prop](...args);
          
          // Оборачиваем только метод exec в Circuit Breaker
          const originalExec = pipelineOrMulti.exec.bind(pipelineOrMulti);
          pipelineOrMulti.exec = async () => {
            try {
              return await breaker.execute(() => originalExec());
            } catch (error) {
              if (error.code === 'CIRCUIT_OPEN') {
                redisLogger.warn(`Redis circuit breaker is OPEN for ${role}, pipeline/multi failed`);
                return null;
              }
              throw error;
            }
          };
          
          return pipelineOrMulti;
        };
      }
      
      // Для обычных методов Redis применяем Circuit Breaker
      if (typeof target[prop] === 'function') {
        const originalMethod = target[prop].bind(target);
        
        // Критичные методы, которые должны работать через Circuit Breaker
        const criticalMethods = ['get', 'set', 'setex', 'hgetall', 'hset', 'del', 'expire', 'exec', 'watch', 'lrange', 'lpush', 'ltrim'];
        
        if (criticalMethods.includes(prop)) {
          return async (...args) => {
            try {
              return await breaker.execute(() => originalMethod(...args));
            } catch (error) {
              if (error.code === 'CIRCUIT_OPEN') {
                redisLogger.warn(`Redis circuit breaker is OPEN for ${role}, using fallback`);
                // Можем вернуть null или кэшированные данные
                return null;
              }
              throw error;
            }
          };
        }
        
        return originalMethod;
      }
      
      return target[prop];
    }
  });

  return wrappedClient;
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