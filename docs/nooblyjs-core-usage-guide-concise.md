# NooblyJS Core - AI Assistant Reference (Concise)

**Version:** 1.0.14+
**Purpose**: Optimized for AI assistants. Concise syntax guide, common patterns, and quick lookup.

## Quick Start

```javascript
const express = require('express');
const serviceRegistry = require('noobly-core');

const app = express();
app.use(express.json());

// REQUIRED: Initialize first
serviceRegistry.initialize(app);

// Get services
const cache = serviceRegistry.cache('memory');
const logger = serviceRegistry.logger('file', {logDir: './logs'});
const dataService = serviceRegistry.dataService('memory');

app.listen(3000);
```

## All 14 Services (Ordered by Dependency Level)

### Level 0: Foundation
| Service | Method | Providers | Usage |
|---------|--------|-----------|-------|
| Logging | `serviceRegistry.logger(provider, options)` | memory, file, api | `logger.info(msg, meta); logger.error(msg, err)` |

### Level 1: Infrastructure
| Service | Method | Providers | Usage |
|---------|--------|-----------|-------|
| Caching | `serviceRegistry.cache(provider, options)` | memory, redis, memcached, file, api | `await cache.put(key, val, ttl); await cache.get(key)` |
| Filing | `serviceRegistry.filing(provider, options)` | local, s3, gcp, ftp, git, api | `await filing.create(path, stream); await filing.read(path)` |
| Queueing | `serviceRegistry.queue(provider, options)` | memory, api | `await queue.enqueue(name, task); const task = await queue.dequeue(name)` |
| Fetching | `serviceRegistry.fetching(provider, options)` | node, axios, api | `await fetching.fetch(url, options)` |
| App Service | `serviceRegistry.appservice(type, options)` | basic | Auto-loads src/ directories |

### Level 2: Business Logic
| Service | Method | Providers | Usage |
|---------|--------|-----------|-------|
| DataService | `serviceRegistry.dataService(provider, options)` | memory, file, mongodb, api | `const uuid = await data.add(container, obj); await data.getByUuid(container, uuid)` |
| Working | `serviceRegistry.working(provider, options)` | memory, api | `await working.execute(scriptPath, data)` |
| Measuring | `serviceRegistry.measuring(provider, options)` | memory, api | `await measuring.record(metric, value, timestamp)` |

### Level 3: Application
| Service | Method | Providers | Usage |
|---------|--------|-----------|-------|
| Scheduling | `serviceRegistry.scheduling(provider, options)` | memory | `await scheduling.start(taskName, scriptPath, data, intervalSec, callback)` |
| Searching | `serviceRegistry.searching(provider, options)` | memory, file, api | `await searching.index(container, obj); await searching.search(query)` |
| Workflow | `serviceRegistry.workflow(provider, options)` | memory, api | `await workflow.defineWorkflow(name, steps); await workflow.runWorkflow(name, data, callback)` |

### Level 4: Integration
| Service | Method | Providers | Usage |
|---------|--------|-----------|-------|
| Notifying | `serviceRegistry.notifying(provider, options)` | memory, api | `notifying.createTopic(name); notifying.subscribe(topic, handler); notifying.notify(topic, msg)` |
| Auth Service | `serviceRegistry.authservice(provider, options)` | memory, file, passport, google, api | `await auth.createUser(user, pass, email); const result = await auth.authenticateUser(user, pass)` |
| AI Service | `serviceRegistry.aiservice(provider, options)` | claude, chatgpt, ollama, api | `const resp = await ai.prompt(prompt, {maxTokens, temp})` |

## Provider Options

### Caching
```javascript
serviceRegistry.cache('memory');  // Dev
serviceRegistry.cache('redis', {host: 'localhost', port: 6379, keyPrefix: 'app:'});
serviceRegistry.cache('api', {apiRoot: 'https://backend.com', apiKey: 'key'});
```

### DataService
```javascript
serviceRegistry.dataService('memory');
serviceRegistry.dataService('file', {dataDir: './.data'});
serviceRegistry.dataService('mongodb', {connectionString: 'mongodb://...', database: 'db'});
serviceRegistry.dataService('api', {apiRoot: 'https://backend.com', apiKey: 'key'});
```

### Filing
```javascript
serviceRegistry.filing('local', {dataDir: './uploads'});
serviceRegistry.filing('s3', {bucket: 'mybucket', region: 'us-east-1', accessKeyId: 'key', secretAccessKey: 'secret'});
serviceRegistry.filing('api', {apiRoot: 'https://backend.com', apiKey: 'key'});
```

### AI Service
```javascript
serviceRegistry.aiservice('claude', {apiKey: process.env.ANTHROPIC_API_KEY, model: 'claude-3-5-sonnet-20241022'});
serviceRegistry.aiservice('chatgpt', {apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4'});
serviceRegistry.aiservice('ollama', {baseUrl: 'http://localhost:11434', model: 'llama3.2'});
serviceRegistry.aiservice('api', {apiRoot: 'https://backend.com', apiKey: 'key'});
```

### Auth Service
```javascript
serviceRegistry.authservice('memory', {createDefaultAdmin: true});  // admin:admin123
serviceRegistry.authservice('file', {dataDir: './.data'});
serviceRegistry.authservice('google', {clientID: 'id', clientSecret: 'secret', callbackURL: '/auth/cb'});
serviceRegistry.authservice('api', {apiRoot: 'https://backend.com', apiKey: 'key'});
```

## REST API Endpoints

All services expose `/services/{service}/api/*`

### Authentication (pick any)
```bash
-H "x-api-key: YOUR_KEY"
-H "Authorization: Bearer YOUR_KEY"
-H "Authorization: ApiKey YOUR_KEY"
-H "api-key: YOUR_KEY"
?api_key=YOUR_KEY
```

### Caching API
```bash
POST /services/caching/api/put/:key          # Store (body: {value, ttl})
GET /services/caching/api/get/:key           # Retrieve
DELETE /services/caching/api/delete/:key     # Delete
GET /services/caching/api/list                # All keys
GET /services/caching/api/analytics          # Metrics
```

### DataService API
```bash
POST /services/dataservice/api/:container            # Insert (returns UUID)
GET /services/dataservice/api/:container/:uuid      # Get by UUID
DELETE /services/dataservice/api/:container/:uuid   # Delete
POST /services/dataservice/api/jsonFind/:container  # Custom search (body: {predicate})
GET /services/dataservice/api/jsonFindByPath/:container/:path/:value  # Path search
POST /services/dataservice/api/jsonFindByCriteria/:container  # Multi-criteria (body: criteria)
```

### Filing API
```bash
POST /services/filing/api/upload/:path       # Upload (multipart)
GET /services/filing/api/download/:path      # Download
DELETE /services/filing/api/remove/:path     # Delete
```

### Queue API
```bash
POST /services/queueing/api/enqueue/:name    # Add task
GET /services/queueing/api/dequeue/:name     # Get task
GET /services/queueing/api/size/:name        # Queue size
GET /services/queueing/api/queues            # All queue names
```

### Scheduling API
```bash
POST /services/scheduling/api/schedule        # Schedule task (body: {taskName, scriptPath, intervalSeconds})
DELETE /services/scheduling/api/cancel/:name  # Cancel
GET /services/scheduling/api/analytics        # Metrics
```

### Workflow API
```bash
POST /services/workflow/api/defineworkflow    # Define (body: {name, steps})
POST /services/workflow/api/start              # Execute (body: {name, data})
```

### AI Service API
```bash
POST /services/ai/api/prompt                  # Send prompt (body: {prompt, maxTokens, temperature})
GET /services/ai/api/analytics                # Token usage
```

## Common Patterns

### Cache-Aside Pattern
```javascript
async function getUser(id) {
  let user = await cache.get(`user:${id}`);
  if (!user) {
    user = await dataService.getByUuid('users', id);
    if (user) await cache.put(`user:${id}`, user, 3600);
  }
  return user;
}
```

### DataService CRUD
```javascript
// Create
const uuid = await dataService.add('users', {name: 'John', email: 'john@example.com'});

// Read
const user = await dataService.getByUuid('users', uuid);

// Search
const active = await dataService.jsonFind('users', u => u.status === 'active');
const devs = await dataService.jsonFindByPath('users', 'profile.role', 'developer');
const results = await dataService.jsonFindByCriteria('users', {status: 'active', 'profile.dept': 'eng'});

// Delete
await dataService.remove('users', uuid);
```

### File Upload/Download
```javascript
// Upload
const fileStream = fs.createReadStream('./document.pdf');
await filing.create('documents/report.pdf', fileStream);

// Download
const stream = await filing.read('documents/report.pdf');
res.setHeader('Content-Type', 'application/pdf');
stream.pipe(res);
```

### Task Queue
```javascript
// Enqueue
await queue.enqueue('emailQueue', {to: 'user@example.com', subject: 'Welcome'});

// Dequeue and process
async function processQueue() {
  while (await queue.size('emailQueue') > 0) {
    const task = await queue.dequeue('emailQueue');
    await sendEmail(task.to, task.subject);
  }
}
```

### Pub/Sub Messaging
```javascript
// Create topic
notifying.createTopic('orders');

// Subscribe
notifying.subscribe('orders', (event) => {
  if (event.type === 'order_placed') {
    // Process order
  }
});

// Publish
notifying.notify('orders', {type: 'order_placed', orderId: '123'});
```

### AI Integration
```javascript
const response = await aiservice.prompt('Generate a blog post about AI', {
  maxTokens: 2000,
  temperature: 0.8
});

console.log('Content:', response.content);
console.log('Tokens:', response.usage.totalTokens);
console.log('Cost:', response.usage.estimatedCost);

const analytics = aiservice.getAnalytics();
```

### Authentication
```javascript
// File-based auth
const auth = serviceRegistry.authservice('file');

// Create user
await auth.createUser({username: 'john', password: 'secret', email: 'john@example.com'});

// Authenticate
const result = await auth.authenticateUser('john', 'secret');
if (result.user) {
  console.log('Login success:', result.user);
}

// With Passport
app.use(session({secret: 'secret', resave: false, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

const {configurePassport} = auth.passportConfigurator(auth.getAuthStrategy);
configurePassport(passport);

app.post('/login', passport.authenticate('local'), (req, res) => {
  res.json({success: true, user: req.user});
});
```

## Initialization Options

```javascript
serviceRegistry.initialize(app, eventEmitter, {
  logDir: './.noobly-core/logs',
  dataDir: './.noobly-core/data',
  apiKeys: ['key1', 'key2'],
  requireApiKey: true,
  excludePaths: ['/services/*/status', '/public/*'],
  security: {
    apiKeyAuth: {apiKeys: [...], requireApiKey: true, excludePaths: [...]},
    servicesAuth: {enabled: true}
  }
});
```

## Environment Variables

```bash
NODE_ENV=production
SESSION_SECRET=your-secret
NOOBLY_API_KEYS=key1,key2,key3
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=my-bucket
AWS_REGION=us-east-1
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OLLAMA_URL=http://localhost:11434
```

## Development Commands

```bash
npm start              # Start app on port 3001
npm run dev:web       # Auto-reload with nodemon
npm test              # Run Jest tests
npm run test-load     # Load tests
npm run kill          # Kill process on 3001
```

## Event System

```javascript
const eventEmitter = serviceRegistry.getEventEmitter();

eventEmitter.on('cache:put', (data) => console.log('Cached:', data.key));
eventEmitter.on('ai:usage', (data) => console.log('Tokens:', data.tokens));
eventEmitter.on('workflow:complete', (data) => console.log('Done:', data.name));
```

## Common Mistakes

| Mistake | Correct |
|---------|---------|
| `serviceRegistry.cache() before initialize()` | Call `initialize()` first |
| `dataService.put('key', value)` | Use `dataService.add('container', value)` |
| `cache('Memory')` (case) | Use `cache('memory')` |
| `initialize(app, {apiKeys: [...]}, emitter)` | Use `initialize(app, emitter, {apiKeys: [...]})` |
| Forgetting `await` on async calls | Always await async methods |

## Web Dashboard

Access at: `http://localhost:3001/services/`
Provides: Service overview, API testing, analytics, status monitoring

## Key Files

| Item | Path |
|------|------|
| ServiceRegistry | `index.js` |
| Services | `src/{service}/` |
| Tests | `tests/` |
| Logs | `.noobly-core/logs/` |
| Data | `.noobly-core/data/` |

## Notes

- All services use CommonJS (`module.exports`)
- Requires Node.js >=12.11.0
- ISC License
- GitHub: https://github.com/nooblyjs/nooblyjs-core
- NPM: https://www.npmjs.com/package/noobly-core
