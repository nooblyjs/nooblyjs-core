# NooblyJS Core - Comprehensive Codebase Analysis

**Version:** 1.0.10  
**Framework:** Express.js (Node.js)  
**Architecture:** Modular Singleton Services with Dependency Injection  
**Module System:** CommonJS

---

## Executive Summary

NooblyJS Core is a comprehensive Node.js backend framework providing 14+ pluggable core services organized in a 4-level dependency hierarchy. Each service follows a consistent factory pattern with multiple provider implementations, automatic route configuration, and integrated analytics. The framework supports distributed systems through API providers and implements a robust security layer with API key authentication and session-based authorization.

---

## 1. SERVICE OVERVIEW (14 Total Services)

### Service Dependency Hierarchy

```
Level 0: Foundation Services
├── Logging Service

Level 1: Infrastructure Services
├── Caching Service
├── Queueing Service
├── Notifying Service
├── AppService
└── Fetching Service

Level 2: Business Logic Services
├── DataService
├── Working Service
└── Measuring Service

Level 3: Application Services
├── Scheduling Service
├── Searching Service
├── Workflow Service
└── Filing Service

Level 4: Integration Services
├── Authentication Service
└── AI Service

Additional Services:
└── Requesting Service (Incomplete - TODO)
```

---

## 2. DETAILED SERVICE ARCHITECTURE

### 2.1 Level 0: Foundation Services

#### 📝 Logging Service
- **Location:** `/src/logging/`
- **Providers:**
  - `memory` - In-memory console logging
  - `file` - File-based logging with rotation
  - `api` - Remote logging service API
- **Key Methods:**
  - `info(message, metadata)` - Info level log
  - `warn(message, metadata)` - Warning level log
  - `error(message, metadata)` - Error level log
  - `debug(message, metadata)` - Debug level log
  - `analytics.getAnalytics()` - Get log statistics
- **Features:**
  - Multiple log levels (debug, info, warn, error)
  - Structured logging with metadata
  - File rotation support
  - Log analytics tracking
  - Event emission on log events
- **Dependencies:** None
- **REST API:** `/services/logging/api/*`

---

### 2.2 Level 1: Infrastructure Services

#### 🗃️ Caching Service
- **Location:** `/src/caching/`
- **Providers:**
  - `memory` (inmemory) - JavaScript Map-based cache
  - `redis` - Redis backend cache
  - `memcached` - Memcached backend
  - `file` - File-based cache persistence
  - `api` - Remote caching service
- **Key Methods:**
  - `set(key, value, ttl)` - Cache a value
  - `get(key)` - Retrieve cached value
  - `delete(key)` - Remove from cache
  - `clear()` - Clear all cache entries
  - `analytics.getAnalytics()` - Get hit/miss stats
- **Features:**
  - TTL support with automatic expiration
  - LRU (Least Recently Used) eviction
  - Hit/miss ratio tracking
  - Analytics dashboard
  - Support for distributed caching
- **Dependencies:** logging
- **REST API:** `/services/caching/api/*`

#### 📁 Filing Service
- **Location:** `/src/filing/`
- **Providers:**
  - `local` - Local filesystem operations
  - `ftp` - FTP file transfer
  - `s3` - AWS S3 cloud storage
  - `git` - Git repository as storage backend
  - `gcp` - Google Cloud Platform storage
  - `sync` - Bidirectional file synchronization
  - `api` - Remote filing service
- **Key Methods:**
  - `create(path, content)` / `upload(path, content)` - Create/upload file
  - `read(path, encoding)` / `download(path, encoding)` - Read/download file
  - `delete(path)` / `remove(path)` - Delete file
  - `list(path)` - List directory contents
  - `update(path, content)` - Update file
  - **Git-specific:** `commitWithMessage()`, `push()`, `fetch()`, `getGitStatus()`
  - **Sync-specific:** `lockFile()`, `unlockFile()`, `pushFile()`, `pullFile()`, `syncFile()`, `syncAll()`
- **Features:**
  - Multi-backend file operations
  - Stream support for large files
  - Cloud storage integration (S3, GCP)
  - Git version control integration
  - Bidirectional synchronization
  - File locking mechanisms
  - Read/write/delete analytics
- **Dependencies:** logging
- **REST API:** `/services/filing/api/*`

#### 🚀 Queueing Service
- **Location:** `/src/queueing/`
- **Providers:**
  - `memory` - In-memory FIFO queue
  - `redis` - Redis-backed queue
  - `rabbitmq` - RabbitMQ message broker
  - `api` - Remote queue service
- **Key Methods:**
  - `enqueue(queueName, task)` - Add task to queue
  - `dequeue(queueName)` - Remove and return next task
  - `size(queueName)` - Get queue size
  - `peek(queueName)` - View next task without removing
  - `clear(queueName)` - Clear queue
  - `analytics.getAnalytics()` - Get queue statistics
- **Features:**
  - FIFO task processing
  - Queue size monitoring
  - Named queues support
  - Event emission on task operations
  - Persistence options (Redis/RabbitMQ)
  - Queue analytics and metrics
- **Dependencies:** logging, (optional) caching, dataservice
- **REST API:** `/services/queueing/api/*`

#### 🔔 Notifying Service
- **Location:** `/src/notifying/`
- **Providers:**
  - `memory` (default) - In-memory pub/sub
  - `api` - Remote notification service
- **Key Methods:**
  - `subscribe(topic, callback)` - Subscribe to topic
  - `unsubscribe(topic, callback)` - Unsubscribe from topic
  - `publish(topic, message)` - Publish message to topic
  - `getSettings()` / `saveSettings(settings)` - Manage settings
- **Features:**
  - Topic-based pub/sub messaging
  - Multiple subscribers per topic
  - Event broadcasting
  - Message analytics tracking
  - In-memory topic management
- **Dependencies:** logging
- **REST API:** `/services/notifying/api/*`

#### 🔁 AppService
- **Location:** `/src/appservice/`
- **Providers:**
  - `memory` (default)
- **Key Methods:**
  - Automatic discovery and mounting of application structure
  - Base classes for routes, views, services, workers, and data models
- **Features:**
  - Auto-discovers application structure from directories
  - Mounts routes from `src/routes/`
  - Loads views from `src/views/`
  - Initializes services from `src/services/`
  - Loads data models from `src/data/`
  - Initializes activities from `src/activities/`
  - Provides base classes for extension:
    - `appViewBase` - View template base
    - `appRouteBase` - Route handler base
    - `appWorkerBase` - Worker thread base
    - `appServiceBase` - Service module base
    - `appDataBase` - Data model base
- **Dependencies:** logging
- **REST API:** None (provides base classes)

#### 🌐 Fetching Service
- **Location:** `/src/fetching/`
- **Providers:**
  - `node` - Node.js native fetch
  - `axios` - Axios HTTP client
- **Key Methods:**
  - `fetch(url, options)` - Fetch from URL
  - `get(url, options)` - GET request
  - `post(url, data, options)` - POST request
  - `put(url, data, options)` - PUT request
  - `delete(url, options)` - DELETE request
- **Features:**
  - HTTP/HTTPS request handling
  - Multiple HTTP method support
  - Request/response analytics
  - Optional caching integration
  - Configurable timeout and headers
- **Dependencies:** logging
- **REST API:** `/services/fetching/api/*`

---

### 2.3 Level 2: Business Logic Services

#### 📊 DataService
- **Location:** `/src/dataservice/`
- **Providers:**
  - `memory` - In-memory data containers
  - `file` - File-based JSON storage
  - `simpledb` - AWS SimpleDB
  - `mongodb` - MongoDB database
  - `documentdb` - AWS DocumentDB
  - `api` - Remote data service
- **Key Methods:**
  - `add(containerName, object)` - Add object to container
  - `remove(containerName, uuid)` - Remove object from container
  - `find(containerName, searchTerm)` - Search within container
  - `getByUuid(containerName, uuid)` - Retrieve by UUID
  - **JSON search methods:**
    - `jsonFind(containerName, predicate)` - Search with predicate function
    - `jsonFindByPath(containerName, path, value)` - Search by property path
    - `jsonFindByCriteria(containerName, criteria)` - Multi-criteria search
  - `createContainer(name)` - Create data container
  - `getSettings()` / `saveSettings()` - Manage service settings
- **Features:**
  - Multi-backend data persistence
  - Container-based data organization
  - UUID-based object identification
  - Text search and JSON path queries
  - Multi-criteria filtering
  - Database agnostic interface
  - Settings management per container
- **Dependencies:** logging, (optional) queueing
- **REST API:** `/services/dataservice/api/*`

#### ⚙️ Working Service
- **Location:** `/src/working/`
- **Providers:**
  - `memory` (default) - Worker thread execution
  - `api` - Remote working service
- **Key Methods:**
  - `start(scriptPath, data, callback)` - Execute script in worker thread
  - `getSettings()` / `saveSettings()` - Configure service
  - `analytics.getAnalytics()` - Get execution metrics
- **Features:**
  - Worker thread pool management
  - Background task execution
  - File-based script execution
  - Callback-based result handling
  - Error handling and status tracking
  - Execution analytics
  - Performance metrics collection
- **Implementation:** Singleton pattern
- **Dependencies:** logging, (optional) queueing, caching
- **REST API:** `/services/working/api/*`

#### 📈 Measuring Service
- **Location:** `/src/measuring/`
- **Providers:**
  - `memory` (default) - In-memory metrics
  - `api` - Remote measuring service
- **Key Methods:**
  - `record(metric, value, metadata)` - Record a metric value
  - `getMetrics(metricName, options)` - Retrieve metrics
  - `aggregate(metricName, options)` - Get aggregated metrics
  - `getSettings()` / `saveSettings()` - Configure settings
- **Features:**
  - Time-series metrics collection
  - Metric aggregation and analysis
  - Date range filtering
  - Custom metadata tracking
  - Analytics dashboard
  - Performance monitoring
- **Dependencies:** logging, (optional) queueing, caching
- **REST API:** `/services/measuring/api/*`

---

### 2.4 Level 3: Application Services

#### ⏰ Scheduling Service
- **Location:** `/src/scheduling/`
- **Providers:**
  - `memory` (default) - In-memory scheduler
- **Key Methods:**
  - `schedule(taskName, date, callback)` - Schedule one-time task
  - `scheduleRecurring(taskName, interval, callback)` - Schedule recurring task
  - `cancel(taskName)` - Cancel scheduled task
  - `getScheduledTasks()` - List all scheduled tasks
  - `getSettings()` / `saveSettings()` - Configure scheduler
- **Features:**
  - One-time and recurring task scheduling
  - Cron-like task execution
  - Callback-based execution
  - Task cancellation support
  - Multiple task management
  - Event emission on task events
- **Implementation:** Singleton pattern
- **Dependencies:** logging, (optional) working
- **REST API:** `/services/scheduling/api/*`

#### 🔍 Searching Service
- **Location:** `/src/searching/`
- **Providers:**
  - `memory` (default) - In-memory indexing and search
  - `files` - File-based search
  - `api` - Remote search service
- **Key Methods:**
  - `index(collectionName, object)` - Index object for searching
  - `search(collectionName, query)` - Full-text search
  - `remove(collectionName, uuid)` - Remove from index
  - `clear(collectionName)` - Clear collection index
- **Features:**
  - Full-text search and indexing
  - Object indexing with UUID tracking
  - Text tokenization and matching
  - Collection-based index organization
  - Analytics on search queries
  - Event emission on search operations
- **Dependencies:** logging, caching, dataservice, queueing, working, scheduling
- **REST API:** `/services/searching/api/*`

#### 🔄 Workflow Service
- **Location:** `/src/workflow/`
- **Providers:**
  - `memory` (default) - Workflow execution engine
  - `api` - Remote workflow service
- **Key Methods:**
  - `defineWorkflow(name, steps)` - Define workflow with step file paths
  - `runWorkflow(name, data, statusCallback)` - Execute workflow
  - `getSettings()` / `saveSettings()` - Configure workflow settings
- **Features:**
  - Multi-step workflow orchestration
  - Sequential step execution via worker threads
  - Data passing between steps
  - Status callbacks for progress tracking
  - Error handling and workflow interruption
  - Step-level error reporting
  - Workflow analytics and metrics
  - Configurable settings (maxSteps, timeout, parallel execution)
- **Dependencies:** logging, queueing, scheduling, measuring, working
- **REST API:** `/services/workflow/api/*`

---

### 2.5 Level 4: Integration Services

#### 🔐 Authentication Service
- **Location:** `/src/authservice/`
- **Providers:**
  - `memory` - In-memory user storage
  - `file` - File-based user persistence
  - `passport` - Passport.js local strategy
  - `google` - Google OAuth 2.0
  - `api` - Remote auth service
- **Key Methods:**
  - `register(username, password, profile)` - Register new user
  - `authenticate(username, password)` - Verify user credentials
  - `getUser(userId)` - Retrieve user profile
  - `updateUser(userId, updates)` - Update user information
  - `deleteUser(userId)` - Remove user
  - `hasPermission(user, permission)` - Check user permission
  - `getRole(user)` - Get user role
  - `setRole(userId, role)` - Assign role to user
- **Features:**
  - User registration and login
  - Password hashing with bcrypt
  - Session management
  - Role-based access control (RBAC)
  - OAuth 2.0 integration (Google)
  - Passport.js strategy support
  - User profile management
  - Permission and role management
  - Analytics on auth events
- **Middleware Exports:**
  - `createApiKeyAuthMiddleware()` - API key validation
  - `createServicesAuthMiddleware()` - Service auth
  - `configurePassport()` - Passport configuration
  - `generateApiKey()` - Auto-generate API keys
  - `isValidApiKeyFormat()` - Validate key format
- **Dependencies:** logging, caching, dataservice
- **REST API:** `/services/authservice/api/*`

#### 🤖 AI Service
- **Location:** `/src/aiservice/`
- **Providers:**
  - `claude` - Anthropic Claude API
  - `chatgpt` - OpenAI GPT API
  - `ollama` - Local Ollama model
  - `api` - Remote AI service
- **Key Methods:**
  - `generate(prompt, options)` - Generate AI response
  - `stream(prompt, onChunk)` - Stream response tokens
  - `chat(messages, options)` - Multi-turn conversation
  - `getPromptAnalytics()` - Get prompt usage analytics
- **Features:**
  - Multiple LLM provider support
  - Prompt management and caching
  - Response streaming
  - Token usage tracking
  - API analytics and metrics
  - Model selection support
  - Configurable parameters (temperature, maxTokens, etc.)
- **Dependencies:** logging, caching, workflow, queueing
- **REST API:** `/services/aiservice/api/*`

---

### 2.6 Additional Services (Incomplete)

#### 🔄 Requesting Service
- **Location:** `/src/requesting/`
- **Status:** Incomplete (TODO - stub implementation)
- **Key Methods:**
  - `get(url, options)` - HTTP GET (stub)
  - `post(url, data, options)` - HTTP POST (stub)
- **Features:** Framework present but implementation pending
- **Dependencies:** logging, caching, dataservice

---

## 3. SERVICE REGISTRY (Core Container)

### File: `/index.js`

**Class:** `ServiceRegistry` (Singleton)

#### Key Responsibilities:
1. **Service Lifecycle Management**
   - Create and cache service instances (singleton pattern)
   - Support multiple instances per service:provider combination
   - Instance naming: `serviceName:providerType:instanceName`

2. **Dependency Injection**
   - Resolve service dependencies automatically
   - Inject dependencies before service initialization
   - Support 4-level dependency hierarchy

3. **Initialization**
   - Topological sort for proper initialization order
   - Circular dependency detection
   - Security configuration setup

#### Key Methods:
- `initialize(expressApp, eventEmitter, options)` - Setup registry
- `getService(serviceName, providerType, options)` - Get/create service
- `getServiceInstance(serviceName, providerType, instanceName)` - Retrieve cached instance
- `getDefaultProviderType(serviceName)` - Get service's default provider
- `resolveDependencies(serviceName, providerType)` - Resolve and inject dependencies
- `getServiceInitializationOrder()` - Topological sort of services
- `validateDependencies()` - Check for circular dependencies
- `listServices()` - List all initialized services
- `listInstances(serviceName)` - List all instances of a service
- `resetService(serviceName)` - Clear all instances of a service
- `reset()` - Clear all services (for testing)

#### Convenience Methods:
- `cache(type, options)` → `caching` service
- `logger(type, options)` → `logging` service
- `dataService(type, options)` → `dataservice` service
- `filing(type, options)` / `filer(type, options)` → `filing` service
- `queue(type, options)` → `queueing` service
- `scheduling(type, options)` → `scheduling` service
- `searching(type, options)` → `searching` service
- `workflow(type, options)` → `workflow` service
- `working(type, options)` → `working` service
- `measuring(type, options)` → `measuring` service
- `notifying(type, options)` → `notifying` service
- `fetching(type, options)` → `fetching` service
- `aiservice(type, options)` → `aiservice` service
- `authservice(type, options)` → `authservice` service
- `appservice(type, options)` → `appservice` service

#### Configuration:
```javascript
const options = {
  logDir: './logs',
  dataDir: './data',
  apiKeys: ['key1', 'key2'],
  requireApiKey: true,
  excludePaths: ['/services/*/status', '/services/authservice/api/login'],
  security: {
    apiKeyAuth: {
      apiKeys: [...],
      requireApiKey: true,
      excludePaths: [...]
    },
    servicesAuth: {
      requireLogin: true
    }
  }
};

serviceRegistry.initialize(app, eventEmitter, options);
```

---

## 4. SERVICE FACTORY PATTERN

### Standard Structure for Each Service

Every service follows this organization:

```
/src/{service}/
├── index.js              # Factory function
├── providers/            # Multiple provider implementations
│   ├── {provider1}.js
│   ├── {provider2}.js
│   └── ...
├── routes/
│   └── index.js         # Express route setup
├── views/
│   └── index.js         # UI/Dashboard views
└── modules/
    ├── analytics.js     # Service analytics
    └── ...
```

### Factory Pattern Example (Caching Service):

```javascript
function createCache(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;
  
  let cache;
  switch (type) {
    case 'redis': cache = new CacheRedis(...); break;
    case 'memcached': cache = new CacheMemcached(...); break;
    case 'file': cache = new CacheFile(...); break;
    case 'api': cache = new CacheApi(...); break;
    case 'memory':
    default: cache = new Cache(...); break;
  }
  
  // Inject logging
  if (logger) { cache.logger = logger; /* ... */ }
  
  // Inject analytics
  cache.analytics = new CacheAnalytics(eventEmitter, instanceName);
  
  // Setup routes and views
  Routes(options, eventEmitter, cache);
  Views(options, eventEmitter, cache);
  
  return cache;
}

module.exports = createCache;
```

---

## 5. API ROUTE STRUCTURE

### Standard REST Endpoints

All services expose consistent REST endpoints under `/services/{service}/api/*`:

```
GET    /services/{service}/api/status          - Service health check (public)
GET    /services/{service}/api/settings        - Get service settings
POST   /services/{service}/api/settings        - Save service settings

Service-specific CRUD operations following RESTful conventions
```

### Example: Caching Service
```
POST   /services/caching/api/set               - Set cache entry
GET    /services/caching/api/get               - Get cache entry
DELETE /services/caching/api/{key}             - Delete entry
GET    /services/caching/api/analytics         - Get hit/miss stats
```

### Authentication:
- API Key authentication via `X-API-Key` header
- Excluded paths configured globally
- Session-based auth for `/services/` management UI
- Service-specific authentication middleware available

### Service Management UI:
```
GET    /services/                              - Service dashboard (requires login)
GET    /services/api/monitoring/metrics        - System metrics
GET    /services/api/monitoring/snapshot       - System snapshot
```

---

## 6. DEPENDENCY INJECTION & HIERARCHY

### Dependency Resolution Flow:

1. **Request Service:** `serviceRegistry.getService('searching', 'memory')`
2. **Resolve Dependencies:** Look up required services for `searching`:
   ```
   searching requires: [logging, caching, dataservice, queueing, working, scheduling]
   ```
3. **Recursive Resolution:** Each dependency is resolved in order:
   - `logging` → No dependencies (Level 0)
   - `caching` → Requires logging
   - `dataservice` → Requires logging, queueing
   - `queueing` → Requires logging
   - `working` → Requires logging, queueing, caching
   - `scheduling` → Requires logging, working
4. **Singleton Caching:** Each resolved service is cached by key:
   ```
   {serviceName}:{providerType}:{instanceName}
   ```
5. **Injection:** Dependencies passed to service factory as options object

### Dependency Map:

```
Level 0: Foundation
  logging: []

Level 1: Infrastructure
  caching: [logging]
  queueing: [logging]
  notifying: [logging]
  appservice: [logging]
  fetching: [logging]
  filing: [logging]

Level 2: Business Logic
  dataservice: [logging, queueing]
  working: [logging, queueing, caching]
  measuring: [logging, queueing, caching]

Level 3: Application
  scheduling: [logging, working]
  searching: [logging, caching, dataservice, queueing, working, scheduling]
  workflow: [logging, queueing, scheduling, measuring, working]
  filing: [logging, queueing, dataservice]

Level 4: Integration
  authservice: [logging, caching, dataservice]
  aiservice: [logging, caching, workflow, queueing]
```

---

## 7. ANALYTICS & MONITORING

### Per-Service Analytics:

Each service includes an analytics module tracking:
- **Logging:** Total logs, error count, log levels distribution
- **Caching:** Hit rate, miss rate, entry count, evictions
- **Queueing:** Tasks enqueued, dequeued, queue sizes, processing time
- **Filing:** Read/write/delete counts, file operations by type
- **Searching:** Queries executed, results count, search times
- **Workflow:** Executions, step completions, errors, execution times
- **AI:** Prompts, tokens used, response times, cost estimates
- **Auth:** Login attempts, registrations, password changes

### System Monitoring:

```
GET /services/api/monitoring/metrics     - Aggregated system metrics
GET /services/api/monitoring/snapshot    - Current system state snapshot
```

**Metrics Include:**
- Service status (initialized, running, errored)
- Provider information
- Dependency counts
- Instance counts per service
- Overall system health

---

## 8. SECURITY ARCHITECTURE

### Authentication Layers:

#### 1. API Key Authentication
- Middleware: `createApiKeyAuthMiddleware()`
- Header: `X-API-Key`
- Auto-generation in development mode
- Configurable excluded paths:
  ```javascript
  excludePaths: [
    '/services/*/status',          // Status endpoints public
    '/services/',                  // Dashboard root
    '/services/*/views/*',         // Static views
    '/services/authservice/api/login',    // Login page
    '/services/authservice/api/register'  // Registration
  ]
  ```

#### 2. Services Authentication
- Middleware: `createServicesAuthMiddleware()`
- Protects `/services/` management UI
- Express session-based
- Can be disabled via configuration

#### 3. User-Level Authentication (AuthService)
- Local strategy with password hashing
- Google OAuth 2.0 integration
- Session management
- Role-based access control (RBAC)

### Configuration:
```javascript
security: {
  apiKeyAuth: {
    apiKeys: ['generated-key-123...'],
    requireApiKey: true,
    excludePaths: [...]
  },
  servicesAuth: {
    requireLogin: true
  }
}
```

---

## 9. EVENT EMISSION SYSTEM

### Global EventEmitter

Shared across all services for inter-service communication:

```javascript
const eventEmitter = new EventEmitter();
serviceRegistry.initialize(app, eventEmitter, options);
```

### Standard Events:

#### Service Lifecycle:
- `service:created` - When service instance is created
- `dependencies:initialized` - When dependency hierarchy is set up
- `api-auth-setup` - When API key auth configured
- `api-auth-warning` - When auth requested but no keys provided
- `services-auth-disabled` - When services auth disabled

#### Service-Specific Events:
- **Logging:** `log:*` events for each log entry
- **Caching:** `cache:hit`, `cache:miss`, `cache:set`, `cache:delete`
- **Queueing:** `queue:enqueue`, `queue:dequeue`, `queue:size`
- **Workflow:** `workflow:start`, `workflow:step:start`, `workflow:step:end`, `workflow:complete`, `workflow:error`
- **Auth:** `auth:login`, `auth:register`, `auth:logout`, `auth:error`
- **AI:** `ai:generate`, `ai:complete`, `ai:error`
- **Filing:** `file:create`, `file:read`, `file:delete`, `file:list`
- **Searching:** `search:index`, `search:query`, `search:result`

### Event Subscription Pattern:
```javascript
eventEmitter.on('workflow:complete', (data) => {
  console.log('Workflow completed:', data.workflowId, data.finalData);
});
```

---

## 10. CONFIGURATION & ENVIRONMENT

### Environment Variables:

**Required:**
- `NOOBLY_API_KEYS` or `API_KEYS` - Comma-separated API keys
- `SESSION_SECRET` - Express session encryption secret

**Optional:**
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Set to 'production' to disable dev key generation
- `aiapikey` - Anthropic API key for Claude AI service
- `OLLAMA_URL` - Ollama server URL (default: http://localhost:11434)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_CALLBACK_URL` - Google OAuth callback URL

### Default Providers by Service:

```javascript
{
  'logging': 'memory',
  'filing': 'local',
  'measuring': 'memory',
  'caching': 'memory',
  'dataservice': 'memory',
  'working': 'memory',
  'queueing': 'memory',
  'scheduling': 'memory',
  'searching': 'memory',
  'workflow': 'memory',
  'notifying': 'memory',
  'authservice': 'file',
  'aiservice': 'claude',
  'fetching': 'node'
}
```

### Data Directories:

```
.noobly-core/
├── logs/          # Log files (file provider)
└── data/          # Persistent data (file provider)
```

---

## 11. CURRENT IMPLEMENTATION STATUS

### Fully Implemented Services:
- [x] Logging (3 providers)
- [x] Caching (5 providers)
- [x] Filing (7 providers + sync layer)
- [x] Queueing (4 providers)
- [x] Notifying (2 providers)
- [x] DataService (6 providers)
- [x] Working (2 providers, singleton)
- [x] Measuring (2 providers)
- [x] Scheduling (1 provider, singleton)
- [x] Searching (3 providers)
- [x] Workflow (2 providers)
- [x] Authentication (5 providers)
- [x] AI Service (4 providers)
- [x] AppService (auto-discovery framework)
- [x] Fetching (2 providers)
- [x] ServiceRegistry (core container)

### Incomplete/TODO:
- [ ] Requesting Service (stub only)

---

## 12. USAGE EXAMPLES

### Initialize ServiceRegistry:
```javascript
const serviceRegistry = require('./index');
const app = express();
const eventEmitter = new EventEmitter();

const options = {
  logDir: './logs',
  dataDir: './data',
  apiKeys: ['your-api-key-here'],
  requireApiKey: true
};

serviceRegistry.initialize(app, eventEmitter, options);
```

### Get Services:
```javascript
// Using convenience methods
const log = serviceRegistry.logger('file');
const cache = serviceRegistry.cache('memory');
const dataService = serviceRegistry.dataService('file');

// Using generic method
const queueService = serviceRegistry.getService('queueing', 'memory');

// Get specific instance
const service = serviceRegistry.getServiceInstance('caching', 'memory', 'default');
```

### Use Services:
```javascript
// Logging
log.info('Application started', { version: '1.0.0' });

// Caching
await cache.set('user:123', { name: 'John', email: 'john@example.com' });
const user = await cache.get('user:123');

// Data Service
await dataService.add('users', { name: 'John Doe', email: 'john@example.com' });
const users = await dataService.jsonFindByPath('users', 'name', 'John Doe');

// Queueing
await queue.enqueue('email-tasks', { to: 'user@example.com', subject: 'Hello' });
const task = await queue.dequeue('email-tasks');

// Workflow
await workflow.defineWorkflow('order_process', [
  '/path/to/steps/validate.js',
  '/path/to/steps/charge.js',
  '/path/to/steps/confirm.js'
]);
await workflow.runWorkflow('order_process', { orderId: 123 });

// AI Service
const response = await aiservice.generate({
  prompt: 'Explain quantum computing',
  maxTokens: 500
});
```

---

## 13. FILE ORGANIZATION

```
/nooblyjs-core/
├── index.js                       # ServiceRegistry singleton
├── app.js                         # Main application example
├── package.json                   # Dependencies and metadata
├── CLAUDE.md                      # Claude Code guidance
├── README.md                      # Project documentation
├── public/                        # Public landing page assets
├── src/
│   ├── aiservice/                 # AI Service (Claude, OpenAI, Ollama)
│   ├── appservice/                # Application structure framework
│   ├── authservice/               # Authentication & authorization
│   ├── caching/                   # Caching service
│   ├── dataservice/               # Data persistence service
│   ├── fetching/                  # HTTP fetching service
│   ├── filing/                    # File management service
│   ├── logging/                   # Logging service
│   ├── measuring/                 # Metrics & measurements service
│   ├── notifying/                 # Pub/sub notification service
│   ├── queueing/                  # Task queueing service
│   ├── requesting/                # HTTP request service (TODO)
│   ├── scheduling/                # Task scheduling service
│   ├── searching/                 # Full-text search service
│   ├── views/                     # Centralized service dashboard
│   ├── workflow/                  # Workflow orchestration service
│   └── working/                   # Worker thread service
├── tests/
│   ├── unit/                      # Jest unit tests
│   ├── load/                      # Load testing
│   ├── api/                       # API test files
│   ├── activities/                # Activity-based tests
│   └── app-*.js                   # Example applications
└── .noobly-core/
    ├── logs/                      # Runtime log files
    └── data/                      # Runtime persistent data
```

---

## 14. KEY DESIGN PATTERNS

### 1. Singleton Pattern
- **Services:** `working`, `scheduling`
- **Registry:** `ServiceRegistry` itself
- **Analytics:** Shared analytics instances per service

### 2. Factory Pattern
- Service creation via factory functions
- Provider selection during instantiation
- Dependency injection at creation time

### 3. Dependency Injection
- Constructor-based injection
- Options object pattern
- Lazy dependency resolution

### 4. Event-Driven Architecture
- Global EventEmitter for inter-service communication
- Service-specific event namespaces
- Analytics tracking via events

### 5. Provider Pattern
- Multiple backend implementations per service
- Same interface across providers
- Lazy loading of heavy dependencies (AWS SDK)

### 6. MVC for Views
- Routes in `routes/index.js`
- Views in `views/` directory
- Service-specific dashboards

---

## 15. PERFORMANCE CHARACTERISTICS

### Memory Usage:
- Caching: Configurable maxSize with LRU eviction
- In-memory services: Suitable for moderate data volumes
- Distributed options: Redis, Memcached for scaling

### Scalability:
- Stateless service APIs support horizontal scaling
- Redis/Memcached for distributed caching
- Multiple provider implementations for different scales
- Worker threads for CPU-intensive tasks

### Latency:
- Memory providers: Sub-millisecond
- File providers: Milliseconds (SSD dependent)
- Cloud providers (S3, MongoDB): Seconds (network dependent)
- API providers: Network latency

---

## 16. TESTING INFRASTRUCTURE

### Test Types:
- **Unit Tests:** Jest test suite in `tests/unit/`
- **Load Tests:** Load testing scripts in `tests/load/`
- **API Tests:** Manual test files in `tests/api/` for REST clients
- **Activity Tests:** Activity-based tests in `tests/activities/`

### Running Tests:
```bash
npm test              # Run Jest unit tests
npm run test-load     # Run load tests
```

### Test Utilities:
- Jest with `forceExit` and `detectOpenHandles`
- `nock` for HTTP mocking
- `supertest` for API testing

---

## 17. DEVELOPMENT COMMANDS

```bash
npm start          # Start application on port 3001
npm run dev:web    # Development mode with nodemon watching src/
npm test           # Run Jest test suite
npm run test-load  # Run load tests
npm run kill       # Kill process on port 3001
```

---

## 18. NOTABLE FEATURES

### 1. Auto-Generated API Keys
Development mode automatically generates and displays API keys for testing

### 2. Service Dashboard
Centralized UI at `/services/` for managing all services (requires authentication)

### 3. Multi-Instance Support
Multiple instances of same service:provider combination:
```javascript
const cache1 = registry.getService('caching', 'memory', { instanceName: 'session-cache' });
const cache2 = registry.getService('caching', 'memory', { instanceName: 'data-cache' });
```

### 4. Lazy Provider Loading
Heavy dependencies (AWS SDK) loaded only when provider instantiated

### 5. Unified Error Handling
Consistent error responses across all services

### 6. Analytics Throughout
Every major operation tracked and exposed via REST API

### 7. Automatic Route Setup
Routes auto-configured for every service without manual registration

### 8. Settings Management
All services support configuration persistence

---

## 19. KNOWN LIMITATIONS

1. **Requesting Service**: Currently a stub, not fully implemented
2. **Scheduling**: Singleton only, no distributed scheduling
3. **Working**: Singleton with process-level worker pool
4. **In-Memory Providers**: Limited to process memory, not distributed
5. **File Provider**: Synchronous operations in some areas
6. **Testing**: Some providers require external services (Redis, MongoDB, etc.)

---

## 20. CONCLUSION

NooblyJS Core is a comprehensive, well-architected Node.js framework providing 14+ production-ready services with consistent patterns, dependency injection, analytics, and multi-provider support. The framework is designed for both monolithic and microservice architectures with an event-driven foundation enabling scalability and extensibility.

**Best suited for:**
- Backend service development
- Microservice frameworks
- Full-stack applications
- Data-intensive applications
- Real-time systems
- Task scheduling and automation
- AI-powered applications

