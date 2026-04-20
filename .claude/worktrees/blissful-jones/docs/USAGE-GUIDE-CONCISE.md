# Digital Technologies Core - Concise Usage Guide

Quick reference for implementing Digital Technologies Core library in applications.

## Basic Setup

```javascript
const serviceRegistry = require('digital-technologies-core');
const express = require('express');
const { EventEmitter } = require('events');

const app = express();
const eventEmitter = new EventEmitter();

serviceRegistry.initialize(app, eventEmitter, {
  logDir: './logs',
  dataDir: './data',
  apiKeys: process.env.API_KEYS?.split(',') || [],
  requireApiKey: true
});

app.listen(process.env.PORT || 3000);
```

## Getting Services

```javascript
// Single-line access
const logger = serviceRegistry.logger('file');
const cache = serviceRegistry.cache('redis');
const dataService = serviceRegistry.dataService('mongodb', { connectionString: 'mongodb://localhost:27017' });
const queue = serviceRegistry.queue('redis');
const workflow = serviceRegistry.workflow('memory');
const auth = serviceRegistry.authservice('file');
const ai = serviceRegistry.aiservice('claude', { apiKey: process.env.ANTHROPIC_API_KEY });
const filing = serviceRegistry.filing('s3', { bucket: process.env.AWS_BUCKET });

// Multiple instances with names
const sessionCache = serviceRegistry.cache('redis', { instanceName: 'sessions' });
const dataCache = serviceRegistry.cache('redis', { instanceName: 'data' });
```

## Common Operations

### Logging
```javascript
logger.info('Message', { metadata: 'value' });
logger.error('Error', { error: err });
const stats = logger.analytics.getAnalytics();
```

### Caching
```javascript
await cache.set('key', value, { ttl: 3600 });
const value = await cache.get('key');
await cache.delete('key');
const exists = await cache.has('key');
```

### Data Operations
```javascript
const id = await dataService.create('collection', { data: 'value' });
const item = await dataService.read('collection', id);
await dataService.update('collection', id, { updated: 'data' });
await dataService.delete('collection', id);
const items = await dataService.list('collection');
const results = await dataService.query('collection', { field: 'value' });
```

### Queueing
```javascript
const jobId = await queue.enqueue('job-name', { data: 'value' });
queue.process('job-name', async (job) => {
  console.log('Processing:', job.data);
  return { result: 'done' };
});
const status = await queue.getJobStatus(jobId);
```

### Workflows
```javascript
const workflow = {
  name: 'my-workflow',
  steps: [
    { id: 'step1', handler: async (ctx) => ({ result: 'step1' }) },
    { id: 'step2', handler: async (ctx) => ({ result: 'step2' }) }
  ]
};

const result = await workflow.execute(workflow, { initialData: 'value' });
```

### Authentication
```javascript
await auth.register({ username: 'user', password: 'pass', email: 'user@example.com' });
const { token } = await auth.authenticate({ username: 'user', password: 'pass' });
const user = await auth.verifyToken(token);
```

### File Operations
```javascript
await filing.write('path/file.txt', buffer);
const content = await filing.read('path/file.txt');
await filing.delete('path/file.txt');
const files = await filing.list('path');
```

### Scheduling
```javascript
scheduler.schedule('0 2 * * *', async () => { /* daily at 2am */ });
scheduler.scheduleInterval('task-name', 60000, async () => { /* every minute */ });
```

### Search
```javascript
search.index('doc-id', { title: 'text', content: 'more text' });
const results = search.search('query', { limit: 10 });
```

### AI
```javascript
const response = await ai.prompt('What is machine learning?');
const analysis = await ai.prompt(prompt, { maxTokens: 500, temperature: 0.7 });
```

## Patterns

### Cache-Aside Pattern
```javascript
async function getData(key) {
  let data = await cache.get(key);
  if (data) return data;
  data = await dataService.read('collection', key);
  await cache.set(key, data);
  return data;
}
```

### Error Handling
```javascript
try {
  const result = await dataService.read('collection', id);
  return result;
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  throw error;
}
```

### Dependency Injection
```javascript
class UserService {
  constructor(deps) {
    this.data = deps.dataService;
    this.cache = deps.cache;
    this.logger = deps.logger;
  }

  async getUser(id) {
    let user = await this.cache.get(`user:${id}`);
    if (!user) {
      user = await this.data.read('users', id);
      await this.cache.set(`user:${id}`, user);
    }
    return user;
  }
}

const userService = new UserService({
  dataService: serviceRegistry.dataService('mongodb'),
  cache: serviceRegistry.cache('redis'),
  logger: serviceRegistry.logger('file')
});
```

### Event Listeners
```javascript
const eventEmitter = serviceRegistry.getEventEmitter();
eventEmitter.on('service:created', (data) => console.log('Service:', data.serviceName));
eventEmitter.on('cache:set', (data) => console.log('Cached:', data.key));
eventEmitter.on('error', (error) => console.error('Error:', error));
```

## Express Integration Examples

### Protected Routes with Auth
```javascript
const auth = serviceRegistry.authservice('file');

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    req.user = await auth.verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.post('/login', async (req, res) => {
  const result = await auth.authenticate(req.body);
  res.json({ token: result.token });
});

app.get('/profile', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});
```

### Queue Processing
```javascript
app.post('/process-data', async (req, res) => {
  const jobId = await queue.enqueue('heavy-task', { data: req.body });
  res.json({ jobId });
});

queue.process('heavy-task', async (job) => {
  const logger = serviceRegistry.logger('file');
  logger.info('Processing job', { jobId: job.id });
  // do work
  return { done: true };
});
```

### Data API
```javascript
const dataService = serviceRegistry.dataService('mongodb');

app.get('/api/:collection', async (req, res) => {
  const items = await dataService.list(req.params.collection);
  res.json(items);
});

app.post('/api/:collection', async (req, res) => {
  const id = await dataService.create(req.params.collection, req.body);
  res.json({ id });
});

app.get('/api/:collection/:id', async (req, res) => {
  const item = await dataService.read(req.params.collection, req.params.id);
  res.json(item);
});

app.put('/api/:collection/:id', async (req, res) => {
  await dataService.update(req.params.collection, req.params.id, req.body);
  res.json({ success: true });
});

app.delete('/api/:collection/:id', async (req, res) => {
  await dataService.delete(req.params.collection, req.params.id);
  res.json({ success: true });
});
```

## Service Providers Reference

| Service | Providers |
|---------|-----------|
| logging | memory, file, api |
| caching | memory, redis, memcached, file, api |
| dataservice | memory, file, mongodb, documentdb, simpledb |
| queueing | memory, redis, rabbitmq, aws, azure, gcp, api |
| filing | local, ftp, s3, git, sync |
| authservice | file, memory, passport, google |
| aiservice | claude, chatgpt, ollama |
| scheduling | memory |
| workflow | memory |
| searching | memory |
| notifying | memory, api |
| fetching | node, axios |

## Testing

```javascript
const { EventEmitter } = require('events');

describe('My Service', () => {
  let cache, dataService, eventEmitter;

  beforeEach(() => {
    serviceRegistry.reset();
    eventEmitter = new EventEmitter();
    cache = serviceRegistry.cache('memory');
    dataService = serviceRegistry.dataService('memory');
  });

  it('should cache data', async () => {
    const id = await dataService.create('items', { name: 'test' });
    await cache.set(`item:${id}`, { name: 'test' });
    const cached = await cache.get(`item:${id}`);
    expect(cached.name).toBe('test');
  });

  afterEach(() => serviceRegistry.reset());
});
```

## Key Methods

```javascript
// Service management
serviceRegistry.getService(name, provider, options);
serviceRegistry.getServiceInstance(name, provider, instanceName);
serviceRegistry.listServices();
serviceRegistry.listInstances(serviceName);
serviceRegistry.resetService(serviceName);
serviceRegistry.reset();

// Utilities
serviceRegistry.generateApiKey(length);
serviceRegistry.validateDependencies();
serviceRegistry.getEventEmitter();
```

## Environment Variables

```bash
PORT=3000
NODE_ENV=production
API_KEYS=key1,key2,key3
SESSION_SECRET=your-secret
REDIS_HOST=localhost
REDIS_PORT=6379
MONGO_URI=mongodb://localhost:27017
AWS_BUCKET=bucket-name
ANTHROPIC_API_KEY=sk-ant-...
```

## Quick E-Commerce Example

```javascript
const cache = serviceRegistry.cache('redis');
const dataService = serviceRegistry.dataService('mongodb');
const queue = serviceRegistry.queue('redis');
const logger = serviceRegistry.logger('file');

// Get products with cache
app.get('/products', async (req, res) => {
  let products = await cache.get('products:all');
  if (!products) {
    products = await dataService.list('products');
    await cache.set('products:all', products, { ttl: 3600 });
  }
  res.json(products);
});

// Create order and queue processing
app.post('/orders', async (req, res) => {
  const orderId = await dataService.create('orders', req.body);
  await queue.enqueue('process-order', { orderId });
  res.json({ orderId });
});

// Process order async
queue.process('process-order', async (job) => {
  const order = await dataService.read('orders', job.data.orderId);
  // process payment, send email, etc
  logger.info('Order processed', { orderId: job.data.orderId });
});
```

## Key Points

- **Singleton Pattern**: ServiceRegistry is a singleton - use it globally
- **Dependency Injection**: Services receive dependencies in options
- **Multi-Instance**: Same service type can have multiple named instances
- **Async/Await**: All service operations are async
- **Event-Driven**: Services emit events for lifecycle operations
- **Provider Flexibility**: Most services support multiple backends
- **Fallback Handling**: Implement cache-aside for resilience
- **Queue Priority**: Use queues for long-running operations
- **Monitoring**: Access analytics via `service.analytics.getAnalytics()`

## Common Mistakes to Avoid

```javascript
// ❌ Creating service multiple times
app.get('/api/data', () => {
  const cache = serviceRegistry.cache('redis'); // Every request!
});

// ✅ Create once, reuse
const cache = serviceRegistry.cache('redis');
app.get('/api/data', async (req, res) => {
  const data = await cache.get('key');
});

// ❌ Not handling async operations
app.get('/api/data', () => {
  const data = await dataService.read('items', id); // Missing await!
});

// ✅ Proper async handling
app.get('/api/data', async (req, res) => {
  const data = await dataService.read('items', id);
  res.json(data);
});

// ❌ Not caching expensive operations
const allUsers = await dataService.list('users'); // Every request!

// ✅ Cache expensive operations
const key = 'users:all';
let users = await cache.get(key);
if (!users) {
  users = await dataService.list('users');
  await cache.set(key, users, { ttl: 3600 });
}
```
