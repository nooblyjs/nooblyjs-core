# API Provider Testing Guide

This guide explains how to test the API providers for all NooblyJS Core services.

## Overview

All services in NooblyJS Core now support an `'api'` provider type that allows client applications to consume remote backend service APIs. This enables enterprise architectures with separated frontend and backend services.

## Available API Provider Tests

The following test files cover API provider functionality:

### Core Services
- **Caching**: `tests/unit/caching/cacheApi.test.js`
- **Data Service**: `tests/unit/dataservice/dataserviceApi.test.js`
- **Auth Service**: `tests/unit/authservice/authserviceApi.test.js`
- **Logging**: `tests/unit/logging/loggingApi.test.js`

### Additional Services
Tests for the following services can be created following the same pattern:
- Filing API Provider
- AI Service API Provider
- Measuring API Provider
- Notifying API Provider
- Queueing API Provider
- Searching API Provider
- Workflow API Provider
- Working API Provider

## Running API Provider Tests

```bash
# Run all tests
npm test

# Run specific API provider test
npm test -- cacheApi.test.js

# Run all API provider tests
npm test -- --testPathPattern="Api.test"

# Run with coverage
npm test -- --coverage
```

## Test Structure

Each API provider test follows this structure:

```javascript
const createService = require('../../../src/{service}');
const EventEmitter = require('events');
const nock = require('nock');

describe('{Service} API Provider', () => {
  let service;
  let mockEventEmitter;
  const apiRoot = 'http://backend.example.com';
  const apiKey = 'test-api-key-12345';

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    jest.spyOn(mockEventEmitter, 'emit');
    service = createService('api', {
      apiRoot,
      apiKey,
      timeout: 10000
    }, mockEventEmitter);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  // Test cases...
});
```

## Key Testing Concepts

### 1. HTTP Request Mocking with Nock

All API provider tests use [nock](https://github.com/nock/nock) to mock HTTP requests:

```javascript
nock(apiRoot)
  .get('/services/caching/api/get/testkey')
  .matchHeader('X-API-Key', apiKey)
  .reply(200, expectedValue);
```

### 2. API Key Verification

Tests ensure the API key is properly included in request headers:

```javascript
it('should include API key in request headers', async () => {
  const scope = nock(apiRoot)
    .matchHeader('X-API-Key', apiKey)
    .get('/services/caching/api/get/test')
    .reply(200, 'value');

  await cache.get('test');

  expect(scope.isDone()).toBe(true);
});
```

### 3. Event Emission Testing

Verify that proper events are emitted for operations:

```javascript
expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache:put', {
  key: 'testkey',
  value: 'testvalue',
});
```

### 4. Error Handling

Test proper error handling for API failures:

```javascript
it('should handle API errors properly', async () => {
  nock(apiRoot)
    .get('/services/caching/api/get/failkey')
    .reply(500, 'Internal Server Error');

  await expect(cache.get('failkey')).rejects.toThrow();

  expect(mockEventEmitter.emit).toHaveBeenCalledWith('cache:error',
    expect.objectContaining({
      operation: 'get',
      key: 'failkey'
    })
  );
});
```

### 5. URL Encoding

Test proper encoding of special characters:

```javascript
it('should properly encode keys with special characters', async () => {
  const specialKey = 'user:123/profile';
  const encodedKey = encodeURIComponent(specialKey);

  nock(apiRoot)
    .get(`/services/caching/api/get/${encodedKey}`)
    .reply(200, 'value');

  await cache.get(specialKey);
});
```

## Integration Testing

For full integration testing with a real backend:

### 1. Start Backend Server

```javascript
// backend-server.js
const express = require('express');
const serviceRegistry = require('noobly-core');

const app = express();
app.use(express.json());

serviceRegistry.initialize(app, {
  apiKeys: ['test-api-key'],
  requireApiKey: true
});

const cache = serviceRegistry.cache('redis', {
  host: 'localhost',
  port: 6379
});

app.listen(3000);
```

### 2. Run Integration Tests

```javascript
// integration.test.js
const createCache = require('../../src/caching');

describe('Cache API Integration', () => {
  let cache;

  beforeAll(() => {
    cache = createCache('api', {
      apiRoot: 'http://localhost:3000',
      apiKey: 'test-api-key'
    }, new EventEmitter());
  });

  it('should work with real backend', async () => {
    await cache.put('test-key', 'test-value');
    const value = await cache.get('test-key');
    expect(value).toBe('test-value');
  });
});
```

## Best Practices

### 1. Clean Up After Tests

Always clean up nock mocks after each test:

```javascript
afterEach(() => {
  nock.cleanAll();
});
```

### 2. Test All HTTP Methods

Ensure tests cover all HTTP methods used (GET, POST, PUT, DELETE):

```javascript
nock(apiRoot).get('/path').reply(200, data);
nock(apiRoot).post('/path', body).reply(201, response);
nock(apiRoot).put('/path', updates).reply(200, updated);
nock(apiRoot).delete('/path').reply(204);
```

### 3. Test Timeout Scenarios

Test timeout handling:

```javascript
it('should handle timeouts', async () => {
  nock(apiRoot)
    .get('/services/caching/api/get/slow')
    .delayConnection(6000) // Longer than timeout
    .reply(200, 'value');

  await expect(cache.get('slow')).rejects.toThrow('timeout');
});
```

### 4. Test Network Failures

Test network error scenarios:

```javascript
it('should handle network failures', async () => {
  nock(apiRoot)
    .get('/services/caching/api/get/fail')
    .replyWithError('Network failure');

  await expect(cache.get('fail')).rejects.toThrow();
});
```

## Example: Creating a New API Provider Test

To create a test for a service API provider:

1. **Create the test file**: `tests/unit/{service}/{service}Api.test.js`

2. **Set up the test structure**:

```javascript
const createService = require('../../../src/{service}');
const EventEmitter = require('events');
const nock = require('nock');

describe('{Service} API Provider', () => {
  let service;
  let mockEventEmitter;
  const apiRoot = 'http://backend.example.com';
  const apiKey = 'test-api-key-12345';

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    service = createService('api', { apiRoot, apiKey }, mockEventEmitter);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  // Add test cases for each service method
});
```

3. **Add test cases for each method**:

```javascript
it('should perform operation via API', async () => {
  nock(apiRoot)
    .post('/services/{service}/api/{endpoint}', requestData)
    .matchHeader('X-API-Key', apiKey)
    .reply(200, responseData);

  const result = await service.operation(params);

  expect(result).toEqual(expectedResult);
  expect(mockEventEmitter.emit).toHaveBeenCalled();
});
```

4. **Test error scenarios**:

```javascript
it('should handle errors', async () => {
  nock(apiRoot)
    .post('/services/{service}/api/{endpoint}')
    .reply(500, 'Error');

  await expect(service.operation(params)).rejects.toThrow();
});
```

## Continuous Integration

Add API provider tests to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --testPathPattern="Api.test"
```

## Debugging Tips

### 1. Enable Nock Debugging

```javascript
nock.recorder.rec({
  output_objects: true,
  enable_reqheaders_recording: true
});
```

### 2. Log HTTP Requests

```javascript
beforeEach(() => {
  nock.emitter.on('no match', (req) => {
    console.log('No nock match for:', req.path);
  });
});
```

### 3. Check Pending Mocks

```javascript
afterEach(() => {
  const pending = nock.pendingMocks();
  if (pending.length > 0) {
    console.log('Pending mocks:', pending);
  }
});
```

## Dependencies

API provider tests require:

- `jest` - Test framework
- `nock` - HTTP request mocking

Install if not already present:

```bash
npm install --save-dev jest nock
```

## Further Reading

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Nock Documentation](https://github.com/nock/nock)
- [NooblyJS Core API Documentation](../../docs/nooblyjs-core-usage-guide.md)
