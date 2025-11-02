## Multiple services interface in Service Registry

# Feature
I would like to leverage the multiple instances of the same service for the queueing service.

# Implementation Plan

## Phase 1: Service Registry - Support Named Service Instances
- [ ] Analyze current ServiceRegistry implementation to understand singleton pattern
- [ ] Design data structure for storing multiple instances (e.g., Map with service:provider:name keys)
- [ ] Update ServiceRegistry.getService() to support optional instance name parameter
- [ ] Add ServiceRegistry.getServiceInstance(serviceName, providerType, instanceName) method
- [ ] Maintain backward compatibility - default instance when name not provided
- [ ] Add ServiceRegistry.listInstances(serviceName) method to list all instances
- [ ] Add ServiceRegistry.resetService(serviceName) and resetServiceInstance() methods
- [ ] Write 13 unit tests for new instance management functionality (all passing)

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

## Phase 2: Queueing Service Routes - Support Instance Name Parameter
- [ ] Add instance-aware routes supporting format `/services/Queueing /api/:instanceName/:operation/:key`
- [ ] Implement getQueueInstance() helper function for instance resolution
- [ ] All default routes maintain backward compatibility (e.g., `/services/Queueing /api/put/:key`)
- [ ] New instance routes for PUT, GET, DELETE, list, analytics endpoints
- [ ] ServiceRegistry reference passed to routes for instance lookup
- [ ] Add comprehensive API tests for instance-specific endpoints

**Completion Details:**
- Routes support both default and instance-specific paths:
  - Default: `/services/Queueing /api/put/:key` (uses 'default' instance)
  - Instance: `/services/Queueing /api/:instanceName/put/:key` (uses named instance)
- Helper functions for all operations: createPutHandler, createGetHandler, createDeleteHandler, etc.
- Fallback to default instance if requested instance not found
- Provider type tracked for proper instance resolution
- All 9 main routes now have instance equivalents

## Phase 3: Queueing Service Views - Instance Selection UI
- [ ] Backend support for instance selection integrated into routes
- [ ] Update Queueing Service dashboard HTML to fetch list of available instances
- [ ] Add dropdown/select component to switch between instances (future enhancement)
- [ ] Modify view handlers to use selected instance name in API calls (future enhancement)

**Current Status:** Route-level support complete. HTML UI enhancements pending development.

## Phase 4: Test Suite Updates
- [ ] Updated unit tests in tests/unit/serviceRegistry.test.js (36 total: 13 new instance tests, 23 existing)
- [ ] Added comprehensive API tests in tests/api/Queueing /Queueing .http for instance endpoints
- [ ] Update load tests to test multiple concurrent instances (future work)
- [ ] Update example applications to demonstrate instance usage (future work)
- [ ] Verified backward compatibility - default routes unchanged
- [ ] All 13 new instance management tests passing

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

## Creating Named Queue Instances

```javascript
const ServiceRegistry = require('./index');
const express = require('express');
const app = express();

ServiceRegistry.initialize(app, null, {});

// Default instance (backward compatible)
const defaultQueue = ServiceRegistry.Queue('memory');

// Named instances with isolation
const Queue1 = ServiceRegistry.getService('Queueing ', 'memory', { instanceName: 'sessions' });
const Queue2 = ServiceRegistry.getService('Queueing ', 'memory', { instanceName: 'metrics' });
const Queue3 = ServiceRegistry.getService('Queueing ', 'redis', { instanceName: 'distributed' });

// Data isolation
await Queue1.put('user:123', { id: 123, name: 'Alice' });
await Queue2.put('user:123', { requests: 1000, errors: 2 });

const user = await Queue1.get('user:123');      // { id: 123, name: 'Alice' }
const metrics = await Queue2.get('user:123');   // { requests: 1000, errors: 2 }
```

## Listing Instances

```javascript
// List all Queue instances
const instances = ServiceRegistry.listInstances('Queueing ');
console.log(instances);
// Output:
// [
//   { serviceName: 'Queueing ', providerType: 'memory', instanceName: 'default', key: 'Queueing :memory:default' },
//   { serviceName: 'Queueing ', providerType: 'memory', instanceName: 'sessions', key: 'Queueing :memory:sessions' },
//   { serviceName: 'Queueing ', providerType: 'memory', instanceName: 'metrics', key: 'Queueing :memory:metrics' },
//   { serviceName: 'Queueing ', providerType: 'redis', instanceName: 'distributed', key: 'Queueing :redis:distributed' }
// ]
```

## Resetting Instances

```javascript
// Reset specific instance
ServiceRegistry.resetServiceInstance('Queueing ', 'memory', 'sessions');

// Reset all instances of a service
ServiceRegistry.resetService('Queueing ');

// Reset all services
ServiceRegistry.reset();
```

## REST API Usage

### Default Instance (Backward Compatible)

```bash
# PUT - store in default Queue
POST /services/Queueing /api/put/user-123
Content-Type: application/json

{ "id": 123, "name": "Alice" }

# GET - retrieve from default Queue
GET /services/Queueing /api/get/user-123

# DELETE - remove from default Queue
DELETE /services/Queueing /api/delete/user-123
```

### Named Instances

```bash
# PUT - store in 'sessions' instance
POST /services/Queueing /api/sessions/put/session-abc123
Content-Type: application/json

{ "userId": 123, "token": "abc123", "expiresAt": "2025-12-31" }

# GET - retrieve from 'sessions' instance
GET /services/Queueing /api/sessions/get/session-abc123

# DELETE - remove from 'sessions' instance
DELETE /services/Queueing /api/sessions/delete/session-abc123

# GET analytics for 'sessions' instance
GET /services/Queueing /api/sessions/analytics

# GET list for 'metrics' instance
GET /services/Queueing /api/metrics/list
```

## Instance Isolation Example

```javascript
// Two instances with same key, different values
const userQueue = ServiceRegistry.getService('Queueing ', 'memory', { instanceName: 'users' });
const configQueue = ServiceRegistry.getService('Queueing ', 'memory', { instanceName: 'config' });

await userQueue.put('app-settings', { theme: 'dark', language: 'en' });
await configQueue.put('app-settings', { version: '2.1.0', debug: true });

// Data is isolated
const userSettings = await userQueue.get('app-settings');     // { theme: 'dark', language: 'en' }
const appConfig = await configQueue.get('app-settings');      // { version: '2.1.0', debug: true }
```

# Future Enhancements

## For Phase 3 (UI Enhancement)
- Add instance dropdown selector to Queueing Service dashboard
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

