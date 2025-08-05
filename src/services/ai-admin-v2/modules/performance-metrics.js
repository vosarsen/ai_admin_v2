const logger = require('../../../utils/logger').child({ module: 'performance-metrics' });
const config = require('../config/modules-config');
const prometheusMetrics = require('./prometheus-metrics');

/**
 * @typedef {Object} ResponseTimeMetrics
 * @property {number} min - Minimum response time
 * @property {number} max - Maximum response time
 * @property {number} avg - Average response time
 * @property {number} total - Total response time
 * @property {number} p95 - 95th percentile
 * @property {number} p99 - 99th percentile
 * @property {number[]} samples - Response time samples
 */

/**
 * @typedef {Object} CacheMetrics
 * @property {number} hits - Cache hits
 * @property {number} misses - Cache misses
 * @property {number} evictions - Cache evictions
 * @property {number} hitRate - Cache hit rate percentage
 */

/**
 * @typedef {Object} ProviderMetrics
 * @property {number} calls - Total calls
 * @property {number} errors - Total errors
 * @property {number} avgResponseTime - Average response time
 * @property {number} totalTime - Total time spent
 */

/**
 * @typedef {Object} Operation
 * @property {string} name - Operation name
 * @property {number} startTime - Start timestamp
 * @property {number|null} endTime - End timestamp
 * @property {number|null} duration - Duration in ms
 * @property {boolean|null} success - Whether operation succeeded
 */

/**
 * @typedef {Object} OperationMetrics
 * @property {number} count - Total count
 * @property {number} successful - Successful count
 * @property {number} failed - Failed count
 * @property {number} avgDuration - Average duration
 * @property {number} minDuration - Minimum duration
 * @property {number} maxDuration - Maximum duration
 */

/**
 * @typedef {Object} Metrics
 * @property {number} totalRequests - Total requests
 * @property {number} successfulRequests - Successful requests
 * @property {number} failedRequests - Failed requests
 * @property {ResponseTimeMetrics} responseTime - Response time metrics
 * @property {Map<string, OperationMetrics>} operations - Operations metrics
 * @property {Map<string, OperationMetrics>} commands - Commands metrics
 * @property {CacheMetrics} cache - Cache metrics
 * @property {ProviderMetrics} aiProvider - AI provider metrics
 * @property {ProviderMetrics} database - Database metrics
 */

/**
 * Модуль для сбора метрик производительности AI Admin v2
 */
class PerformanceMetrics {
  constructor() {
    // Хранилище метрик
    this.metrics = {
      // Общие метрики
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      
      // Метрики времени выполнения (в миллисекундах)
      responseTime: {
        min: Infinity,
        max: 0,
        avg: 0,
        total: 0,
        p95: 0,
        p99: 0,
        samples: []
      },
      
      // Метрики по операциям
      operations: new Map(),
      
      // Метрики по командам
      commands: new Map(),
      
      // Метрики кэша
      cache: {
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0
      },
      
      // Метрики AI провайдера
      aiProvider: {
        calls: 0,
        errors: 0,
        avgResponseTime: 0,
        totalTime: 0
      },
      
      // Метрики базы данных
      database: {
        queries: 0,
        errors: 0,
        avgQueryTime: 0,
        totalTime: 0
      }
    };
    
    // Интервал для расчета процентилей
    this.percentileInterval = setInterval(() => {
      this.calculatePercentiles();
    }, config.performanceMetrics.percentileCalculationInterval);
    
    // Максимальное количество сэмплов для процентилей
    this.maxSamples = config.performanceMetrics.maxSamples;
  }

  /**
   * Записать начало операции
   * @param {string} operationName - Operation name
   * @returns {Operation} Operation object
   */
  startOperation(operationName) {
    const operation = {
      name: operationName,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      success: null
    };
    
    return operation;
  }

  /**
   * Записать завершение операции
   * @param {Operation} operation - Operation object
   * @param {boolean} [success=true] - Whether operation succeeded
   * @returns {void}
   */
  endOperation(operation, success = true) {
    operation.endTime = Date.now();
    operation.duration = operation.endTime - operation.startTime;
    operation.success = success;
    
    // Обновляем общие метрики
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Обновляем метрики времени ответа
    this.updateResponseTime(operation.duration);
    
    // Обновляем метрики по операциям
    this.updateOperationMetrics(operation.name, operation.duration, success);
    
    return operation;
  }

  /**
   * Обновить метрики времени ответа
   * @private
   * @param {number} duration - Response duration in ms
   * @returns {void}
   */
  updateResponseTime(duration) {
    const rt = this.metrics.responseTime;
    
    // Обновляем min/max
    rt.min = Math.min(rt.min, duration);
    rt.max = Math.max(rt.max, duration);
    
    // Обновляем среднее
    rt.total += duration;
    rt.avg = rt.total / this.metrics.totalRequests;
    
    // Добавляем сэмпл для процентилей
    rt.samples.push(duration);
    
    // Более эффективное управление памятью
    if (rt.samples.length >= this.maxSamples) {
      // Удаляем старые записи за раз, чтобы избежать частых операций slice
      const removeCount = Math.floor(this.maxSamples * config.performanceMetrics.sampleBatchRemovePercent);
      rt.samples.splice(0, removeCount);
    }
  }

  /**
   * Обновить метрики по операциям
   * @private
   * @param {string} operationName - Operation name
   * @param {number} duration - Operation duration
   * @param {boolean} success - Whether operation succeeded
   * @returns {void}
   */
  updateOperationMetrics(operationName, duration, success) {
    if (!this.metrics.operations.has(operationName)) {
      this.metrics.operations.set(operationName, {
        count: 0,
        success: 0,
        failed: 0,
        avgDuration: 0,
        totalDuration: 0
      });
    }
    
    const opMetrics = this.metrics.operations.get(operationName);
    opMetrics.count++;
    
    if (success) {
      opMetrics.success++;
    } else {
      opMetrics.failed++;
    }
    
    opMetrics.totalDuration += duration;
    opMetrics.avgDuration = opMetrics.totalDuration / opMetrics.count;
  }

  /**
   * Записать выполнение команды
   * @param {string} commandName - Command name
   * @param {boolean} [success=true] - Whether command succeeded
   * @param {number} [duration=0] - Command duration
   * @returns {void}
   */
  recordCommand(commandName, success = true, duration = 0) {
    if (!this.metrics.commands.has(commandName)) {
      this.metrics.commands.set(commandName, {
        executed: 0,
        success: 0,
        failed: 0,
        avgDuration: 0,
        totalDuration: 0
      });
    }
    
    const cmdMetrics = this.metrics.commands.get(commandName);
    cmdMetrics.executed++;
    
    if (success) {
      cmdMetrics.success++;
    } else {
      cmdMetrics.failed++;
    }
    
    if (duration > 0) {
      cmdMetrics.totalDuration += duration;
      cmdMetrics.avgDuration = cmdMetrics.totalDuration / cmdMetrics.executed;
      
      // Отправляем в Prometheus
      prometheusMetrics.recordCommandExecution(
        commandName,
        duration / 1000, // Конвертируем в секунды
        success
      );
    }
  }

  /**
   * Обновить метрики кэша
   * @param {boolean} [hit=false] - Whether cache hit occurred
   * @param {boolean} [evicted=false] - Whether item was evicted
   * @param {string} [cacheType='default'] - Cache type
   * @returns {void}
   */
  updateCacheMetrics(hit = false, evicted = false, cacheType = 'default') {
    if (hit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }
    
    if (evicted) {
      this.metrics.cache.evictions++;
    }
    
    // Рассчитываем hit rate
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    if (total > 0) {
      this.metrics.cache.hitRate = (this.metrics.cache.hits / total * 100).toFixed(2);
    }
    
    // Отправляем в Prometheus
    prometheusMetrics.recordCacheOperation(cacheType, hit);
    prometheusMetrics.updateCacheHitRate(cacheType, parseFloat(this.metrics.cache.hitRate));
  }

  /**
   * Записать вызов AI провайдера
   * @param {number} duration - Call duration in ms
   * @param {boolean} [success=true] - Whether call succeeded
   * @param {string} [provider='default'] - Provider name
   * @param {string} [model='default'] - Model name
   * @returns {void}
   */
  recordAICall(duration, success = true, provider = 'default', model = 'default') {
    this.metrics.aiProvider.calls++;
    
    if (!success) {
      this.metrics.aiProvider.errors++;
    }
    
    this.metrics.aiProvider.totalTime += duration;
    this.metrics.aiProvider.avgResponseTime = 
      this.metrics.aiProvider.totalTime / this.metrics.aiProvider.calls;
      
    // Отправляем в Prometheus
    prometheusMetrics.recordAIProviderCall(
      provider, 
      model, 
      duration / 1000, // Конвертируем в секунды
      success,
      success ? null : 'unknown'
    );
  }

  /**
   * Записать запрос к базе данных
   * @param {number} duration - Query duration in ms
   * @param {boolean} [success=true] - Whether query succeeded
   * @param {string} [operation='query'] - Operation type
   * @param {string} [table='unknown'] - Table name
   * @returns {void}
   */
  recordDatabaseQuery(duration, success = true, operation = 'query', table = 'unknown') {
    this.metrics.database.queries++;
    
    if (!success) {
      this.metrics.database.errors++;
    }
    
    this.metrics.database.totalTime += duration;
    this.metrics.database.avgQueryTime = 
      this.metrics.database.totalTime / this.metrics.database.queries;
      
    // Отправляем в Prometheus
    prometheusMetrics.recordDatabaseOperation(
      operation,
      table,
      duration / 1000, // Конвертируем в секунды
      success,
      success ? null : 'unknown'
    );
  }

  /**
   * Рассчитать процентили
   * @private
   * @returns {void}
   */
  calculatePercentiles() {
    const samples = this.metrics.responseTime.samples;
    if (samples.length === 0) return;
    
    // Сортируем сэмплы
    const sorted = [...samples].sort((a, b) => a - b);
    
    // Рассчитываем 95-й процентиль
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.responseTime.p95 = sorted[p95Index];
    
    // Рассчитываем 99-й процентиль
    const p99Index = Math.floor(sorted.length * 0.99);
    this.metrics.responseTime.p99 = sorted[p99Index];
  }

  /**
   * Получить сводку метрик
   * @returns {Object} Metrics summary
   */
  getSummary() {
    // Конвертируем Map в объекты для JSON
    const operations = {};
    for (const [name, metrics] of this.metrics.operations.entries()) {
      operations[name] = {
        ...metrics,
        successRate: metrics.count > 0 
          ? (metrics.success / metrics.count * 100).toFixed(2) + '%'
          : '0%',
        avgDuration: Math.round(metrics.avgDuration) + 'ms'
      };
    }
    
    const commands = {};
    for (const [name, metrics] of this.metrics.commands.entries()) {
      commands[name] = {
        ...metrics,
        successRate: metrics.executed > 0
          ? (metrics.success / metrics.executed * 100).toFixed(2) + '%'
          : '0%',
        avgDuration: Math.round(metrics.avgDuration) + 'ms'
      };
    }
    
    return {
      general: {
        totalRequests: this.metrics.totalRequests,
        successfulRequests: this.metrics.successfulRequests,
        failedRequests: this.metrics.failedRequests,
        successRate: this.metrics.totalRequests > 0
          ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        avgResponseTime: Math.round(this.metrics.responseTime.avg) + 'ms',
        minResponseTime: this.metrics.responseTime.min === Infinity 
          ? '0ms' 
          : Math.round(this.metrics.responseTime.min) + 'ms',
        maxResponseTime: Math.round(this.metrics.responseTime.max) + 'ms',
        p95ResponseTime: Math.round(this.metrics.responseTime.p95) + 'ms',
        p99ResponseTime: Math.round(this.metrics.responseTime.p99) + 'ms'
      },
      cache: {
        ...this.metrics.cache,
        hitRate: this.metrics.cache.hitRate + '%'
      },
      aiProvider: {
        ...this.metrics.aiProvider,
        avgResponseTime: Math.round(this.metrics.aiProvider.avgResponseTime) + 'ms',
        errorRate: this.metrics.aiProvider.calls > 0
          ? (this.metrics.aiProvider.errors / this.metrics.aiProvider.calls * 100).toFixed(2) + '%'
          : '0%'
      },
      database: {
        ...this.metrics.database,
        avgQueryTime: Math.round(this.metrics.database.avgQueryTime) + 'ms',
        errorRate: this.metrics.database.queries > 0
          ? (this.metrics.database.errors / this.metrics.database.queries * 100).toFixed(2) + '%'
          : '0%'
      },
      operations,
      commands
    };
  }

  /**
   * Сбросить метрики
   * @returns {Object} Snapshot before reset
   */
  reset() {
    // Сохраняем текущие метрики перед сбросом (для истории)
    const snapshot = this.getSummary();
    logger.info('Resetting metrics, current snapshot:', snapshot);
    
    // Сбрасываем все счетчики
    this.metrics.totalRequests = 0;
    this.metrics.successfulRequests = 0;
    this.metrics.failedRequests = 0;
    
    this.metrics.responseTime = {
      min: Infinity,
      max: 0,
      avg: 0,
      total: 0,
      p95: 0,
      p99: 0,
      samples: []
    };
    
    this.metrics.operations.clear();
    this.metrics.commands.clear();
    
    this.metrics.cache = {
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0
    };
    
    this.metrics.aiProvider = {
      calls: 0,
      errors: 0,
      avgResponseTime: 0,
      totalTime: 0
    };
    
    this.metrics.database = {
      queries: 0,
      errors: 0,
      avgQueryTime: 0,
      totalTime: 0
    };
    
    return snapshot;
  }

  /**
   * Остановить сбор метрик
   * @returns {void}
   */
  stop() {
    if (this.percentileInterval) {
      clearInterval(this.percentileInterval);
      this.percentileInterval = null;
    }
  }

  /**
   * Получить использование памяти метриками
   * @returns {Object} Memory usage details
   */
  getMemoryUsage() {
    const { bytesPerSample, bytesPerOperation } = config.performanceMetrics.memoryEstimates;
    const sampleMemory = this.metrics.responseTime.samples.length * bytesPerSample;
    const operationsMemory = this.metrics.operations.size * bytesPerOperation;
    const commandsMemory = this.metrics.commands.size * bytesPerOperation;
    
    return {
      samples: this.metrics.responseTime.samples.length,
      operations: this.metrics.operations.size,
      commands: this.metrics.commands.size,
      estimatedMemory: {
        samples: `~${(sampleMemory / 1024).toFixed(2)} KB`,
        operations: `~${(operationsMemory / 1024).toFixed(2)} KB`,
        commands: `~${(commandsMemory / 1024).toFixed(2)} KB`,
        total: `~${((sampleMemory + operationsMemory + commandsMemory) / 1024).toFixed(2)} KB`
      }
    };
  }
}

// Экспортируем singleton
module.exports = new PerformanceMetrics();