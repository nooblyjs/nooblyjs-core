# Error Handling & Resilience Guide

This guide explains the error handling strategy and resilience patterns used in Noobly JS Core.

## Table of Contents

1. [Overview](#overview)
2. [Error Response Format](#error-response-format)
3. [Circuit Breaker Pattern](#circuit-breaker-pattern)
4. [Service Error Handling](#service-error-handling)
5. [Debugging Failed Requests](#debugging-failed-requests)
6. [Best Practices](#best-practices)

## Overview

The application implements a comprehensive error handling strategy to:

- **Prevent cascading failures** - Circuit breakers stop requests to failing services
- **Provide safe error messages** - Production hides sensitive details, development shows full traces
- **Enable debugging** - Unique request IDs track errors through the system
- **Monitor failures** - All errors logged with structured metadata for analysis

### Error Handling Components

1. **Global Error Handler** (`src/middleware/errorHandler.js`)
   - Catches all unhandled errors from route handlers
   - Logs errors with structured metadata
   - Formats safe error responses

2. **Circuit Breaker** (`src/middleware/circuitBreaker.js`)
   - Prevents cascading failures to external services
   - Automatically recovers when services become healthy
   - Provides fast-fail behavior instead of timeouts

3. **Service Error Recovery**
   - Retry logic with exponential backoff
   - Fallback mechanisms when primary services fail
   - Graceful degradation of functionality

## Error Response Format

### Development Mode (NODE_ENV=development)

```json
{
  "error": {
    "message": "MongoDB connection failed: ECONNREFUSED 127.0.0.1:27017",
    "name": "MongoConnectionError",
    "stack": "Error: MongoDB connection failed...\n    at ...",
    "requestId": "req_1681234567890_abc123def",
    "code": "ECONNREFUSED",
    "timestamp": "2026-04-16T10:30:00.000Z"
  }
}
```

### Production Mode (NODE_ENV=production)

```json
{
  "error": {
    "message": "Service unavailable. Please try again later.",
    "requestId": "req_1681234567890_abc123def"
  }
}
```

**Key differences:**
- No stack traces (prevents information disclosure)
- Generic error message (prevents revealing system details)
- Safe, user-friendly language
- Request ID for support correlation

### HTTP Status Codes

The application uses standard HTTP status codes:

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Invalid input, validation failure |
| 401 | Unauthorized | Missing/invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Route or resource doesn't exist |
| 422 | Unprocessable Entity | Invalid data format |
| 500 | Internal Server Error | Unexpected error in handler |
| 503 | Service Unavailable | Circuit breaker open, database down |
| 504 | Gateway Timeout | Request timed out |

## Circuit Breaker Pattern

The circuit breaker prevents cascading failures by stopping requests to services that are already failing.

### States

```
┌─────────┐    Failures    ┌──────┐    Timeout    ┌──────────┐
│ CLOSED  │ ─ Exceeded ──→ │ OPEN │ ──────────→  │HALF_OPEN│
│ (OK)    │    Threshold   │(Stop)│              │(Testing)│
└─────────┘                └──────┘              └──────────┘
    ↑                                                  │
    │                                                  │
    └──────────── Success Threshold Reached ──────────┘
```

### State Descriptions

**CLOSED** (Normal Operation)
- All requests pass through to the service
- Failures counted and tracked
- Transitions to OPEN when failures exceed threshold

**OPEN** (Service Failing)
- Requests fail immediately without contacting service
- Prevents timeout delays and resource waste
- After timeout period, transitions to HALF_OPEN for recovery test

**HALF_OPEN** (Testing Recovery)
- Limited requests allowed to test if service recovered
- If requests succeed, transitions to CLOSED
- If requests fail, reopens circuit and increases timeout

### Using Circuit Breaker

```javascript
const { CircuitBreaker, CircuitBreakerPool } = require('./src/middleware/circuitBreaker');

// Create a circuit breaker for a specific operation
const breaker = new CircuitBreaker(
  async () => {
    return await externalDatabase.query('SELECT * FROM users');
  },
  {
    name: 'database-query',
    failureThreshold: 5,      // Open after 5 failures
    successThreshold: 2,      // Close after 2 successes in HALF_OPEN
    timeout: 60000,           // 60 seconds before retry
    logger: appLogger
  }
);

// Use the breaker
try {
  const result = await breaker.execute();
} catch (error) {
  if (error.message === 'CIRCUIT_BREAKER_OPEN') {
    // Service is failing, use fallback
    console.log('Database unavailable, using cached data');
  } else {
    // Other error, handle normally
    throw error;
  }
}

// Get breaker state
const state = breaker.getState();
console.log(`Circuit state: ${state.state}, Failures: ${state.failureCount}`);
```

### Circuit Breaker Pool

For managing multiple breakers across services:

```javascript
const pool = new CircuitBreakerPool(logger);

// Create breakers for different services
const mongoBreaker = pool.create(
  'mongodb',
  () => mongoDb.connect(),
  { failureThreshold: 3, timeout: 30000 }
);

const redisBreaker = pool.create(
  'redis',
  () => redisClient.ping(),
  { failureThreshold: 5, timeout: 60000 }
);

// Get all states
const allStates = pool.getAllStates();
Object.entries(allStates).forEach(([name, state]) => {
  console.log(`${name}: ${state.state}`);
});

// Reset all breakers
pool.resetAll();
```

### Configuration Recommendations

**For Local Services (Redis, MongoDB):**
```javascript
{
  failureThreshold: 3,      // Fail fast for local issues
  successThreshold: 1,      // Need only 1 success to recover
  timeout: 10000            // 10 seconds
}
```

**For Remote APIs:**
```javascript
{
  failureThreshold: 5,      // Allow more transient failures
  successThreshold: 2,      // Require stability before closing
  timeout: 60000            // 60 seconds (cloud services have longer recovery)
}
```

**For Critical Services:**
```javascript
{
  failureThreshold: 2,      // Very sensitive to failures
  successThreshold: 1,      // Quick recovery
  timeout: 30000            // 30 seconds
}
```

## Service Error Handling

### Database Service Errors

```javascript
try {
  const result = await dataService.query({ ... });
} catch (error) {
  if (error.message.includes('ECONNREFUSED')) {
    // Database is not running
    logger?.warn('Database connection failed, using fallback', {
      error: error.message
    });
    return cachedData;
  } else if (error.message.includes('timeout')) {
    // Query is too slow
    logger?.error('Database query timeout', {
      query: queryObject,
      timeout: 5000
    });
    return null;
  } else {
    // Other errors
    logger?.error('Database error', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
```

### External API Errors

```javascript
const breaker = new CircuitBreaker(
  () => externalAPI.fetch(url),
  { name: 'external-api', failureThreshold: 3 }
);

try {
  const result = await breaker.execute();
} catch (error) {
  if (error.message === 'CIRCUIT_BREAKER_OPEN') {
    logger?.warn('External API circuit breaker open', {
      api: 'external-api',
      fallbackUsed: true
    });
    return defaultResponse;
  } else {
    logger?.error('API call failed', {
      error: error.message,
      url
    });
    throw error;
  }
}
```

### Cascading Failure Prevention

**Problem**: When one service fails, its clients retry, which causes those services to fail, etc.

**Solution**: Use circuit breakers + exponential backoff

```javascript
async function callWithRetry(fn, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Exponential backoff: 100ms, 200ms, 400ms, etc.
      const delayMs = 100 * Math.pow(2, attempt - 1);
      
      logger?.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error: error.message,
        attempt,
        maxRetries
      });
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

// Use with circuit breaker
const breaker = new CircuitBreaker(
  () => callWithRetry(apiCall),
  { name: 'api-with-retry' }
);
```

## Debugging Failed Requests

### Finding Errors by Request ID

When a user reports an error, they can provide the request ID:

```bash
# Find all errors for this request
grep "req_1681234567890_abc123def" ./.application/logs/*.log

# Or with jq if using JSON logging
cat ./.application/logs/*.log | jq 'select(.requestId == "req_1681234567890_abc123def")'
```

### Common Error Patterns

**Database Connection Failure**
```
Error: MongoDB connection failed: ECONNREFUSED 127.0.0.1:27017
Status: 503 Service Unavailable
Action: Check database is running and accessible
```

**API Authentication Failure**
```
Error: Unauthorized
Status: 401 Unauthorized  
Action: Verify API key is correct and not expired
```

**Circuit Breaker Open**
```
Error: CIRCUIT_BREAKER_OPEN
Status: 503 Service Unavailable
Action: Wait for automatic recovery or check underlying service
```

**Timeout**
```
Error: timeout / ETIMEDOUT
Status: 504 Gateway Timeout
Action: Check service performance, increase timeout, or reduce load
```

### Enable Debug Logging

In development, enable verbose logging:

```bash
# Show all logs
LOG_LEVEL=debug node app.js

# Or in .env file
LOG_LEVEL=debug
NODE_ENV=development
```

## Best Practices

### 1. Always Use Circuit Breakers for External Services

```javascript
// ✅ GOOD: Protected with circuit breaker
const dbBreaker = new CircuitBreaker(dbQuery, { name: 'database' });
const result = await dbBreaker.execute();

// ❌ BAD: Unprotected, can cascade failures
const result = await dbQuery();
```

### 2. Log Errors with Context

```javascript
// ✅ GOOD: Provides debugging context
logger?.error('User creation failed', {
  userId: user.id,
  email: user.email,
  error: error.message,
  attempted: true
});

// ❌ BAD: Insufficient context
logger?.error('Error');
```

### 3. Provide Safe Error Messages

```javascript
// ✅ GOOD: User-friendly message, safe for production
throw new Error('Failed to save user. Please try again.');

// ❌ BAD: Exposes system details
throw new Error(`MongoDB connection failed: ${connectionString}`);
```

### 4. Implement Fallbacks

```javascript
// ✅ GOOD: Graceful degradation
try {
  return await freshData();
} catch (error) {
  logger?.warn('Fresh data unavailable, using cache', { error: error.message });
  return await cachedData();
}

// ❌ BAD: Complete failure
const data = await freshData(); // Throws if fails
```

### 5. Monitor Error Rates

```javascript
// Track error rate by endpoint
const errorCounts = {};

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    if (data.error) {
      errorCounts[req.path] = (errorCounts[req.path] || 0) + 1;
      
      // Alert if error rate exceeds threshold
      if (errorCounts[req.path] > 10) {
        logger?.error('High error rate detected', {
          path: req.path,
          errorCount: errorCounts[req.path]
        });
      }
    }
    return originalJson.call(this, data);
  };
  next();
});
```

### 6. Handle Specific Error Types

```javascript
// ✅ GOOD: Handle different error scenarios
try {
  await operation();
} catch (error) {
  if (error.message.includes('timeout')) {
    // Timeout - retry with backoff
    return await retryWithBackoff();
  } else if (error.message.includes('ECONNREFUSED')) {
    // Service down - use circuit breaker
    throw error;
  } else if (error.code === 'VALIDATION_ERROR') {
    // Bad input - return 400
    res.status(400).json({ error: error.message });
  } else {
    // Unknown - return 500
    throw error;
  }
}
```

### 7. Graceful Shutdown

Ensure services clean up properly:

```javascript
async function gracefulShutdown(signal) {
  logger?.info(`${signal} received, shutting down...`);
  
  try {
    // Stop accepting new requests
    server.close();
    
    // Close database connections
    await database.close();
    
    // Flush pending logs
    await logger?.flush();
    
    process.exit(0);
  } catch (error) {
    logger?.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

## See Also

- [Production Setup Guide](./PRODUCTION_SETUP.md) - Security and configuration best practices
- [Performance Monitoring](./PERFORMANCE_MONITORING.md) - Track and optimize performance
- [CLAUDE.md](../CLAUDE.md) - Architecture and service structure
