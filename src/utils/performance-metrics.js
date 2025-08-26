// src/utils/performance-metrics.js
/**
 * Система метрик производительности
 * Отслеживает производительность всех критичных операций
 */

const logger = require('./logger');

class PerformanceMetrics {
  constructor() {
    this.metrics = new Map();
    this.intervals = new Map();
    
    // Настройки
    this.config = {
      maxHistorySize: 1000, // Максимум записей в истории
      reportInterval: 60000, // Отчет каждую минуту
      slowOperationThreshold: 1000, // Операция считается медленной после 1 сек
    };
    
    // Запускаем периодический отчет
    this.startPeriodicReport();
  }

  /**
   * Начать замер операции
   */
  startOperation(name, metadata = {}) {
    const id = `${name}-${Date.now()}-${Math.random()}`;
    
    this.intervals.set(id, {
      name,
      startTime: Date.now(),
      metadata
    });
    
    return id;
  }

  /**
   * Завершить замер операции
   */
  endOperation(id, success = true, metadata = {}) {
    const operation = this.intervals.get(id);
    if (!operation) {
      logger.warn(`Operation ${id} not found in metrics`);
      return;
    }
    
    const duration = Date.now() - operation.startTime;
    this.intervals.delete(id);
    
    // Объединяем metadata
    const combinedMetadata = { ...operation.metadata, ...metadata };
    
    // Сохраняем метрику
    this._recordMetric(operation.name, {
      duration,
      success,
      metadata: combinedMetadata,
      timestamp: new Date().toISOString()
    });
    
    // Логируем медленные операции
    if (duration > this.config.slowOperationThreshold) {
      logger.warn(`Slow operation detected: ${operation.name} took ${duration}ms`, {
        ...operation.metadata,
        ...metadata
      });
    }
    
    return duration;
  }

  /**
   * Измерить async операцию
   */
  async measure(name, operation, metadata = {}) {
    const id = this.startOperation(name, metadata);
    
    try {
      const result = await operation();
      this.endOperation(id, true);
      return result;
    } catch (error) {
      this.endOperation(id, false, { error: error.message });
      throw error;
    }
  }

  /**
   * Измерить sync операцию
   */
  measureSync(name, operation, metadata = {}) {
    const id = this.startOperation(name, metadata);
    
    try {
      const result = operation();
      this.endOperation(id, true);
      return result;
    } catch (error) {
      this.endOperation(id, false, { error: error.message });
      throw error;
    }
  }

  /**
   * Записать метрику
   */
  _recordMetric(name, data) {
    // Ограничиваем размер metadata для предотвращения memory leak
    if (data.metadata) {
      const metadataStr = JSON.stringify(data.metadata);
      if (metadataStr.length > 1000) {
        // Сохраняем только ключи и обрезанные значения
        const truncated = {};
        for (const [key, value] of Object.entries(data.metadata)) {
          if (typeof value === 'string' && value.length > 100) {
            truncated[key] = value.substring(0, 100) + '...';
          } else if (typeof value === 'object' && value !== null) {
            truncated[key] = '[object]';
          } else {
            truncated[key] = value;
          }
        }
        truncated._truncated = true;
        data.metadata = truncated;
        logger.debug(`Truncated large metadata for metric ${name}`);
      }
    }
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        history: [],
        stats: {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          avgDuration: 0,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
          p50: 0,
          p95: 0,
          p99: 0
        }
      });
    }
    
    const metric = this.metrics.get(name);
    
    // Добавляем в историю
    metric.history.push(data);
    
    // Ограничиваем размер истории
    if (metric.history.length > this.config.maxHistorySize) {
      metric.history = metric.history.slice(-this.config.maxHistorySize);
    }
    
    // Обновляем статистику
    this._updateStats(metric);
  }

  /**
   * Обновить статистику метрики
   */
  _updateStats(metric) {
    const stats = metric.stats;
    const history = metric.history;
    
    // Базовые метрики
    stats.count = history.length;
    stats.totalDuration = history.reduce((sum, h) => sum + h.duration, 0);
    stats.successCount = history.filter(h => h.success).length;
    stats.failureCount = stats.count - stats.successCount;
    
    if (stats.count > 0) {
      stats.avgDuration = Math.round(stats.totalDuration / stats.count);
      stats.successRate = Math.round((stats.successCount / stats.count) * 100);
      
      // Min/Max
      const durations = history.map(h => h.duration).sort((a, b) => a - b);
      stats.minDuration = durations[0];
      stats.maxDuration = durations[durations.length - 1];
      
      // Percentiles
      stats.p50 = this._getPercentile(durations, 50);
      stats.p95 = this._getPercentile(durations, 95);
      stats.p99 = this._getPercentile(durations, 99);
    }
  }

  /**
   * Вычислить перцентиль
   */
  _getPercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Получить статистику по операции
   */
  getStats(name) {
    const metric = this.metrics.get(name);
    if (!metric) return null;
    
    return {
      ...metric.stats,
      recentOperations: metric.history.slice(-10)
    };
  }

  /**
   * Получить всю статистику
   */
  getAllStats() {
    const stats = {};
    
    this.metrics.forEach((metric, name) => {
      stats[name] = metric.stats;
    });
    
    return stats;
  }

  /**
   * Получить топ медленных операций
   */
  getSlowOperations(limit = 10) {
    const allOperations = [];
    
    this.metrics.forEach((metric, name) => {
      metric.history.forEach(op => {
        if (op.duration > this.config.slowOperationThreshold) {
          allOperations.push({
            name,
            ...op
          });
        }
      });
    });
    
    return allOperations
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Запустить периодический отчет
   */
  startPeriodicReport() {
    this.reportInterval = setInterval(() => {
      this.generateReport();
    }, this.config.reportInterval);
  }

  /**
   * Сгенерировать отчет
   */
  generateReport() {
    const stats = this.getAllStats();
    
    // Находим проблемные операции
    const problems = [];
    
    Object.entries(stats).forEach(([name, stat]) => {
      // Низкий success rate
      if (stat.successRate < 95 && stat.count > 10) {
        problems.push(`${name}: Low success rate ${stat.successRate}%`);
      }
      
      // Высокий p95
      if (stat.p95 > 5000) {
        problems.push(`${name}: High p95 latency ${stat.p95}ms`);
      }
    });
    
    // Логируем только если есть проблемы
    if (problems.length > 0) {
      logger.warn('Performance problems detected:', problems);
    }
    
    // Детальный отчет в debug режиме
    logger.debug('Performance metrics report:', {
      operationsCount: Object.keys(stats).length,
      topByAvgDuration: Object.entries(stats)
        .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
        .slice(0, 5)
        .map(([name, stat]) => ({
          name,
          avgDuration: stat.avgDuration,
          count: stat.count
        })),
      topByCount: Object.entries(stats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, stat]) => ({
          name,
          count: stat.count,
          avgDuration: stat.avgDuration
        }))
    });
  }

  /**
   * Очистить метрики
   */
  clear() {
    this.metrics.clear();
    this.intervals.clear();
  }

  /**
   * Остановить сбор метрик
   */
  stop() {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }

  /**
   * Экспорт метрик в формате Prometheus
   */
  exportPrometheus() {
    const lines = [];
    
    this.metrics.forEach((metric, name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      const stats = metric.stats;
      
      lines.push(`# HELP ${safeName}_duration_ms Operation duration in milliseconds`);
      lines.push(`# TYPE ${safeName}_duration_ms summary`);
      lines.push(`${safeName}_duration_ms{quantile="0.5"} ${stats.p50}`);
      lines.push(`${safeName}_duration_ms{quantile="0.95"} ${stats.p95}`);
      lines.push(`${safeName}_duration_ms{quantile="0.99"} ${stats.p99}`);
      lines.push(`${safeName}_duration_ms_sum ${stats.totalDuration}`);
      lines.push(`${safeName}_duration_ms_count ${stats.count}`);
      
      lines.push(`# HELP ${safeName}_success_rate Operation success rate`);
      lines.push(`# TYPE ${safeName}_success_rate gauge`);
      lines.push(`${safeName}_success_rate ${stats.successRate / 100}`);
    });
    
    return lines.join('\n');
  }
}

// Singleton instance
const metrics = new PerformanceMetrics();

// Декоратор для автоматического измерения методов класса
function measurePerformance(target, propertyKey, descriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function(...args) {
    const className = target.constructor.name;
    const operationName = `${className}.${propertyKey}`;
    
    return metrics.measure(operationName, () => originalMethod.apply(this, args));
  };
  
  return descriptor;
}

module.exports = {
  PerformanceMetrics,
  metrics,
  measurePerformance
};