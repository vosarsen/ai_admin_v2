/**
 * Async Error Boundary
 * Provides safe execution of async operations with proper error handling
 */

const logger = require('./logger');

class AsyncErrorBoundary {
  /**
   * Execute async function with error boundary
   * @param {Function} asyncFn - Async function to execute
   * @param {Object} options - Execution options
   * @param {string} options.context - Context for logging
   * @param {any} options.fallbackValue - Value to return on error
   * @param {number} options.retries - Number of retries on failure
   * @param {number} options.retryDelay - Delay between retries in ms
   * @param {Function} options.onError - Custom error handler
   * @param {number} options.timeout - Operation timeout in ms
   * @returns {Promise<any>}
   */
  static async execute(asyncFn, options = {}) {
    const {
      context = 'async-operation',
      fallbackValue = null,
      retries = 0,
      retryDelay = 1000,
      onError = null,
      timeout = null,
    } = options;

    let lastError = null;
    let attempts = 0;

    while (attempts <= retries) {
      try {
        // Create promise with timeout if specified
        let promise = asyncFn();

        if (timeout) {
          promise = this.withTimeout(promise, timeout, context);
        }

        const result = await promise;

        // Log success after retries
        if (attempts > 0) {
          logger.info(`[${context}] Succeeded after ${attempts} retries`);
        }

        return result;
      } catch (error) {
        lastError = error;
        attempts++;

        // Log error
        logger.error(`[${context}] Error (attempt ${attempts}/${retries + 1}):`, error.message);

        // Call custom error handler if provided
        if (onError) {
          try {
            await onError(error, attempts);
          } catch (handlerError) {
            logger.error(`[${context}] Error in error handler:`, handlerError.message);
          }
        }

        // Check if should retry
        if (attempts <= retries) {
          logger.debug(`[${context}] Retrying in ${retryDelay}ms...`);
          await this.sleep(retryDelay * attempts); // Exponential backoff
        }
      }
    }

    // All attempts failed
    logger.error(`[${context}] All ${attempts} attempts failed. Returning fallback value.`);
    return fallbackValue;
  }

  /**
   * Execute multiple async operations in parallel with error boundaries
   * @param {Array<Function>} asyncFns - Array of async functions
   * @param {Object} options - Execution options
   * @returns {Promise<Array>} Results array (null for failed operations)
   */
  static async executeParallel(asyncFns, options = {}) {
    const {
      context = 'parallel-operations',
      continueOnError = true,
      timeout = null,
    } = options;

    if (!continueOnError) {
      // Use Promise.all - fail fast
      return Promise.all(asyncFns.map(fn =>
        this.execute(fn, { ...options, context: `${context}[${asyncFns.indexOf(fn)}]` })
      ));
    }

    // Use Promise.allSettled - continue on error
    const results = await Promise.allSettled(asyncFns.map(fn =>
      this.execute(fn, { ...options, context: `${context}[${asyncFns.indexOf(fn)}]` })
    ));

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.error(`[${context}[${index}]] Failed:`, result.reason);
        return null;
      }
    });
  }

  /**
   * Execute async operation with timeout
   * @param {Promise} promise - Promise to timeout
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} context - Context for error message
   * @returns {Promise}
   */
  static withTimeout(promise, timeoutMs, context = 'operation') {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`[${context}] Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a safe wrapper for an async function
   * @param {Function} asyncFn - Async function to wrap
   * @param {Object} defaultOptions - Default options for execution
   * @returns {Function} Wrapped function
   */
  static wrap(asyncFn, defaultOptions = {}) {
    return async (...args) => {
      return this.execute(
        () => asyncFn(...args),
        defaultOptions
      );
    };
  }

  /**
   * Create a circuit breaker for an async function
   * @param {Function} asyncFn - Async function to protect
   * @param {Object} options - Circuit breaker options
   * @returns {Function} Protected function
   */
  static createCircuitBreaker(asyncFn, options = {}) {
    const {
      threshold = 5,
      cooldown = 60000,
      halfOpenRequests = 3,
    } = options;

    let failures = 0;
    let lastFailureTime = 0;
    let state = 'closed'; // closed, open, half-open
    let halfOpenAttempts = 0;

    return async (...args) => {
      const now = Date.now();

      // Check if circuit is open
      if (state === 'open') {
        if (now - lastFailureTime < cooldown) {
          throw new Error('Circuit breaker is OPEN. Service unavailable.');
        }
        // Try half-open state
        state = 'half-open';
        halfOpenAttempts = 0;
      }

      // Execute function
      try {
        const result = await asyncFn(...args);

        // Reset on success
        if (state === 'half-open') {
          halfOpenAttempts++;
          if (halfOpenAttempts >= halfOpenRequests) {
            state = 'closed';
            failures = 0;
            logger.info('Circuit breaker is now CLOSED (recovered)');
          }
        } else if (state === 'closed') {
          failures = 0; // Reset failure count on success
        }

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (state === 'half-open' || failures >= threshold) {
          state = 'open';
          logger.error(`Circuit breaker is now OPEN (failures: ${failures})`);
        }

        throw error;
      }
    };
  }

  /**
   * Batch async operations with rate limiting
   * @param {Array} items - Items to process
   * @param {Function} asyncFn - Async function to process each item
   * @param {Object} options - Batching options
   * @returns {Promise<Array>} Results array
   */
  static async executeBatch(items, asyncFn, options = {}) {
    const {
      batchSize = 10,
      delayBetweenBatches = 1000,
      context = 'batch-operation',
    } = options;

    const results = [];
    const batches = [];

    // Create batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // Process batches
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.debug(`[${context}] Processing batch ${i + 1}/${batches.length}`);

      const batchResults = await this.executeParallel(
        batch.map(item => () => asyncFn(item)),
        { ...options, context: `${context}-batch-${i}` }
      );

      results.push(...batchResults);

      // Delay between batches (except for last batch)
      if (i < batches.length - 1 && delayBetweenBatches > 0) {
        await this.sleep(delayBetweenBatches);
      }
    }

    return results;
  }

  /**
   * Retry with exponential backoff
   * @param {Function} asyncFn - Async function to retry
   * @param {Object} options - Retry options
   * @returns {Promise}
   */
  static async retryWithBackoff(asyncFn, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      multiplier = 2,
      context = 'retry-operation',
    } = options;

    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await asyncFn();
      } catch (error) {
        if (attempt === maxRetries) {
          logger.error(`[${context}] All ${maxRetries} attempts failed`);
          throw error;
        }

        logger.warn(`[${context}] Attempt ${attempt} failed. Retrying in ${delay}ms...`);
        await this.sleep(delay);

        // Calculate next delay with exponential backoff
        delay = Math.min(delay * multiplier, maxDelay);
      }
    }
  }
}

module.exports = AsyncErrorBoundary;