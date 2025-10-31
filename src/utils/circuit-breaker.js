// src/utils/circuit-breaker.js
/**
 * Circuit Breaker для защиты от каскадных сбоев
 * 
 * Состояния:
 * - CLOSED: Нормальная работа, все запросы проходят
 * - OPEN: Сервис недоступен, запросы блокируются
 * - HALF_OPEN: Пробное восстановление, пропускаем один запрос
 */

const EventEmitter = require('events');
const logger = require('./logger');

const STATE = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open'
};

class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Конфигурация
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5; // Открываем после N ошибок
    this.resetTimeout = options.resetTimeout || 60000; // 60 секунд до попытки восстановления
    this.successThreshold = options.successThreshold || 2; // N успехов для закрытия из half-open
    this.timeout = options.timeout || 10000; // Таймаут операции
    
    // Состояние
    this.state = STATE.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.lastError = null;
    
    // Статистика
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      stateChanges: []
    };
    
    this.logger = logger.child({ module: 'circuit-breaker', name: this.name });
    
    // Регистрация в мониторе если доступен
    // TODO: Implement monitor registration
    // this._registerMonitor();
  }

  /**
   * Выполнить операцию через Circuit Breaker
   */
  async execute(operation) {
    this.stats.totalRequests++;
    
    // Проверяем состояние
    if (this.state === STATE.OPEN) {
      if (Date.now() < this.nextAttempt) {
        // Еще рано пробовать
        this.stats.rejectedRequests++;
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.code = 'CIRCUIT_OPEN';
        error.lastError = this.lastError;
        throw error;
      }
      
      // Переходим в HALF_OPEN для пробного запроса
      this._changeState(STATE.HALF_OPEN);
    }
    
    try {
      // Добавляем таймаут к операции
      const result = await this._executeWithTimeout(operation);
      
      // Успешное выполнение
      this._onSuccess();
      return result;
      
    } catch (error) {
      // Ошибка выполнения
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * Выполнить операцию с таймаутом
   */
  async _executeWithTimeout(operation) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.timeout}ms`));
      }, this.timeout);
      
      try {
        const result = await operation();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Обработка успешного выполнения
   */
  _onSuccess() {
    this.stats.successfulRequests++;
    this.failures = 0;
    
    switch (this.state) {
      case STATE.HALF_OPEN:
        this.successes++;
        if (this.successes >= this.successThreshold) {
          // Достаточно успехов, закрываем circuit
          this._changeState(STATE.CLOSED);
        }
        break;
      
      case STATE.CLOSED:
        // Все хорошо, ничего не делаем
        break;
    }
  }

  /**
   * Обработка ошибки
   */
  _onFailure(error) {
    this.stats.failedRequests++;
    this.failures++;
    this.lastError = error;
    
    switch (this.state) {
      case STATE.HALF_OPEN:
        // Пробный запрос не удался, открываем circuit снова
        this._changeState(STATE.OPEN);
        break;
      
      case STATE.CLOSED:
        if (this.failures >= this.failureThreshold) {
          // Слишком много ошибок, открываем circuit
          this._changeState(STATE.OPEN);
        }
        break;
    }
  }

  /**
   * Изменить состояние Circuit Breaker
   */
  _changeState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    // Сбрасываем счетчики при смене состояния
    switch (newState) {
      case STATE.CLOSED:
        this.failures = 0;
        this.successes = 0;
        this.logger.info(`Circuit breaker CLOSED for ${this.name}`);
        break;
      
      case STATE.OPEN:
        this.nextAttempt = Date.now() + this.resetTimeout;
        this.successes = 0;
        this.logger.warn(`Circuit breaker OPEN for ${this.name}, retry in ${this.resetTimeout}ms`);
        break;
      
      case STATE.HALF_OPEN:
        this.successes = 0;
        this.logger.info(`Circuit breaker HALF_OPEN for ${this.name}, testing...`);
        break;
    }
    
    // Записываем в статистику
    this.stats.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: new Date().toISOString(),
      reason: this.lastError?.message
    });
    
    // Ограничиваем историю изменений
    if (this.stats.stateChanges.length > 100) {
      this.stats.stateChanges = this.stats.stateChanges.slice(-50);
    }
  }

  /**
   * Получить текущее состояние
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.state === STATE.OPEN ? this.nextAttempt : null,
      lastError: this.lastError?.message
    };
  }

  /**
   * Получить статистику
   */
  getStats() {
    const successRate = this.stats.totalRequests > 0
      ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      currentState: this.state,
      recentStateChanges: this.stats.stateChanges.slice(-5)
    };
  }

  /**
   * Принудительно сбросить состояние
   */
  reset() {
    this._changeState(STATE.CLOSED);
    this.failures = 0;
    this.successes = 0;
    this.lastError = null;
    this.logger.info(`Circuit breaker manually reset for ${this.name}`);
  }

  /**
   * Проверить доступность без выполнения операции
   */
  isAvailable() {
    if (this.state === STATE.CLOSED) return true;
    if (this.state === STATE.HALF_OPEN) return true;
    if (this.state === STATE.OPEN && Date.now() >= this.nextAttempt) return true;
    return false;
  }
}

// Фабрика для создания Circuit Breaker'ов
class CircuitBreakerFactory {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Получить или создать Circuit Breaker
   */
  get(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name);
  }

  /**
   * Получить статистику всех breaker'ов
   */
  getAllStats() {
    const stats = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Сбросить все breaker'ы
   */
  resetAll() {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Экспортируем singleton фабрику
const factory = new CircuitBreakerFactory();

// Добавляем метод getBreaker для обратной совместимости
factory.getBreaker = factory.get;

module.exports = {
  CircuitBreaker,
  CircuitBreakerFactory: factory,
  getCircuitBreaker: (name, options) => factory.get(name, options)
};