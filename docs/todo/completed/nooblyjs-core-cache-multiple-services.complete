## Multiple services interface in Service Registry

# Feature
I would like to allow the nooblyjs core Service Registry to be able to manage multiple instances of the same service. This is going to be complex so I want to run this in phases and only with the caching service at first then we can move on to the other services.

# Implementation Plan

## Phase 1: Service Registry - Support Named Service Instances
- [x] Analyze current ServiceRegistry implementation to understand singleton pattern
- [x] Design data structure for storing multiple instances (e.g., Map with service:provider:name keys)
- [x] Update ServiceRegistry.getService() to support optional instance name parameter
- [x] Add ServiceRegistry.getServiceInstance(serviceName, providerType, instanceName) method
- [x] Maintain backward compatibility - default instance when name not provided
- [x] Add ServiceRegistry.listInstances(serviceName) method to list all instances
- [x] Add ServiceRegistry.resetService(serviceName) and resetServiceInstance() methods
- [x] Write 13 unit tests for new instance management functionality (all passing)

**Completion Details:**
- Service key format changed from `serviceName:providerType` to `serviceName:providerType:instanceName`
- Default instance name is 'default' for backward compatibility
- ServiceRegistry now includes:
  - `getService(serviceName, providerType, options)` - supports `options.instanceName`
  - `getServiceInstance(serviceName, providerType, instanceName)` - retrieve without creating
  - `listInstances(serviceName)` - list all instances of a service
  - `resetService(serviceName)` - clear all instances of a service
  - `resetServiceInstance(serviceName, providerType, instanceName)` - clear specific instance
- ServiceRegistry reference passed to services via `options.ServiceRegistry` for instance lookup

## Phase 2: Caching Service Routes - Support Instance Name Parameter
- [x] Add instance-aware routes supporting format `/services/caching/api/:instanceName/:operation/:key`
- [x] Implement getCacheInstance() helper function for instance resolution
- [x] All default routes maintain backward compatibility (e.g., `/services/caching/api/put/:key`)
- [x] New instance routes for PUT, GET, DELETE, list, analytics endpoints
- [x] ServiceRegistry reference passed to routes for instance lookup
- [x] Add comprehensive API tests for instance-specific endpoints

**Completion Details:**
- Routes support both default and instance-specific paths:
  - Default: `/services/caching/api/put/:key` (uses 'default' instance)
  - Instance: `/services/caching/api/:instanceName/put/:key` (uses named instance)
- Helper functions for all operations: createPutHandler, createGetHandler, createDeleteHandler, etc.
- Fallback to default instance if requested instance not found
- Provider type tracked for proper instance resolution
- All 9 main routes now have instance equivalents

## Phase 3: Caching Service Views - Instance Selection UI
- [x] Backend support for instance selection integrated into routes
- [ ] Update caching service dashboard HTML to fetch list of available instances
- [ ] Add dropdown/select component to switch between instances (future enhancement)
- [ ] Modify view handlers to use selected instance name in API calls (future enhancement)

**Current Status:** Route-level support complete. HTML UI enhancements pending development.

## Phase 4: Test Suite Updates
- [x] Updated unit tests in tests/unit/serviceRegistry.test.js (36 total: 13 new instance tests, 23 existing)
- [x] Added comprehensive API tests in tests/api/caching/caching.http for instance endpoints
- [ ] Update load tests to test multiple concurrent instances (future work)
- [ ] Update example applications to demonstrate instance usage (future work)
- [x] Verified backward compatibility - default routes unchanged
- [x] All 13 new instance management tests passing

**Test Coverage Added:**
- Instance creation with default and named instances
- Singleton behavior for same instance
- Instance retrieval via getServiceInstance()
- Listing all instances of a service
- Resetting specific and all instances
- Data isolation between instances
- Event emission for instance creation
- 40+ API test cases for instance-specific endpoints

# Usage Examples

## Creating Named Cache Instances

```javascript
const ServiceRegistry = require('./index');
const express = require('express');
const app = express();

ServiceRegistry.initialize(app, null, {});

// Default instance (backward compatible)
const defaultCache = ServiceRegistry.cache('memory');

// Named instances with isolation
const cache1 = ServiceRegistry.getService('caching', 'memory', { instanceName: 'sessions' });
const cache2 = ServiceRegistry.getService('caching', 'memory', { instanceName: 'metrics' });
const cache3 = ServiceRegistry.getService('caching', 'redis', { instanceName: 'distributed' });

// Data isolation
await cache1.put('user:123', { id: 123, name: 'Alice' });
await cache2.put('user:123', { requests: 1000, errors: 2 });

const user = await cache1.get('user:123');      // { id: 123, name: 'Alice' }
const metrics = await cache2.get('user:123');   // { requests: 1000, errors: 2 }
```

## Listing Instances

```javascript
// List all cache instances
const instances = ServiceRegistry.listInstances('caching');
console.log(instances);
// Output:
// [
//   { serviceName: 'caching', providerType: 'memory', instanceName: 'default', key: 'caching:memory:default' },
//   { serviceName: 'caching', providerType: 'memory', instanceName: 'sessions', key: 'caching:memory:sessions' },
//   { serviceName: 'caching', providerType: 'memory', instanceName: 'metrics', key: 'caching:memory:metrics' },
//   { serviceName: 'caching', providerType: 'redis', instanceName: 'distributed', key: 'caching:redis:distributed' }
// ]
```

## Resetting Instances

```javascript
// Reset specific instance
ServiceRegistry.resetServiceInstance('caching', 'memory', 'sessions');

// Reset all instances of a service
ServiceRegistry.resetService('caching');

// Reset all services
ServiceRegistry.reset();
```

## REST API Usage

### Default Instance (Backward Compatible)

```bash
# PUT - store in default cache
POST /services/caching/api/put/user-123
Content-Type: application/json

{ "id": 123, "name": "Alice" }

# GET - retrieve from default cache
GET /services/caching/api/get/user-123

# DELETE - remove from default cache
DELETE /services/caching/api/delete/user-123
```

### Named Instances

```bash
# PUT - store in 'sessions' instance
POST /services/caching/api/sessions/put/session-abc123
Content-Type: application/json

{ "userId": 123, "token": "abc123", "expiresAt": "2025-12-31" }

# GET - retrieve from 'sessions' instance
GET /services/caching/api/sessions/get/session-abc123

# DELETE - remove from 'sessions' instance
DELETE /services/caching/api/sessions/delete/session-abc123

# GET analytics for 'sessions' instance
GET /services/caching/api/sessions/analytics

# GET list for 'metrics' instance
GET /services/caching/api/metrics/list
```

## Instance Isolation Example

```javascript
// Two instances with same key, different values
const userCache = ServiceRegistry.getService('caching', 'memory', { instanceName: 'users' });
const configCache = ServiceRegistry.getService('caching', 'memory', { instanceName: 'config' });

await userCache.put('app-settings', { theme: 'dark', language: 'en' });
await configCache.put('app-settings', { version: '2.1.0', debug: true });

// Data is isolated
const userSettings = await userCache.get('app-settings');     // { theme: 'dark', language: 'en' }
const appConfig = await configCache.get('app-settings');      // { version: '2.1.0', debug: true }
```

# Future Enhancements

## For Phase 3 (UI Enhancement)
- Add instance dropdown selector to caching service dashboard
- Display current active instance in view header
- Allow switching between instances in the UI
- Show instance-specific metrics and statistics

## For Other Services
- Apply same multi-instance pattern to other services (dataservice, queueing, etc.)
- Implement instance-aware middleware for request routing
- Add centralized instance management dashboard

## Advanced Features
- Instance templates/presets
- Automatic instance replication
- Instance performance monitoring
- Dynamic instance creation/destruction based on load

