/**
 * Redis Connection Pool Manager
 * Управление пулом подключений для масштабируемости
 */

const Redis = require('ioredis');
const logger = require('./logger');
const { getRedisConfig } = require('../config/redis-config');
const { getRedisSentinelConfig } = require('../config/redis-sentinel-config');
const { getCircuitBreaker } = require('./circuit-breaker');

class RedisConnectionPool {
  constructor(options = {}) {
    this.poolSize = options.poolSize || parseInt(process.env.REDIS_POOL_SIZE) || 10;
    this.minIdle = options.minIdle || 2;
    this.maxIdle = options.maxIdle || 5;
    this.acquireTimeout = options.acquireTimeout || 5000;
    
    // Пулы для разных типов операций
    this.pools = {
      read: [],
      write: [],
      pubsub: [],
      blocking: [] // Для блокирующих операций типа BLPOP
    };
    
    // Статистика использования
    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      errors: 0,
      activeConnections: new Map()
    };
    
    // Очередь ожидания
    this.waitQueue = [];
    
    // Circuit Breaker для пула
    this.breaker = getCircuitBreaker('redis-pool', {
      failureThreshold: 5,
      resetTimeout: 30000,
      timeout: 5000
    });
    
    this.logger = logger.child({ module: 'redis-pool' });
    
    // Инициализация пулов
    this.initialized = false;
    this.initPromise = this.initialize();
  }

  /**
   * Инициализация пулов подключений
   */
  async initialize() {
    try {
      this.logger.info(`Initializing Redis connection pool with size: ${this.poolSize}`);
      
      // Создаём минимальное количество подключений для каждого пула
      for (const poolType of Object.keys(this.pools)) {
        for (let i = 0; i < this.minIdle; i++) {
          const connection = await this._createConnection(poolType);
          this.pools[poolType].push({
            client: connection,
            inUse: false,
            created: Date.now(),
            lastUsed: null,
            usageCount: 0
          });
        }
      }
      
      this.initialized = true;
      this.logger.info('Redis connection pool initialized successfully');
      
      // Запускаем периодическую проверку здоровья пула
      this._startHealthCheck();
      
    } catch (error) {
      this.logger.error('Failed to initialize Redis connection pool:', error);
      throw error;
    }
  }

  /**
   * Создание нового подключения
   */
  async _createConnection(poolType) {
    const config = process.env.REDIS_SENTINEL_ENABLED === 'true'
      ? getRedisSentinelConfig()
      : getRedisConfig();
    
    // Добавляем специфичные настройки для типа пула
    const poolConfig = {
      ...config,
      connectionName: `pool-${poolType}-${Date.now()}`,
      enableReadyCheck: true,
      maxRetriesPerRequest: poolType === 'write' ? 5 : 3
    };
    
    // Для read пула можно использовать slave nodes если доступны
    if (poolType === 'read' && process.env.REDIS_READ_FROM_SLAVE === 'true') {
      poolConfig.role = 'slave';
    }
    
    const client = new Redis(poolConfig);
    
    // Обработка событий
    client.on('error', (err) => {
      this.logger.error(`Redis pool connection error (${poolType}):`, err);
      this.stats.errors++;
    });
    
    client.on('close', () => {
      this.logger.warn(`Redis pool connection closed (${poolType})`);
    });
    
    await client.connect();
    this.stats.created++;
    
    return client;
  }

  /**
   * Получить подключение из пула
   */
  async acquire(poolType = 'write', options = {}) {
    await this.initPromise;
    
    const timeout = options.timeout || this.acquireTimeout;
    const priority = options.priority || 0; // Приоритет запроса
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout acquiring Redis connection from pool (${poolType})`));
      }, timeout);
      
      try {
        // Пытаемся получить через Circuit Breaker
        const connection = await this.breaker.execute(async () => {
          return await this._acquireConnection(poolType, priority);
        });
        
        clearTimeout(timeoutId);
        this.stats.acquired++;
        
        // Трекинг активных подключений
        this.stats.activeConnections.set(connection.client.connectionName, {
          poolType,
          acquiredAt: Date.now()
        });
        
        resolve(connection.client);
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.code === 'CIRCUIT_OPEN') {
          this.logger.error('Redis pool circuit breaker is OPEN');
        }
        
        reject(error);
      }
    });
  }

  /**
   * Внутренняя логика получения подключения
   */
  async _acquireConnection(poolType, priority) {
    const pool = this.pools[poolType];
    
    // Ищем свободное подключение
    for (let i = 0; i < pool.length; i++) {
      const conn = pool[i];
      if (!conn.inUse) {
        // Проверяем, что подключение живое
        try {
          await conn.client.ping();
          conn.inUse = true;
          conn.lastUsed = Date.now();
          conn.usageCount++;
          return conn;
        } catch (error) {
          // Подключение мертво, удаляем и создаём новое
          this.logger.warn(`Dead connection detected in pool ${poolType}, replacing...`);
          await this._destroyConnection(conn);
          pool.splice(i, 1);
          i--;
        }
      }
    }
    
    // Если нет свободных и можем создать новое
    if (pool.length < this.poolSize) {
      const newConn = await this._createConnection(poolType);
      const connWrapper = {
        client: newConn,
        inUse: true,
        created: Date.now(),
        lastUsed: Date.now(),
        usageCount: 1
      };
      pool.push(connWrapper);
      return connWrapper;
    }
    
    // Все подключения заняты - добавляем в очередь ожидания
    return new Promise((resolve, reject) => {
      this.waitQueue.push({
        poolType,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Сортируем очередь по приоритету
      this.waitQueue.sort((a, b) => b.priority - a.priority);
    });
  }

  /**
   * Вернуть подключение в пул
   */
  release(client) {
    if (!client || !client.connectionName) return;
    
    // Находим подключение в пулах
    for (const [poolType, pool] of Object.entries(this.pools)) {
      const conn = pool.find(c => c.client === client);
      if (conn) {
        conn.inUse = false;
        conn.lastUsed = Date.now();
        this.stats.released++;
        
        // Удаляем из трекинга
        this.stats.activeConnections.delete(client.connectionName);
        
        // Проверяем очередь ожидания
        this._processWaitQueue(poolType);
        
        // Если слишком много idle подключений, закрываем лишние
        this._cleanupIdleConnections(poolType);
        
        return;
      }
    }
    
    this.logger.warn('Attempted to release unknown connection');
  }

  /**
   * Обработка очереди ожидания
   */
  _processWaitQueue(poolType) {
    if (this.waitQueue.length === 0) return;
    
    // Ищем запросы для этого типа пула
    for (let i = 0; i < this.waitQueue.length; i++) {
      const request = this.waitQueue[i];
      if (request.poolType === poolType) {
        // Пытаемся выдать подключение
        this._acquireConnection(poolType, request.priority)
          .then(request.resolve)
          .catch(request.reject);
        
        this.waitQueue.splice(i, 1);
        break;
      }
    }
  }

  /**
   * Очистка неиспользуемых подключений
   */
  _cleanupIdleConnections(poolType) {
    const pool = this.pools[poolType];
    const idleConnections = pool.filter(c => !c.inUse);
    
    if (idleConnections.length > this.maxIdle) {
      const toRemove = idleConnections.length - this.maxIdle;
      
      // Удаляем самые старые неиспользуемые подключения
      idleConnections
        .sort((a, b) => a.lastUsed - b.lastUsed)
        .slice(0, toRemove)
        .forEach(async conn => {
          const index = pool.indexOf(conn);
          if (index > -1) {
            pool.splice(index, 1);
            await this._destroyConnection(conn);
          }
        });
    }
  }

  /**
   * Уничтожение подключения
   */
  async _destroyConnection(conn) {
    try {
      await conn.client.quit();
      this.stats.destroyed++;
    } catch (error) {
      this.logger.error('Error destroying connection:', error);
    }
  }

  /**
   * Периодическая проверка здоровья пула
   */
  _startHealthCheck() {
    setInterval(async () => {
      for (const [poolType, pool] of Object.entries(this.pools)) {
        const stats = {
          total: pool.length,
          inUse: pool.filter(c => c.inUse).length,
          idle: pool.filter(c => !c.inUse).length,
          avgUsage: pool.reduce((sum, c) => sum + c.usageCount, 0) / pool.length
        };
        
        this.logger.debug(`Pool health (${poolType}):`, stats);
        
        // Проверяем застрявшие подключения
        const now = Date.now();
        const stuckThreshold = 5 * 60 * 1000; // 5 минут
        
        for (const conn of pool) {
          if (conn.inUse && (now - conn.lastUsed) > stuckThreshold) {
            this.logger.warn(`Stuck connection detected in pool ${poolType}, releasing...`);
            conn.inUse = false;
            this._processWaitQueue(poolType);
          }
        }
      }
      
      // Очистка старых запросов из очереди
      const queueTimeout = 30000; // 30 секунд
      const now = Date.now();
      this.waitQueue = this.waitQueue.filter(req => {
        if ((now - req.timestamp) > queueTimeout) {
          req.reject(new Error('Request timeout in wait queue'));
          return false;
        }
        return true;
      });
      
    }, 30000); // Каждые 30 секунд
  }

  /**
   * Получение статистики пула
   */
  getStats() {
    const poolStats = {};
    
    for (const [poolType, pool] of Object.entries(this.pools)) {
      poolStats[poolType] = {
        total: pool.length,
        inUse: pool.filter(c => c.inUse).length,
        idle: pool.filter(c => !c.inUse).length,
        avgUsage: pool.length > 0 
          ? pool.reduce((sum, c) => sum + c.usageCount, 0) / pool.length 
          : 0
      };
    }
    
    return {
      pools: poolStats,
      stats: this.stats,
      waitQueue: this.waitQueue.length,
      circuitBreakerState: this.breaker.getState()
    };
  }

  /**
   * Graceful shutdown пула
   */
  async shutdown() {
    this.logger.info('Shutting down Redis connection pool...');
    
    // Отклоняем все запросы в очереди
    for (const req of this.waitQueue) {
      req.reject(new Error('Pool is shutting down'));
    }
    this.waitQueue = [];
    
    // Закрываем все подключения
    for (const [poolType, pool] of Object.entries(this.pools)) {
      for (const conn of pool) {
        await this._destroyConnection(conn);
      }
      this.pools[poolType] = [];
    }
    
    this.logger.info('Redis connection pool shut down successfully');
  }

  /**
   * Выполнить операцию с автоматическим управлением подключением
   */
  async execute(operation, poolType = 'write', options = {}) {
    const client = await this.acquire(poolType, options);
    
    try {
      const result = await operation(client);
      return result;
    } finally {
      this.release(client);
    }
  }
}

// Singleton экземпляр
let instance = null;

module.exports = {
  getInstance(options) {
    if (!instance) {
      instance = new RedisConnectionPool(options);
    }
    return instance;
  },
  
  RedisConnectionPool
};