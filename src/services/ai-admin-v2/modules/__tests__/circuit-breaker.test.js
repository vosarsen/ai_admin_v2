const { CircuitBreaker, circuitBreakerFactory } = require('../circuit-breaker');

describe('CircuitBreaker', () => {
  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      resetTimeout: 1000,
      timeout: 500
    });
  });

  describe('Basic functionality', () => {
    test('should execute successful operations in CLOSED state', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.state).toBe('CLOSED');
      expect(breaker.getStatus().stats.successfulRequests).toBe(1);
    });

    test('should count failures', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      try {
        await breaker.execute(failingOperation);
      } catch (e) {}

      expect(breaker.failureCount).toBe(1);
      expect(breaker.state).toBe('CLOSED');
    });

    test('should open circuit after failure threshold', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch (e) {}
      }

      expect(breaker.state).toBe('OPEN');
      expect(breaker.failureCount).toBe(3);
    });

    test('should reject requests when OPEN', async () => {
      // Force open
      breaker.forceOpen();

      await expect(breaker.execute(async () => 'success'))
        .rejects
        .toThrow('Circuit breaker is OPEN');

      expect(breaker.getStatus().stats.rejectedRequests).toBe(1);
    });
  });

  describe('State transitions', () => {
    test('should transition to HALF_OPEN after reset timeout', async () => {
      // Open the circuit
      breaker.forceOpen();
      breaker.nextAttemptTime = Date.now() - 1; // Set in the past

      // Try to execute - should move to HALF_OPEN
      try {
        await breaker.execute(async () => 'success');
      } catch (e) {}

      expect(breaker.state).toBe('CLOSED'); // Successful, so moves to CLOSED
    });

    test('should close circuit on success in HALF_OPEN', async () => {
      // Set to HALF_OPEN
      breaker.changeState('HALF_OPEN');

      await breaker.execute(async () => 'success');

      expect(breaker.state).toBe('CLOSED');
      expect(breaker.failureCount).toBe(0);
    });

    test('should reopen circuit on failure in HALF_OPEN', async () => {
      // Set to HALF_OPEN
      breaker.changeState('HALF_OPEN');

      try {
        await breaker.execute(async () => {
          throw new Error('Still failing');
        });
      } catch (e) {}

      expect(breaker.state).toBe('OPEN');
    });
  });

  describe('Timeout handling', () => {
    test('should timeout long operations', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 'success';
      };

      await expect(breaker.execute(slowOperation))
        .rejects
        .toThrow('Operation timeout');

      expect(breaker.getStatus().stats.timeouts).toBe(1);
    });
  });

  describe('State change listeners', () => {
    test('should notify listeners on state change', () => {
      const listener = jest.fn();
      breaker.onStateChange(listener);

      breaker.changeState('OPEN');

      expect(listener).toHaveBeenCalledWith('CLOSED', 'OPEN', breaker);
    });
  });

  describe('Statistics', () => {
    test('should track statistics correctly', async () => {
      // Success
      await breaker.execute(async () => 'success');

      // Failures
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch (e) {}
      }

      const stats = breaker.getStatus().stats;
      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(2);
    });
  });

  describe('Reset functionality', () => {
    test('should reset all counters', async () => {
      // Create some history
      await breaker.execute(async () => 'success');
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch (e) {}

      breaker.reset();

      expect(breaker.state).toBe('CLOSED');
      expect(breaker.failureCount).toBe(0);
      expect(breaker.successCount).toBe(0);
    });
  });
});

describe('CircuitBreakerFactory', () => {
  beforeEach(() => {
    // Clear any existing breakers
    circuitBreakerFactory.breakers.clear();
  });

  test('should create and return same breaker for same name', () => {
    const breaker1 = circuitBreakerFactory.getBreaker('service1');
    const breaker2 = circuitBreakerFactory.getBreaker('service1');

    expect(breaker1).toBe(breaker2);
  });

  test('should create different breakers for different names', () => {
    const breaker1 = circuitBreakerFactory.getBreaker('service1');
    const breaker2 = circuitBreakerFactory.getBreaker('service2');

    expect(breaker1).not.toBe(breaker2);
  });

  test('should get all breakers status', () => {
    circuitBreakerFactory.getBreaker('service1');
    circuitBreakerFactory.getBreaker('service2');

    const status = circuitBreakerFactory.getAllStatus();

    expect(status).toHaveProperty('service1');
    expect(status).toHaveProperty('service2');
  });

  test('should reset all breakers', () => {
    const breaker1 = circuitBreakerFactory.getBreaker('service1');
    const breaker2 = circuitBreakerFactory.getBreaker('service2');

    breaker1.forceOpen();
    breaker2.forceOpen();

    circuitBreakerFactory.resetAll();

    expect(breaker1.state).toBe('CLOSED');
    expect(breaker2.state).toBe('CLOSED');
  });

  test('should remove breaker', () => {
    circuitBreakerFactory.getBreaker('service1');
    
    expect(circuitBreakerFactory.removeBreaker('service1')).toBe(true);
    expect(circuitBreakerFactory.breakers.has('service1')).toBe(false);
  });
});