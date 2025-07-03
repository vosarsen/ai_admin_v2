// src/utils/circuit-breaker.js
const logger = require('./logger');

/**
 * Circuit Breaker implementation for fault tolerance
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.timeout = options.timeout || 10000; // 10 seconds
    this.errorThreshold = options.errorThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    // State management
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    
    // Monitoring
    this.callCount = 0;
    this.errorCount = 0;
    this.lastResetTime = Date.now();
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn) {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }
      
      // Try half-open
      this.state = 'HALF_OPEN';
      logger.info(`Circuit breaker ${this.name} attempting half-open`);
    }
    
    this.callCount++;
    
    try {
      // Execute with timeout
      logger.debug(`Circuit breaker ${this.name} executing function`);
      const result = await this._executeWithTimeout(fn);
      
      // Success handling
      logger.debug(`Circuit breaker ${this.name} execution successful`);
      this._onSuccess();
      return result;
    } catch (error) {
      // Failure handling
      logger.error(`Circuit breaker ${this.name} execution failed:`, {
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorString: String(error),
        errorMessage: error?.message,
        errorCode: error?.code,
        isNull: error === null,
        isUndefined: error === undefined
      });
      
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  async _executeWithTimeout(fn) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Circuit breaker timeout for ${this.name}`));
      }, this.timeout);
      
      try {
        const result = await fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Handle successful execution
   */
  _onSuccess() {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      
      // Need multiple successes to fully close
      if (this.successes >= 3) {
        this.state = 'CLOSED';
        this.successes = 0;
        logger.info(`Circuit breaker ${this.name} is now CLOSED`);
      }
    }
  }

  /**
   * Handle failed execution
   */
  _onFailure(error) {
    this.failures++;
    this.errorCount++;
    this.lastFailureTime = Date.now();
    
    logger.error(`Circuit breaker ${this.name} failure:`, {
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorString: String(error),
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack,
      errorResponse: error?.response?.data,
      errorStatus: error?.response?.status,
      isNull: error === null,
      isUndefined: error === undefined,
      hasOwnProperties: error ? Object.getOwnPropertyNames(error) : 'N/A',
      failures: this.failures,
      state: this.state
    });
    
    if (this.state === 'HALF_OPEN') {
      // Immediately open on half-open failure
      this._open();
    } else if (this.failures >= this.errorThreshold) {
      // Open circuit after threshold
      this._open();
    }
  }

  /**
   * Open the circuit
   */
  _open() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.resetTimeout;
    this.successes = 0;
    
    logger.warn(`Circuit breaker ${this.name} is now OPEN. Next attempt at ${new Date(this.nextAttempt).toISOString()}`);
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    const now = Date.now();
    const monitoringDuration = now - this.lastResetTime;
    
    // Reset counters if monitoring period passed
    if (monitoringDuration > this.monitoringPeriod) {
      this.callCount = 0;
      this.errorCount = 0;
      this.lastResetTime = now;
    }
    
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      callCount: this.callCount,
      errorCount: this.errorCount,
      errorRate: this.callCount > 0 ? (this.errorCount / this.callCount) : 0,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.state === 'OPEN' ? this.nextAttempt : null
    };
  }

  /**
   * Force reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    
    logger.info(`Circuit breaker ${this.name} has been reset`);
  }
}

/**
 * Circuit breaker factory
 */
class CircuitBreakerFactory {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create circuit breaker
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name);
  }

  /**
   * Get all circuit breakers status
   */
  getAllStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStatus();
    }
    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Export singleton factory
module.exports = new CircuitBreakerFactory();