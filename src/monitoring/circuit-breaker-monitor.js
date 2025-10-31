/**
 * Circuit Breaker Monitoring
 * Отслеживание состояния Circuit Breaker для Redis и других сервисов
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class CircuitBreakerMonitor extends EventEmitter {
  constructor() {
    super();
    this.breakers = new Map();
    this.metrics = new Map();
    
    // Интервал сбора метрик
    this.metricsInterval = null;
    this.metricsIntervalMs = 60000; // 1 минута
    
    // Алерты
    this.alertThresholds = {
      errorRate: 0.5, // 50% ошибок
      openCircuits: 3, // 3+ открытых circuit breaker
      halfOpenFailures: 5 // 5+ неудачных попыток в half-open
    };
  }

  /**
   * Регистрация Circuit Breaker для мониторинга
   */
  register(name, breaker) {
    this.breakers.set(name, breaker);
    
    // Инициализация метрик
    this.metrics.set(name, {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      openCount: 0,
      halfOpenCount: 0,
      closedCount: 0,
      lastStateChange: Date.now(),
      currentState: 'CLOSED',
      errorRate: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      responseTimes: []
    });
    
    // Подписка на события Circuit Breaker
    this._attachListeners(name, breaker);
    
    logger.info(`Circuit Breaker registered: ${name}`);
  }

  /**
   * Подписка на события Circuit Breaker
   */
  _attachListeners(name, breaker) {
    const metrics = this.metrics.get(name);
    
    // Успешный вызов
    breaker.on('success', (duration) => {
      metrics.totalCalls++;
      metrics.successCalls++;
      metrics.responseTimes.push(duration);
      this._updateResponseTimeMetrics(name);
      this.emit('call:success', { name, duration });
    });
    
    // Неудачный вызов
    breaker.on('failure', (error, duration) => {
      metrics.totalCalls++;
      metrics.failedCalls++;
      if (duration) {
        metrics.responseTimes.push(duration);
        this._updateResponseTimeMetrics(name);
      }
      this.emit('call:failure', { name, error, duration });
      
      // Проверка порога ошибок
      this._checkErrorRate(name);
    });
    
    // Открытие Circuit Breaker
    breaker.on('open', () => {
      metrics.openCount++;
      metrics.currentState = 'OPEN';
      metrics.lastStateChange = Date.now();
      
      logger.warn(`Circuit Breaker OPENED: ${name}`);
      this.emit('state:open', { name });
      
      // Алерт при открытии
      this._sendAlert('circuit_open', {
        name,
        message: `Circuit Breaker ${name} is now OPEN`
      });
    });
    
    // Переход в half-open
    breaker.on('halfOpen', () => {
      metrics.halfOpenCount++;
      metrics.currentState = 'HALF_OPEN';
      metrics.lastStateChange = Date.now();
      
      logger.info(`Circuit Breaker HALF-OPEN: ${name}`);
      this.emit('state:halfOpen', { name });
    });
    
    // Закрытие Circuit Breaker
    breaker.on('close', () => {
      metrics.closedCount++;
      metrics.currentState = 'CLOSED';
      metrics.lastStateChange = Date.now();
      
      logger.info(`Circuit Breaker CLOSED: ${name}`);
      this.emit('state:closed', { name });
    });
    
    // Таймаут
    breaker.on('timeout', () => {
      logger.warn(`Circuit Breaker TIMEOUT: ${name}`);
      this.emit('timeout', { name });
    });
  }

  /**
   * Обновление метрик времени ответа
   */
  _updateResponseTimeMetrics(name) {
    const metrics = this.metrics.get(name);
    const times = metrics.responseTimes.slice(-1000); // Последние 1000 измерений
    
    if (times.length === 0) return;
    
    // Сортировка для персентилей
    const sorted = times.sort((a, b) => a - b);
    
    // Средее время
    metrics.avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
    
    // P95
    const p95Index = Math.floor(sorted.length * 0.95);
    metrics.p95ResponseTime = sorted[p95Index];
    
    // P99
    const p99Index = Math.floor(sorted.length * 0.99);
    metrics.p99ResponseTime = sorted[p99Index];
    
    // Очистка старых данных
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes = times;
    }
  }

  /**
   * Проверка процента ошибок
   */
  _checkErrorRate(name) {
    const metrics = this.metrics.get(name);
    
    if (metrics.totalCalls > 0) {
      metrics.errorRate = metrics.failedCalls / metrics.totalCalls;
      
      if (metrics.errorRate > this.alertThresholds.errorRate) {
        this._sendAlert('high_error_rate', {
          name,
          errorRate: metrics.errorRate,
          message: `High error rate for ${name}: ${(metrics.errorRate * 100).toFixed(2)}%`
        });
      }
    }
  }

  /**
   * Отправка алерта
   */
  _sendAlert(type, data) {
    logger.error(`🚨 ALERT [${type}]:`, data);
    this.emit('alert', { type, ...data });
    
    // Здесь можно добавить отправку в Slack, PagerDuty, etc.
  }

  /**
   * Запуск мониторинга
   */
  start() {
    if (this.metricsInterval) {
      return;
    }
    
    this.metricsInterval = setInterval(() => {
      this._collectMetrics();
    }, this.metricsIntervalMs);
    
    logger.info('Circuit Breaker monitoring started');
  }

  /**
   * Остановка мониторинга
   */
  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    logger.info('Circuit Breaker monitoring stopped');
  }

  /**
   * Сбор метрик
   */
  _collectMetrics() {
    const summary = {
      timestamp: Date.now(),
      breakers: []
    };
    
    let openCount = 0;
    
    for (const [name, metrics] of this.metrics) {
      const breakerStats = {
        name,
        state: metrics.currentState,
        totalCalls: metrics.totalCalls,
        successRate: metrics.totalCalls > 0 
          ? ((metrics.successCalls / metrics.totalCalls) * 100).toFixed(2) + '%'
          : '0%',
        errorRate: (metrics.errorRate * 100).toFixed(2) + '%',
        avgResponseTime: Math.round(metrics.avgResponseTime),
        p95ResponseTime: Math.round(metrics.p95ResponseTime),
        p99ResponseTime: Math.round(metrics.p99ResponseTime),
        stateChanges: {
          open: metrics.openCount,
          halfOpen: metrics.halfOpenCount,
          closed: metrics.closedCount
        }
      };
      
      summary.breakers.push(breakerStats);
      
      if (metrics.currentState === 'OPEN') {
        openCount++;
      }
    }
    
    // Проверка на слишком много открытых Circuit Breakers
    if (openCount >= this.alertThresholds.openCircuits) {
      this._sendAlert('multiple_circuits_open', {
        count: openCount,
        message: `${openCount} Circuit Breakers are OPEN`
      });
    }
    
    // Логирование сводки
    logger.debug('Circuit Breaker metrics:', summary);
    
    // Emit для внешних систем мониторинга
    this.emit('metrics', summary);
    
    return summary;
  }

  /**
   * Получение текущих метрик
   */
  getMetrics(name = null) {
    if (name) {
      return this.metrics.get(name);
    }
    
    const result = {};
    for (const [key, value] of this.metrics) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Получение состояния всех Circuit Breakers
   */
  getStatus() {
    const status = {
      healthy: true,
      breakers: {}
    };
    
    for (const [name, metrics] of this.metrics) {
      status.breakers[name] = {
        state: metrics.currentState,
        healthy: metrics.currentState !== 'OPEN',
        errorRate: metrics.errorRate,
        lastStateChange: new Date(metrics.lastStateChange).toISOString()
      };
      
      if (metrics.currentState === 'OPEN') {
        status.healthy = false;
      }
    }
    
    return status;
  }

  /**
   * Сброс метрик
   */
  resetMetrics(name = null) {
    if (name) {
      const metrics = this.metrics.get(name);
      if (metrics) {
        metrics.totalCalls = 0;
        metrics.successCalls = 0;
        metrics.failedCalls = 0;
        metrics.errorRate = 0;
        metrics.responseTimes = [];
        metrics.avgResponseTime = 0;
        metrics.p95ResponseTime = 0;
        metrics.p99ResponseTime = 0;
      }
    } else {
      // Сброс всех метрик
      for (const metrics of this.metrics.values()) {
        metrics.totalCalls = 0;
        metrics.successCalls = 0;
        metrics.failedCalls = 0;
        metrics.errorRate = 0;
        metrics.responseTimes = [];
        metrics.avgResponseTime = 0;
        metrics.p95ResponseTime = 0;
        metrics.p99ResponseTime = 0;
      }
    }
    
    logger.info(`Metrics reset for: ${name || 'all breakers'}`);
  }

  /**
   * Экспорт метрик для Prometheus
   */
  getPrometheusMetrics() {
    const lines = [];
    
    // Headers
    lines.push('# HELP circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)');
    lines.push('# TYPE circuit_breaker_state gauge');
    
    lines.push('# HELP circuit_breaker_total_calls Total number of calls');
    lines.push('# TYPE circuit_breaker_total_calls counter');
    
    lines.push('# HELP circuit_breaker_success_calls Successful calls');
    lines.push('# TYPE circuit_breaker_success_calls counter');
    
    lines.push('# HELP circuit_breaker_failed_calls Failed calls');
    lines.push('# TYPE circuit_breaker_failed_calls counter');
    
    lines.push('# HELP circuit_breaker_response_time Response time in milliseconds');
    lines.push('# TYPE circuit_breaker_response_time histogram');
    
    // Metrics
    for (const [name, metrics] of this.metrics) {
      const labels = `{name="${name}"}`;
      
      // State (0=closed, 1=half-open, 2=open)
      const stateValue = metrics.currentState === 'CLOSED' ? 0 : 
                         metrics.currentState === 'HALF_OPEN' ? 1 : 2;
      lines.push(`circuit_breaker_state${labels} ${stateValue}`);
      
      // Counters
      lines.push(`circuit_breaker_total_calls${labels} ${metrics.totalCalls}`);
      lines.push(`circuit_breaker_success_calls${labels} ${metrics.successCalls}`);
      lines.push(`circuit_breaker_failed_calls${labels} ${metrics.failedCalls}`);
      
      // Response times
      if (metrics.avgResponseTime > 0) {
        lines.push(`circuit_breaker_response_time${labels}{quantile="0.5"} ${metrics.avgResponseTime}`);
        lines.push(`circuit_breaker_response_time${labels}{quantile="0.95"} ${metrics.p95ResponseTime}`);
        lines.push(`circuit_breaker_response_time${labels}{quantile="0.99"} ${metrics.p99ResponseTime}`);
      }
    }
    
    return lines.join('\n');
  }
}

// Singleton
let instance = null;

module.exports = {
  getInstance() {
    if (!instance) {
      instance = new CircuitBreakerMonitor();
    }
    return instance;
  },
  
  CircuitBreakerMonitor
};