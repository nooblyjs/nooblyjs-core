# CLAUDE.md - NooblyJS Core Guidance for Claude Code

This file provides guidance to Claude Code when working with the NooblyJS Core codebase.

## Quick Navigation

- **Main Registry**: `index.js` - ServiceRegistry singleton
- **Main App**: `app.js` - Complete application example
- **Services**: `src/{service}/` - All service implementations
- **Tests**: `tests/` - Unit, load, and API tests

## Architecture Overview

**NooblyJS Core** is a modular Node.js backend framework providing 14 enterprise-grade services through a unified Service Registry with:
- **4-level dependency hierarchy** (Foundation → Infrastructure → Business Logic → Application → Integration)
- **Singleton pattern** for service instances
- **Factory pattern** for consistent service creation
- **Auto-generated REST APIs** at `/services/{service}/api/*`
- **3-layer security** (API key auth + session auth + user auth)

## All 14 Services

### Level 0: Foundation
- **Logging** (`src/logging/`) - Application logging with levels

### Level 1: Infrastructure
- **Caching** (`src/caching/`) - Key-value caching with TTL
- **Filing** (`src/filing/`) - File management (S3, local, FTP, GCP, Git)
- **Queueing** (`src/queueing/`) - FIFO task queues
- **Fetching** (`src/fetching/`) - HTTP requests with caching
- **App Service** (`src/appservice/`) - Auto-load src/ directory structure

### Level 2: Business Logic
- **DataService** (`src/dataservice/`) - UUID-based JSON document storage with search
- **Working** (`src/working/`) - Background task execution with worker threads
- **Measuring** (`src/measuring/`) - Metrics collection and time-series

### Level 3: Application
- **Scheduling** (`src/scheduling/`) - Cron-like task scheduling
- **Searching** (`src/searching/`) - Full-text search and indexing
- **Workflow** (`src/workflow/`) - Multi-step workflow orchestration

### Level 4: Integration
- **Notifying** (`src/notifying/`) - Pub/sub messaging (topics and subscribers)
- **Auth Service** (`src/authservice/`) - User authentication, RBAC, OAuth 2.0
- **AI Service** (`src/aiservice/`) - LLM integration (Claude, ChatGPT, Ollama)

## Service Structure

Each service follows this consistent pattern:

```
src/{service}/
├── index.js              # Factory function: creates service instance
├── providers/            # Different backend implementations
│   ├── memory.js
│   ├── redis.js
│   ├── file.js
│   └── api.js
├── routes/               # Express REST API routes
│   └── index.js
└── views/                # Optional UI (caching service only)
    └── index.js
```

### Service Factory Pattern

Every service exports a factory function:

```javascript
// src/{service}/index.js
module.exports = ({logging, caching, dataservice, ...dependencies}) => {
  const provider = options.provider || 'memory';
  const implementation = require(`./providers/${provider}`)(options);

  return {
    // Public API methods
    methodName: async (params) => { ... }
  };
};
```

## ServiceRegistry (index.js) Key Methods

```javascript
// Initialization (REQUIRED - must be called first)
serviceRegistry.initialize(expressApp, eventEmitter, options)

// Service access (all follow same pattern)
serviceRegistry.logger(provider, options)
serviceRegistry.cache(provider, options)
serviceRegistry.dataService(provider, options)
serviceRegistry.filing(provider, options)
serviceRegistry.queue(provider, options)
serviceRegistry.scheduling(provider, options)
serviceRegistry.workflow(provider, options)
serviceRegistry.working(provider, options)
serviceRegistry.searching(provider, options)
serviceRegistry.notifying(provider, options)
serviceRegistry.measuring(provider, options)
serviceRegistry.fetching(provider, options)
serviceRegistry.authservice(provider, options)
serviceRegistry.aiservice(provider, options)
serviceRegistry.appservice(type, options)

// Utilities
serviceRegistry.getEventEmitter()
serviceRegistry.generateApiKey()
```

## Common Implementation Patterns

### Adding a Service Method

All service methods should:
1. Be async
2. Return typed data (objects, arrays, strings, numbers)
3. Throw errors with descriptive messages
4. Support both programmatic and REST API access

Example:
```javascript
async myMethod(params) {
  try {
    // Validate input
    if (!params.required) throw new Error('required parameter missing');

    // Perform operation
    const result = await operation();

    // Emit event for monitoring
    this.eventEmitter?.emit('service:action', {action: 'myMethod', result});

    return result;
  } catch (error) {
    this.logging.error('Error in myMethod:', error);
    throw error;
  }
}
```

### Adding Provider Support

Create new provider in `src/{service}/providers/{provider}.js`:

```javascript
module.exports = (options) => {
  return {
    async methodName(params) {
      // Implementation for this provider
    },
    getAnalytics() {
      // Optional: return analytics
    }
  };
};
```

### Adding REST Routes

Routes in `src/{service}/routes/index.js`:

```javascript
module.exports = (express, service, prefix, middleware) => {
  const router = express.Router();

  // GET /services/{service}/api/method/:id
  router.get('/method/:id', middleware.authCheck, async (req, res) => {
    try {
      const result = await service.methodName(req.params);
      res.json({success: true, data: result});
    } catch (error) {
      res.status(500).json({success: false, error: error.message});
    }
  });

  return router;
};
```

## Database/Persistence Patterns

### DataService UUID-based Storage

```javascript
// Insert (returns UUID)
const uuid = await dataService.add('users', {
  name: 'John',
  email: 'john@example.com',
  profile: {role: 'developer', department: 'engineering'}
});

// Retrieve
const user = await dataService.getByUuid('users', uuid);

// Search with custom predicate
const results = await dataService.jsonFind('users',
  user => user.profile.department === 'engineering'
);

// Search by path
const devs = await dataService.jsonFindByPath('users', 'profile.role', 'developer');

// Multi-criteria search
const results = await dataService.jsonFindByCriteria('users', {
  'profile.department': 'engineering',
  'profile.role': 'developer'
});

// Delete
await dataService.remove('users', uuid);
```

### Caching Patterns

```javascript
// Store with TTL (seconds)
await cache.put('user:123', userData, 3600); // 1 hour

// Retrieve
const cached = await cache.get('user:123');

// Delete
await cache.delete('user:123');

// Cache-aside pattern
async function getUser(id) {
  let user = await cache.get(`user:${id}`);
  if (!user) {
    user = await dataService.getByUuid('users', id);
    if (user) await cache.put(`user:${id}`, user, 3600);
  }
  return user;
}
```

## Security Architecture

### 3-Layer Authentication

1. **API Key Auth** - Validates x-api-key header
   - Configured via `apiKeys` option
   - Excludable paths via `excludePaths`
   - Protects `/services/*/api/*` endpoints

2. **Session Auth** - Express session + Passport
   - Required for service UI access at `/services/`
   - Authentication service handles user credentials
   - Session data stored in memory or configured store

3. **User Auth** - RBAC within auth service
   - Role-based access control
   - User creation/login/permissions
   - OAuth 2.0 support (Google)

### Security Configuration

```javascript
serviceRegistry.initialize(app, null, {
  apiKeys: ['production-key-1', 'production-key-2'],
  requireApiKey: true,
  excludePaths: ['/services/*/status', '/public/*', '/health'],
  security: {
    apiKeyAuth: {
      apiKeys: ['key1'],
      requireApiKey: true,
      excludePaths: ['/health']
    },
    servicesAuth: {
      enabled: true
    }
  }
});
```

## Development Commands

```bash
npm start              # Start main app (app.js) on port 3001
npm run dev:web       # Start with auto-reload (nodemon)
npm test              # Run Jest tests
npm run test-load     # Run load tests
npm run kill          # Kill process on port 3001
npm run analyze-tokens # Count Claude tokens used
```

## Testing Strategy

### Unit Tests (Jest)
- Location: `tests/unit/{service}.test.js`
- Each service has dedicated test file
- Use memory providers for isolated testing
- Mock external dependencies

### Load Tests
- Location: `tests-load/`
- Run with `npm run test-load`
- Test service performance and stability

### API Tests
- Location: `tests/api/`
- HTTP test files for REST clients
- Manual testing with Postman/curl

## Configuration & Environment

### Environment Variables
- `NODE_ENV` - Set to 'production' to disable auto-generated keys
- `NOOBLY_API_KEYS` - Comma-separated API keys
- `SESSION_SECRET` - Express session secret
- `PORT` - Server port (default: 3001)
- Service-specific: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `REDIS_HOST`, etc.

### Global Options (initialize)
```javascript
{
  logDir: './.noobly-core/logs',
  dataDir: './.noobly-core/data',
  apiKeys: ['key1', 'key2'],
  requireApiKey: true,
  excludePaths: ['/services/*/status'],
  security: {...}
}
```

## REST API Structure

All services expose routes at `/services/{service}/api/*`

```bash
# Authentication (pick one method)
-H "x-api-key: YOUR_KEY"                           # Method 1
-H "Authorization: Bearer YOUR_KEY"                # Method 2
"?api_key=YOUR_KEY"                                # Method 3
-H "api-key: YOUR_KEY"                             # Method 4
-H "Authorization: ApiKey YOUR_KEY"                # Method 5
```

### Service Status (No Auth Required)
```bash
GET /services/{service}/api/status
```

### Common REST Patterns
- `GET /services/{service}/api/...` - Retrieve/Read
- `POST /services/{service}/api/...` - Create/Update
- `DELETE /services/{service}/api/...` - Delete

## Common Mistakes & Solutions

### ❌ Not Initializing ServiceRegistry First
```javascript
// WRONG
const cache = serviceRegistry.cache('memory');
serviceRegistry.initialize(app);

// CORRECT
serviceRegistry.initialize(app);
const cache = serviceRegistry.cache('memory');
```

### ❌ Using DataService Like Caching
```javascript
// WRONG - DataService doesn't use simple keys
await dataService.put('key', value);

// CORRECT - DataService uses containers and UUIDs
const uuid = await dataService.add('container', value);
```

### ❌ Wrong Provider Names
```javascript
// WRONG - Case-sensitive, must be exact
serviceRegistry.cache('Memory');
serviceRegistry.cache('in-memory');

// CORRECT
serviceRegistry.cache('memory');
serviceRegistry.cache('inmemory');
```

### ❌ Forgetting Dependencies
```javascript
// Scheduling depends on Working service
// When you get scheduling, working is auto-initialized
const scheduling = serviceRegistry.scheduling('memory');
// working service already exists now
```

### ❌ Wrong EventEmitter Parameter Order
```javascript
// WRONG - eventEmitter is 2nd param, options is 3rd
serviceRegistry.initialize(app, {apiKeys: ['key']}, myEmitter);

// CORRECT
serviceRegistry.initialize(app, myEmitter, {apiKeys: ['key']});
serviceRegistry.initialize(app, null, {apiKeys: ['key']});
```

## Key Design Patterns Used

### 1. Singleton Pattern
- ServiceRegistry is singleton
- Each service:provider combination is singleton
- Returned by factory on first access, cached thereafter

### 2. Factory Pattern
- Each service exports factory function
- Takes options, returns service instance
- Dependency injection via parameters

### 3. Dependency Injection
- 4-level hierarchy prevents circular deps
- Services receive dependencies automatically
- Topological sort ensures correct initialization

### 4. Provider Pattern
- Each service supports multiple backends
- Same API regardless of provider
- Easy switching between implementations

### 5. Event-Driven Architecture
- Global EventEmitter for inter-service communication
- Services emit events for monitoring
- No hard coupling between services

## Performance Considerations

### In-Memory Providers
- Fast but not distributed
- Lost on process restart
- Good for development/testing

### Redis Providers
- Distributed across processes
- Persistent until TTL expires
- Good for production caching

### File-Based Providers
- Persistent across restarts
- Single-process (no distribution)
- Good for small deployments

### MongoDB Providers
- Highly available and distributed
- Complex queries and indexing
- Good for production data

## Monitoring & Metrics

Most services provide `getAnalytics()`:
```javascript
const cache = serviceRegistry.cache('redis');
const analytics = cache.getAnalytics();
// Returns: {hitCount, missCount, hitRatio, topKeys, memoryUsage, ...}
```

Access via REST API:
```bash
GET /services/{service}/api/analytics
```

Event system for custom monitoring:
```javascript
const eventEmitter = serviceRegistry.getEventEmitter();
eventEmitter.on('cache:put', (data) => {
  console.log('Cache updated:', data.key);
});
eventEmitter.on('ai:usage', (data) => {
  console.log('AI tokens:', data.tokens, 'Cost:', data.cost);
});
```

## Documentation Files

- **README.md** - User-facing overview and quick start
- **CLAUDE.md** - This file, guidance for Claude Code
- **docs/nooblyjs-core-architecture.md** - Detailed architecture
- **docs/nooblyjs-core-usage-guide.md** - Comprehensive usage guide
- **docs/nooblyjs-core-usage-guide-concise.md** - LLM-optimized reference

## Common File Locations

| Item | Path |
|------|------|
| ServiceRegistry | `index.js` |
| Main App | `app.js` |
| Service Factory | `src/{service}/index.js` |
| Providers | `src/{service}/providers/{provider}.js` |
| REST Routes | `src/{service}/routes/index.js` |
| Service UI | `src/{service}/views/` |
| Dashboard | `src/views/` |
| Auth Middleware | `src/authservice/middleware/` |
| Tests | `tests/` |
| Logs | `.noobly-core/logs/` |
| Data | `.noobly-core/data/` |

## When Working on Code

1. **Before modifying**: Understand the service's dependencies
2. **Use existing patterns**: Follow patterns in similar services
3. **Emit events**: Let other services know about state changes
4. **Handle errors**: Always include proper error messages
5. **Test thoroughly**: Add unit tests for new features
6. **Document changes**: Update JSDoc comments and README
7. **Run tests**: `npm test` before committing

## Debugging Tips

```javascript
// Check if registry is initialized
console.log(serviceRegistry.initialized);

// Get all services
console.log(serviceRegistry.listServices());

// Access event emitter for debugging
const eventEmitter = serviceRegistry.getEventEmitter();
eventEmitter.on('*', (event, data) => {
  console.log('Event:', event, 'Data:', data);
});

// Check service dependencies
console.log(serviceRegistry.serviceDependencies);
```

## Additional Notes

- All services use CommonJS (`module.exports`)
- Jest configured with `forceExit` and `detectOpenHandles`
- Requires Node.js >=12.11.0
- License: ISC
- GitHub: https://github.com/nooblyjs/nooblyjs-core
- NPM: https://www.npmjs.com/package/noobly-core
