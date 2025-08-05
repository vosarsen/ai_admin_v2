const logger = require('../../../utils/logger').child({ module: 'circuit-breaker' });
const config = require('../config/modules-config');
const prometheusMetrics = require('./prometheus-metrics');

/**
 * @typedef {'CLOSED' | 'OPEN' | 'HALF_OPEN'} CircuitState
 */

/**
 * @typedef {Object} CircuitBreakerOptions
 * @property {string} [name='unnamed'] - Circuit breaker name
 * @property {number} [failureThreshold=5] - Number of failures before opening
 * @property {number} [resetTimeout=60000] - Time in ms before trying half-open
 * @property {number} [monitoringPeriod=10000] - Monitoring window in ms
 * @property {number} [timeout=30000] - Request timeout in ms
 */

/**
 * @typedef {Object} CircuitBreakerStats
 * @property {number} totalRequests - Total requests count
 * @property {number} successfulRequests - Successful requests count
 * @property {number} failedRequests - Failed requests count
 * @property {number} rejectedRequests - Rejected requests count
 * @property {number} timeouts - Timeout count
 * @property {Array<StateChange>} stateChanges - State change history
 */

/**
 * @typedef {Object} StateChange
 * @property {CircuitState} from - Previous state
 * @property {CircuitState} to - New state
 * @property {Date} timestamp - When the change occurred
 * @property {number} failureCount - Failure count at time of change
 */

/**
 * @typedef {Object} CircuitBreakerStatus
 * @property {string} name - Circuit breaker name
 * @property {CircuitState} state - Current state
 * @property {number} failureCount - Current failure count
 * @property {number} successCount - Current success count
 * @property {number|null} lastFailureTime - Last failure timestamp
 * @property {number|null} nextAttemptTime - Next attempt timestamp
 * @property {CircuitBreakerStats} stats - Statistics
 */

/**
 * @callback StateChangeListener
 * @param {CircuitState} oldState - Previous state
 * @param {CircuitState} newState - New state
 * @param {CircuitBreaker} breaker - Circuit breaker instance
 * @returns {void}
 */

/**
 * Circuit Breaker implementation for fault tolerance
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold reached, requests are rejected
 * - HALF_OPEN: Testing if service recovered
 */
class CircuitBreaker {
  /**
   * @param {CircuitBreakerOptions} options - Configuration options
   */
  constructor(options = {}) {
    this.name = options.name || 'unnamed';
    this.failureThreshold = options.failureThreshold || config.circuitBreaker.defaultFailureThreshold;
    this.resetTimeout = options.resetTimeout || config.circuitBreaker.defaultResetTimeout;
    this.monitoringPeriod = options.monitoringPeriod || config.circuitBreaker.defaultMonitoringPeriod;
    this.timeout = options.timeout || config.circuitBreaker.defaultTimeout;
    
    // State management
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      timeouts: 0,
      stateChanges: []
    };
    
    // State change listeners
    this.listeners = [];
  }

  /**
   * Execute operation with circuit breaker protection
   * @template T
   * @param {() => Promise<T>} operation - Async function to execute
   * @returns {Promise<T>} Operation result
   * @throws {Error} When circuit is open or operation fails
   */
  async execute(operation) {
    this.stats.totalRequests++;
    
    // Check if circuit is OPEN
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        this.stats.rejectedRequests++;
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.code = 'CIRCUIT_BREAKER_OPEN';
        throw error;
      }
      
      // Time to try again - move to HALF_OPEN
      this.changeState('HALF_OPEN');
    }
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute operation with timeout
   * @private
   * @template T
   * @param {() => Promise<T>} operation - Operation to execute
   * @returns {Promise<T>} Operation result
   * @throws {Error} On timeout or operation failure
   */
  async executeWithTimeout(operation) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        this.stats.timeouts++;
        const error = new Error(`Operation timeout for ${this.name}`);
        error.code = 'TIMEOUT';
        reject(error);
      }, this.timeout);

      try {
        const result = await operation();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Handle successful operation
   * @private
   * @returns {void}
   */
  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    this.stats.successfulRequests++;
    
    if (this.state === 'HALF_OPEN') {
      // Service recovered - close the circuit
      this.changeState('CLOSED');
    }
  }

  /**
   * Handle failed operation
   * @private
   * @param {Error} error - The error that occurred
   * @returns {void}
   */
  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.stats.failedRequests++;
    
    logger.warn(`Circuit breaker ${this.name} failure`, {
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      error: error.message
    });
    
    // Отправляем метрику в Prometheus
    prometheusMetrics.recordCircuitBreakerFailure(this.name);
    
    if (this.state === 'HALF_OPEN') {
      // Still failing - reopen immediately
      this.changeState('OPEN');
    } else if (this.failureCount >= this.failureThreshold) {
      // Threshold reached - open the circuit
      this.changeState('OPEN');
    }
  }

  /**
   * Change circuit state
   * @param {CircuitState} newState - New state to set
   * @returns {void}
   */
  changeState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    logger.info(`Circuit breaker ${this.name} state change`, {
      from: oldState,
      to: newState
    });
    
    // Record state change
    this.stats.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: new Date(),
      failureCount: this.failureCount
    });
    
    // State-specific actions
    if (newState === 'OPEN') {
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      this.successCount = 0;
    } else if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.nextAttemptTime = null;
    }
    
    // Отправляем метрику состояния в Prometheus
    prometheusMetrics.updateCircuitBreakerState(this.name, newState);
    
    // Notify listeners
    this.notifyListeners(oldState, newState);
  }

  /**
   * Add state change listener
   * @param {StateChangeListener} listener - Listener function
   * @returns {void}
   */
  onStateChange(listener) {
    this.listeners.push(listener);
  }

  /**
   * Notify all listeners about state change
   * @private
   * @param {CircuitState} oldState - Previous state
   * @param {CircuitState} newState - New state
   * @returns {void}
   */
  notifyListeners(oldState, newState) {
    this.listeners.forEach(listener => {
      try {
        listener(oldState, newState, this);
      } catch (error) {
        logger.error('Error in circuit breaker listener', error);
      }
    });
  }

  /**
   * Get current status
   * @returns {CircuitBreakerStatus} Current status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      stats: { ...this.stats }
    };
  }

  /**
   * Reset circuit breaker
   * @returns {void}
   */
  reset() {
    this.changeState('CLOSED');
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Force open (for testing/maintenance)
   * @returns {void}
   */
  forceOpen() {
    this.changeState('OPEN');
  }

  /**
   * Force close (for testing/recovery)
   * @returns {void}
   */
  forceClose() {
    this.changeState('CLOSED');
  }
}

/**
 * Circuit breaker factory for managing multiple breakers
 */
class CircuitBreakerFactory {
  constructor() {
    /** @type {Map<string, CircuitBreaker>} */
    this.breakers = new Map();
  }

  /**
   * Get or create circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {CircuitBreakerOptions} [options={}] - Options for new breaker
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker({ name, ...options });
      this.breakers.set(name, breaker);
    }
    return this.breakers.get(name);
  }

  /**
   * Get all breakers status
   * @returns {Object<string, CircuitBreakerStatus>} Status map
   */
  getAllStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStatus();
    }
    return status;
  }

  /**
   * Reset all breakers
   * @returns {void}
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove circuit breaker
   * @param {string} name - Circuit breaker name
   * @returns {boolean} True if removed, false if not found
   */
  removeBreaker(name) {
    return this.breakers.delete(name);
  }
}

// Export singleton factory and class
module.exports = {
  CircuitBreaker,
  circuitBreakerFactory: new CircuitBreakerFactory()
};