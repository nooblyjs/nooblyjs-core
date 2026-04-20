# Circuit Breaker Integration Examples

This document provides practical examples of integrating circuit breakers into services.

## Table of Contents

1. [Basic Integration](#basic-integration)
2. [Database Service Integration](#database-service-integration)
3. [External API Integration](#external-api-integration)
4. [Service Registry Integration](#service-registry-integration)
5. [Monitoring Circuit Breakers](#monitoring-circuit-breakers)

## Basic Integration

### Simple Service with Circuit Breaker

```javascript
// src/myservice/providers/myservice.js

const { CircuitBreaker } = require('../../middleware/circuitBreaker');

class MyServiceProvider {
  constructor(options = {}) {
    this.logger = options.dependencies?.logging;
    
    // Create circuit breaker for external API calls
    this.apiBreaker = new CircuitBreaker(
      () => this.callExternalAPI(),
      {
        name: 'myservice-external-api',
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        logger: this.logger
      }
    );
  }

  /**
   * Fetches data from external API with circuit breaker protection
   */
  async fetchData() {
    try {
      // Call external API through circuit breaker
      const data = await this.apiBreaker.execute();
      
      this.logger?.info('[MyService] Data fetched successfully', {
        dataSize: JSON.stringify(data).length
      });
      
      return data;
    } catch (error) {
      if (error.message === 'CIRCUIT_BREAKER_OPEN') {
        // Service is failing, use fallback
        this.logger?.warn('[MyService] External API unavailable, using cached data', {
          error: error.message
        });
        return this.getCachedData();
      } else {
        // Other error
        this.logger?.error('[MyService] Failed to fetch data', {
          error: error.message
        });
        throw error;
      }
    }
  }

  /**
   * The actual external API call
   */
  async callExternalAPI() {
    // Simulated external API call
    const response = await fetch('https://api.example.com/data', {
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusCode}`);
    }
    
    return await response.json();
  }

  /**
   * Fallback data when external API is unavailable
   */
  getCachedData() {
    return {
      data: [],
      cached: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getStatus() {
    return {
      circuitBreaker: this.apiBreaker.getState()
    };
  }
}

module.exports = MyServiceProvider;
```

## Database Service Integration

### Protecting Database Connections

```javascript
// src/dataservice/index.js

const { CircuitBreaker, CircuitBreakerPool } = require('../middleware/circuitBreaker');

function createDataService(providerType, options = {}, eventEmitter) {
  const { dependencies = {} } = options;
  const logger = dependencies.logging;
  
  // Create circuit breaker pool for different database operations
  const breakerPool = new CircuitBreakerPool(logger);
  
  return {
    /**
     * Save data with circuit breaker protection
     */
    async save(container, object) {
      const breaker = breakerPool.create(
        `db-save-${container}`,
        async () => {
          // The actual database save operation
          const provider = this.getProvider(providerType);
          return await provider.saveObject(container, object);
        },
        {
          failureThreshold: 3,
          timeout: 30000
        }
      );
      
      try {
        return await breaker.execute();
      } catch (error) {
        if (error.message === 'CIRCUIT_BREAKER_OPEN') {
          logger?.error('[DataService] Database circuit breaker open', {
            container,
            operation: 'save'
          });
          throw new Error('Database service temporarily unavailable');
        }
        throw error;
      }
    },

    /**
     * Get data with circuit breaker protection
     */
    async get(container, id) {
      const breaker = breakerPool.create(
        `db-get-${container}`,
        async () => {
          const provider = this.getProvider(providerType);
          return await provider.getObject(container, id);
        },
        {
          failureThreshold: 5,
          timeout: 10000
        }
      );
      
      try {
        return await breaker.execute();
      } catch (error) {
        if (error.message === 'CIRCUIT_BREAKER_OPEN') {
          logger?.warn('[DataService] Database read circuit breaker open', {
            container,
            id
          });
          // Could return cached data or null
          return null;
        }
        throw error;
      }
    },

    /**
     * Get service status including circuit breaker states
     */
    getStatus() {
      return {
        type: providerType,
        circuitBreakers: breakerPool.getAllStates()
      };
    }
  };
}

module.exports = createDataService;
```

## External API Integration

### HTTP Client with Circuit Breaker

```javascript
// src/fetching/providers/fetchingNode.js

const { CircuitBreaker } = require('../../middleware/circuitBreaker');

class FetchingNodeProvider {
  constructor(options = {}) {
    this.logger = options.dependencies?.logging;
    
    // Create separate breakers for different API endpoints
    this.breakers = new Map();
  }

  /**
   * Fetch with automatic circuit breaker management per domain
   */
  async fetch(url, options = {}) {
    // Get or create circuit breaker for this domain
    const domain = new URL(url).hostname;
    let breaker = this.breakers.get(domain);
    
    if (!breaker) {
      breaker = new CircuitBreaker(
        () => this.doFetch(url, options),
        {
          name: `fetch-${domain}`,
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60000,
          logger: this.logger
        }
      );
      this.breakers.set(domain, breaker);
    }

    try {
      const response = await breaker.execute();
      
      this.logger?.info('[Fetching] Request successful', {
        url,
        status: response.status,
        domain
      });
      
      return response;
    } catch (error) {
      if (error.message === 'CIRCUIT_BREAKER_OPEN') {
        this.logger?.error('[Fetching] Circuit breaker open for domain', {
          domain,
          url,
          retryAfter: breaker.getState().nextAttemptTime
        });
        
        throw new Error(`API unavailable: ${domain}`);
      } else {
        this.logger?.error('[Fetching] Request failed', {
          url,
          error: error.message,
          domain
        });
        throw error;
      }
    }
  }

  /**
   * The actual fetch implementation
   */
  async doFetch(url, options) {
    const response = await fetch(url, {
      timeout: options.timeout || 10000,
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates() {
    const states = {};
    for (const [domain, breaker] of this.breakers) {
      states[domain] = breaker.getState();
    }
    return states;
  }

  /**
   * Reset a specific domain's circuit breaker
   */
  resetDomain(domain) {
    const breaker = this.breakers.get(domain);
    if (breaker) {
      breaker.reset();
      this.logger?.info('[Fetching] Circuit breaker reset', { domain });
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    this.logger?.info('[Fetching] All circuit breakers reset');
  }
}

module.exports = FetchingNodeProvider;
```

## Service Registry Integration

### Adding Circuit Breaker Status Endpoint

```javascript
// In index.js or app.js

const { CircuitBreakerPool } = require('./src/middleware/circuitBreaker');

// Create global circuit breaker pool
const globalCircuitBreakerPool = new CircuitBreakerPool(logger);

// Add circuit breaker status endpoint
app.get('/services/api/circuit-breakers', (req, res) => {
  try {
    const states = globalCircuitBreakerPool.getAllStates();
    
    res.json({
      circuitBreakers: states,
      summary: {
        totalBreakers: Object.keys(states).length,
        openCircuits: Object.values(states).filter(s => s.state === 'OPEN').length,
        halfOpenCircuits: Object.values(states).filter(s => s.state === 'HALF_OPEN').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add circuit breaker reset endpoint (protected)
app.post('/services/api/circuit-breakers/:name/reset', (req, res) => {
  try {
    const { name } = req.params;
    const breaker = globalCircuitBreakerPool.get(name);
    
    if (!breaker) {
      return res.status(404).json({ error: 'Circuit breaker not found' });
    }
    
    breaker.reset();
    res.json({ message: `Circuit breaker "${name}" reset`, state: breaker.getState() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Monitoring Circuit Breakers

### Dashboard Display

```javascript
// Create a dashboard endpoint to visualize circuit breaker status

app.get('/dashboard/circuit-breakers', (req, res) => {
  try {
    const states = globalCircuitBreakerPool.getAllStates();
    
    const html = `
      <html>
      <head>
        <title>Circuit Breaker Status</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .breaker { 
            border: 1px solid #ddd; 
            padding: 10px; 
            margin: 10px 0; 
            border-radius: 5px;
          }
          .closed { background-color: #d4edda; }
          .open { background-color: #f8d7da; }
          .half-open { background-color: #fff3cd; }
          .state { font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Circuit Breaker Status</h1>
        <p>Updated: ${new Date().toISOString()}</p>
        ${Object.entries(states).map(([name, state]) => `
          <div class="breaker ${state.state.toLowerCase()}">
            <h3>${name}</h3>
            <p class="state">State: ${state.state}</p>
            <p>Failures: ${state.failureCount}/${state.failureThreshold}</p>
            <p>Successes: ${state.successCount}/${state.successThreshold}</p>
            ${state.nextAttemptTime ? `<p>Retry at: ${new Date(state.nextAttemptTime).toISOString()}</p>` : ''}
          </div>
        `).join('')}
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});
```

### Alerting

```javascript
// Monitor circuit breakers and alert when too many are open

setInterval(() => {
  const states = globalCircuitBreakerPool.getAllStates();
  const openCircuits = Object.entries(states).filter(([_, state]) => state.state === 'OPEN');
  
  if (openCircuits.length > 0) {
    const openNames = openCircuits.map(([name]) => name);
    
    logger?.warn('Multiple circuit breakers are OPEN', {
      count: openCircuits.length,
      breakers: openNames,
      timestamp: new Date().toISOString()
    });
    
    // Send alert (email, Slack, PagerDuty, etc.)
    if (openCircuits.length >= 3) {
      sendAlert(`CRITICAL: ${openCircuits.length} circuit breakers open`);
    }
  }
}, 30000); // Check every 30 seconds
```

### Testing Circuit Breaker Behavior

```javascript
// tests/middleware/circuitBreaker.test.js

const { CircuitBreaker } = require('../../src/middleware/circuitBreaker');

describe('CircuitBreaker', () => {
  it('should open circuit after threshold failures', async () => {
    let failCount = 0;
    const breaker = new CircuitBreaker(
      async () => {
        if (failCount > 0) throw new Error('Service failed');
        return 'success';
      },
      { failureThreshold: 3, timeout: 100 }
    );

    // First request succeeds
    expect(await breaker.execute()).toBe('success');

    // Fail 3 times to open circuit
    failCount = 1;
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute();
      } catch (e) {
        // Expected
      }
    }

    // Circuit should be open now
    expect(breaker.getState().state).toBe('OPEN');

    // Next request should fail immediately
    try {
      await breaker.execute();
      fail('Should have thrown');
    } catch (error) {
      expect(error.message).toBe('CIRCUIT_BREAKER_OPEN');
    }
  });

  it('should recover from HALF_OPEN to CLOSED', async () => {
    const breaker = new CircuitBreaker(
      async () => 'success',
      { failureThreshold: 1, successThreshold: 1, timeout: 50 }
    );

    // Force open
    try {
      await breaker.execute();
    } catch (error) {
      // Make it fail once to open
    }
    // Actually force it
    breaker.state = 'OPEN';
    breaker.failureCount = 1;

    // Wait for timeout
    await new Promise(r => setTimeout(r, 100));

    // Execute - should transition to HALF_OPEN and succeed
    const result = await breaker.execute();
    expect(result).toBe('success');
    expect(breaker.getState().state).toBe('CLOSED');
  });
});
```

## Best Practices for Integration

1. **Create one breaker per external service/domain** - Don't share breakers
2. **Use appropriate thresholds** - Local services need lower thresholds than remote APIs
3. **Provide fallbacks** - Always have a fallback when circuit opens
4. **Monitor breaker states** - Alert when circuits open unexpectedly
5. **Test circuit breaker behavior** - Ensure your fallbacks work
6. **Log state transitions** - Track when circuits open/close for debugging
7. **Use consistent naming** - Make breaker names descriptive (`fetch-api.example.com`)
