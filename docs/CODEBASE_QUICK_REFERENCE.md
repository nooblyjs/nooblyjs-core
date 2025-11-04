# NooblyJS Core - Quick Reference Guide

## Quick Navigation

**Full Analysis:** See `/CODEBASE_ANALYSIS.md` for comprehensive documentation

---

## 14 Core Services at a Glance

| Service | Location | Providers | Level | Key Use Case |
|---------|----------|-----------|-------|--------------|
| **Logging** | `/src/logging/` | memory, file, api | 0 | Application logging |
| **Caching** | `/src/caching/` | memory, redis, memcached, file, api | 1 | Data caching |
| **Filing** | `/src/filing/` | local, ftp, s3, git, gcp, sync, api | 1 | File operations |
| **Queueing** | `/src/queueing/` | memory, redis, rabbitmq, api | 1 | Task queuing |
| **Notifying** | `/src/notifying/` | memory, api | 1 | Pub/sub messaging |
| **Fetching** | `/src/fetching/` | node, axios | 1 | HTTP requests |
| **DataService** | `/src/dataservice/` | memory, file, mongodb, documentdb, simpledb, api | 2 | Data persistence |
| **Working** | `/src/working/` | memory, api | 2 | Worker threads |
| **Measuring** | `/src/measuring/` | memory, api | 2 | Metrics tracking |
| **Scheduling** | `/src/scheduling/` | memory | 3 | Task scheduling |
| **Searching** | `/src/searching/` | memory, files, api | 3 | Full-text search |
| **Workflow** | `/src/workflow/` | memory, api | 3 | Workflow orchestration |
| **Authentication** | `/src/authservice/` | memory, file, passport, google, api | 4 | User auth/RBAC |
| **AI Service** | `/src/aiservice/` | claude, chatgpt, ollama, api | 4 | LLM integration |

---

## Service Registry Usage

### Get a Service
```javascript
const serviceRegistry = require('./index');

// Convenience methods
const logger = serviceRegistry.logger('file');
const cache = serviceRegistry.cache('memory');
const dataService = serviceRegistry.dataService('mongodb');

// Generic method
const service = serviceRegistry.getService('caching', 'redis', {
  instanceName: 'custom-instance'
});
```

### Initialize Registry
```javascript
const options = {
  logDir: './logs',
  dataDir: './data',
  apiKeys: ['your-api-key'],
  requireApiKey: true,
  excludePaths: ['/services/*/status']
};

serviceRegistry.initialize(app, eventEmitter, options);
```

### List Services
```javascript
const allServices = serviceRegistry.listServices();
// Returns: ['logging:file:default', 'caching:memory:default', ...]

const instances = serviceRegistry.listInstances('caching');
// Returns: [{ serviceName: 'caching', providerType: 'memory', instanceName: 'default' }, ...]
```

---

## Common Service Methods

### Logging
```javascript
log.info('Message', { key: 'value' });
log.warn('Warning', {});
log.error('Error', {});
log.debug('Debug', {});
const stats = log.analytics.getAnalytics();
```

### Caching
```javascript
await cache.set('key', value, 3600000); // 1 hour TTL
const data = await cache.get('key');
await cache.delete('key');
await cache.clear();
const stats = cache.analytics.getAnalytics();
```

### DataService
```javascript
await dataService.add('users', { name: 'John', email: 'john@example.com' });
await dataService.remove('users', uuid);
const results = await dataService.find('users', 'John');
const users = await dataService.jsonFindByPath('users', 'name', 'John');
const active = await dataService.jsonFindByCriteria('users', { 'status': 'active' });
```

### Queueing
```javascript
await queue.enqueue('tasks', { data: 'payload' });
const task = await queue.dequeue('tasks');
const size = await queue.size('tasks');
```

### Filing
```javascript
await filing.create('/path/file.txt', Buffer.from('content'));
const content = await filing.read('/path/file.txt', 'utf8');
await filing.delete('/path/file.txt');
const files = await filing.list('/directory/');
```

### Workflow
```javascript
await workflow.defineWorkflow('myflow', [
  '/path/step1.js',
  '/path/step2.js',
  '/path/step3.js'
]);
await workflow.runWorkflow('myflow', { data: 'initial' }, (status) => {
  console.log(status);
});
```

### AI Service
```javascript
const response = await aiservice.generate({
  prompt: 'Explain AI',
  maxTokens: 500
});
const analytics = aiservice.getPromptAnalytics();
```

### Authentication
```javascript
await authservice.register('user@example.com', 'password', { name: 'User' });
const user = await authservice.authenticate('user@example.com', 'password');
const hasAccess = authservice.hasPermission(user, 'admin');
```

### Searching
```javascript
await searching.index('users', { id: 1, name: 'John' });
const results = await searching.search('users', 'John');
await searching.remove('users', uuid);
```

---

## REST API Endpoints

### Service Status (Public)
```
GET /services/{service}/api/status
```

### Service Settings
```
GET    /services/{service}/api/settings
POST   /services/{service}/api/settings
```

### System Monitoring
```
GET /services/api/monitoring/metrics
GET /services/api/monitoring/snapshot
```

### Service Dashboard (Protected)
```
GET /services/
```

---

## Environment Variables

### Required
```bash
NOOBLY_API_KEYS=key1,key2,key3
SESSION_SECRET=your-secret
```

### Optional
```bash
PORT=3001
NODE_ENV=production
aiapikey=your-anthropic-key
OLLAMA_URL=http://localhost:11434
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

---

## Default Providers

```javascript
{
  'logging': 'memory',
  'caching': 'memory',
  'filing': 'local',
  'queueing': 'memory',
  'notifying': 'memory',
  'dataservice': 'memory',
  'working': 'memory',
  'measuring': 'memory',
  'scheduling': 'memory',
  'searching': 'memory',
  'workflow': 'memory',
  'authservice': 'file',
  'aiservice': 'claude',
  'fetching': 'node'
}
```

---

## Dependency Tree

```
Level 0:
  logging

Level 1:
  caching [logging]
  filing [logging]
  queueing [logging]
  notifying [logging]
  fetching [logging]

Level 2:
  dataservice [logging, queueing]
  working [logging, queueing, caching]
  measuring [logging, queueing, caching]

Level 3:
  scheduling [logging, working]
  searching [logging, caching, dataservice, queueing, working, scheduling]
  workflow [logging, queueing, scheduling, measuring, working]

Level 4:
  authservice [logging, caching, dataservice]
  aiservice [logging, caching, workflow, queueing]
```

---

## File Structure

```
/src/{service}/
├── index.js              # Factory function
├── providers/
│   ├── {provider}.js     # Implementation
│   └── ...
├── routes/
│   └── index.js          # Express routes
├── views/
│   └── index.js          # UI/Dashboard
└── modules/
    ├── analytics.js      # Analytics module
    └── ...
```

---

## Events

### Lifecycle
```javascript
eventEmitter.on('service:created', data => {});
eventEmitter.on('dependencies:initialized', data => {});
```

### Service-Specific
```javascript
eventEmitter.on('cache:hit', data => {});
eventEmitter.on('cache:miss', data => {});
eventEmitter.on('workflow:complete', data => {});
eventEmitter.on('auth:login', data => {});
eventEmitter.on('ai:generate', data => {});
```

---

## Security

### Three-Layer Authentication
1. **API Key Auth** - X-API-Key header
2. **Services Auth** - Session-based dashboard
3. **User Auth** - Credentials/OAuth

### Configuration
```javascript
{
  security: {
    apiKeyAuth: {
      apiKeys: ['key1', 'key2'],
      requireApiKey: true,
      excludePaths: ['/services/*/status']
    },
    servicesAuth: {
      requireLogin: true
    }
  }
}
```

---

## Development Commands

```bash
npm start           # Run application
npm run dev:web     # Development with nodemon
npm test            # Run tests
npm run test-load   # Load tests
npm run kill        # Kill port 3001
```

---

## Key Patterns

### Singleton Services
- ServiceRegistry
- Working Service
- Scheduling Service

### Factory Pattern
- All service creation via factory functions
- Provider selection at runtime
- Dependency injection at creation

### Dependency Injection
- 4-level hierarchy
- Automatic resolution
- Circular dependency detection

---

## Instance Management

### Create Multiple Instances
```javascript
const cache1 = serviceRegistry.getService('caching', 'memory', {
  instanceName: 'session-cache'
});

const cache2 = serviceRegistry.getService('caching', 'memory', {
  instanceName: 'data-cache'
});
```

### Instance Naming Convention
```
{serviceName}:{providerType}:{instanceName}
```

---

## Performance Tips

1. Use Redis/Memcached for distributed caching
2. Use file-based dataservice for small datasets
3. Use MongoDB/DocumentDB for large datasets
4. Use worker threads for CPU-intensive tasks
5. Implement caching in AI service for prompts
6. Use message queues for async tasks

---

## Troubleshooting

### Service Not Found
```javascript
try {
  const service = serviceRegistry.getService('unknown', 'memory');
} catch (error) {
  console.error('Service creation failed:', error.message);
}
```

### Dependency Not Resolved
```javascript
const deps = serviceRegistry.resolveDependencies('searching', 'memory');
console.log('Resolved dependencies:', Object.keys(deps));
```

### Check Service Status
```bash
curl -X GET http://localhost:3001/services/caching/api/status
```

---

## Next Steps

1. Read `/CODEBASE_ANALYSIS.md` for comprehensive documentation
2. Check `/app.js` for usage examples
3. Explore `/tests/` for test patterns
4. Review individual service `/index.js` files for API details

---

**Last Updated:** 2025-11-04
**Version:** 1.0.10
**Services:** 14 active + 1 incomplete (15 total)
**Providers:** 40+
