/**
 * @fileoverview Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping calls to failing external services
 *
 * States:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Service failing, requests fail immediately
 * - HALF_OPEN: Limited requests allowed to test recovery
 *
 * @author Noobly JS Team
 * @version 1.0.0
 */

'use strict';

/**
 * @class CircuitBreaker
 * @description Implements the circuit breaker pattern for fault tolerance
 * @example
 * const breaker = new CircuitBreaker(async () => externalService.call(), {
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000
 * });
 *
 * try {
 *   const result = await breaker.execute();
 * } catch (error) {
 *   if (error.message === 'CIRCUIT_BREAKER_OPEN') {
 *     // Service unavailable, use fallback
 *   }
 * }
 */
class CircuitBreaker {
  /**
   * Creates a new CircuitBreaker instance
   *
   * @param {Function} fn - The async function to wrap with circuit breaker
   * @param {Object} options - Configuration options
   * @param {number} [options.failureThreshold=5] - Failures before circuit opens
   * @param {number} [options.successThreshold=2] - Successes in half-open state to close
   * @param {number} [options.timeout=60000] - Time before half-open attempt (milliseconds)
   * @param {Object} [options.logger] - Logger instance (optional)
   * @param {string} [options.name] - Circuit breaker name for logging
   */
  constructor(fn, options = {}) {
    this.fn = fn;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 1 minute
    this.logger = options.logger;
    this.name = options.name || 'CircuitBreaker';

    // State management
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Executes the wrapped function with circuit breaker protection
   *
   * @return {Promise<any>} Result from the wrapped function
   * @throws {Error} Throws CIRCUIT_BREAKER_OPEN when circuit is open
   * @throws {Error} Throws the original error from fn if it fails
   *
   * @example
   * try {
   *   const result = await breaker.execute();
   * } catch (error) {
   *   if (error.message === 'CIRCUIT_BREAKER_OPEN') {
   *     // Handle open circuit
   *   } else {
   *     // Handle execution error
   *   }
   * }
   */
  async execute() {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        const error = new Error('CIRCUIT_BREAKER_OPEN');
        error.state = 'OPEN';
        error.failureCount = this.failureCount;
        this.logger?.warn(`[${this.name}] Circuit breaker is OPEN, request rejected`, {
          state: this.state,
          failureCount: this.failureCount,
          retryAfter: Math.ceil((this.nextAttemptTime - Date.now()) / 1000)
        });
        throw error;
      }

      // Transition to HALF_OPEN to test recovery
      this.state = 'HALF_OPEN';
      this.successCount = 0;
      this.logger?.info(`[${this.name}] Circuit breaker transitioned to HALF_OPEN, testing recovery`, {
        state: this.state
      });
    }

    // Execute the wrapped function
    try {
      const result = await this.fn();

      // Handle success
      this.onSuccess();
      return result;
    } catch (error) {
      // Handle failure
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Called when the wrapped function succeeds
   * @private
   */
  onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount += 1;

      if (this.successCount >= this.successThreshold) {
        // Successfully recovered, close the circuit
        this.state = 'CLOSED';
        this.successCount = 0;
        this.logger?.info(`[${this.name}] Circuit breaker CLOSED - service recovered`, {
          state: this.state,
          successCount: this.successCount
        });
      } else {
        this.logger?.debug(`[${this.name}] Circuit breaker HALF_OPEN - recovery in progress`, {
          state: this.state,
          successCount: this.successCount,
          successThreshold: this.successThreshold
        });
      }
    }
  }

  /**
   * Called when the wrapped function fails
   * @private
   * @param {Error} error - The error that occurred
   */
  onFailure(error) {
    this.lastFailureTime = Date.now();
    this.failureCount += 1;

    if (this.state === 'CLOSED') {
      this.logger?.warn(`[${this.name}] Service failure detected`, {
        state: this.state,
        failureCount: this.failureCount,
        failureThreshold: this.failureThreshold,
        error: error.message
      });

      if (this.failureCount >= this.failureThreshold) {
        // Open the circuit after threshold reached
        this.state = 'OPEN';
        this.nextAttemptTime = Date.now() + this.timeout;
        this.logger?.error(`[${this.name}] Circuit breaker OPENED - stopping requests`, {
          state: this.state,
          failureCount: this.failureCount,
          retryAfterMs: this.timeout,
          error: error.message
        });
      }
    } else if (this.state === 'HALF_OPEN') {
      // Failed during recovery, reopen the circuit
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.timeout;
      this.successCount = 0;
      this.logger?.error(`[${this.name}] Circuit breaker REOPENED - recovery failed`, {
        state: this.state,
        failureCount: this.failureCount,
        retryAfterMs: this.timeout,
        error: error.message
      });
    }
  }

  /**
   * Gets the current state of the circuit breaker
   *
   * @return {Object} Circuit breaker state information
   *
   * @example
   * const state = breaker.getState();
   * console.log(`State: ${state.state}, Failures: ${state.failureCount}`);
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureThreshold: this.failureThreshold,
      successThreshold: this.successThreshold,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.state === 'OPEN' ? this.nextAttemptTime : null
    };
  }

  /**
   * Resets the circuit breaker to CLOSED state
   * Useful for testing or manual recovery
   *
   * @example
   * breaker.reset();
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.logger?.info(`[${this.name}] Circuit breaker manually reset`, {
      state: this.state
    });
  }
}

/**
 * CircuitBreakerPool - Manages multiple circuit breakers for different services
 *
 * @class CircuitBreakerPool
 * @description Centralized management of multiple circuit breakers
 *
 * @example
 * const pool = new CircuitBreakerPool();
 *
 * const mongoBreaker = pool.create('mongodb', mongoDbConnection, {
 *   failureThreshold: 3,
 *   timeout: 30000
 * });
 *
 * try {
 *   await mongoBreaker.execute();
 * } catch (error) {
 *   if (error.message === 'CIRCUIT_BREAKER_OPEN') {
 *     // Use fallback
 *   }
 * }
 */
class CircuitBreakerPool {
  constructor(logger) {
    this.breakers = new Map();
    this.logger = logger;
  }

  /**
   * Creates or retrieves a circuit breaker
   *
   * @param {string} name - Unique name for this circuit breaker
   * @param {Function} fn - Async function to wrap
   * @param {Object} [options] - Circuit breaker configuration
   * @return {CircuitBreaker} The circuit breaker instance
   *
   * @example
   * const breaker = pool.create('api-call', () => externalAPI.fetch());
   */
  create(name, fn, options = {}) {
    if (this.breakers.has(name)) {
      return this.breakers.get(name);
    }

    const breaker = new CircuitBreaker(fn, {
      ...options,
      logger: this.logger,
      name
    });

    this.breakers.set(name, breaker);
    return breaker;
  }

  /**
   * Gets an existing circuit breaker by name
   *
   * @param {string} name - The circuit breaker name
   * @return {CircuitBreaker|undefined} The circuit breaker or undefined if not found
   */
  get(name) {
    return this.breakers.get(name);
  }

  /**
   * Gets all circuit breaker states
   *
   * @return {Object} Map of breaker names to their states
   *
   * @example
   * const states = pool.getAllStates();
   * Object.entries(states).forEach(([name, state]) => {
   *   console.log(`${name}: ${state.state}`);
   * });
   */
  getAllStates() {
    const states = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.getState();
    }
    return states;
  }

  /**
   * Resets all circuit breakers
   *
   * @example
   * pool.resetAll();
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    this.logger?.info('All circuit breakers reset');
  }
}

module.exports = {
  CircuitBreaker,
  CircuitBreakerPool
};
