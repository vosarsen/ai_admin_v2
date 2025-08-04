const logger = require('../../../utils/logger').child({ module: 'performance-metrics' });

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
    }, 60000); // Каждую минуту
    
    // Максимальное количество сэмплов для процентилей
    this.maxSamples = 1000;
  }

  /**
   * Записать начало операции
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
    
    // Ограничиваем количество сэмплов
    if (rt.samples.length > this.maxSamples) {
      rt.samples = rt.samples.slice(-this.maxSamples);
    }
  }

  /**
   * Обновить метрики по операциям
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
    }
  }

  /**
   * Обновить метрики кэша
   */
  updateCacheMetrics(hit = false, evicted = false) {
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
  }

  /**
   * Записать вызов AI провайдера
   */
  recordAICall(duration, success = true) {
    this.metrics.aiProvider.calls++;
    
    if (!success) {
      this.metrics.aiProvider.errors++;
    }
    
    this.metrics.aiProvider.totalTime += duration;
    this.metrics.aiProvider.avgResponseTime = 
      this.metrics.aiProvider.totalTime / this.metrics.aiProvider.calls;
  }

  /**
   * Записать запрос к базе данных
   */
  recordDatabaseQuery(duration, success = true) {
    this.metrics.database.queries++;
    
    if (!success) {
      this.metrics.database.errors++;
    }
    
    this.metrics.database.totalTime += duration;
    this.metrics.database.avgQueryTime = 
      this.metrics.database.totalTime / this.metrics.database.queries;
  }

  /**
   * Рассчитать процентили
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
   */
  stop() {
    if (this.percentileInterval) {
      clearInterval(this.percentileInterval);
      this.percentileInterval = null;
    }
  }
}

// Экспортируем singleton
module.exports = new PerformanceMetrics();