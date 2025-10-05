# NooblyJS Core - Usage Guide

## Quick Start

### Installation
```bash
npm install noobly-core
```

### Basic Setup
```javascript
const express = require('express');
const serviceRegistry = require('noobly-core');

const app = express();
app.use(express.json());

// Initialize registry
serviceRegistry.initialize(app);

// Get services
const cache = serviceRegistry.cache('memory');
const logger = serviceRegistry.logger('console');
const dataServe = serviceRegistry.dataServe('memory');

app.listen(3000);
```

### With API Keys
```javascript
const apiKey = serviceRegistry.generateApiKey();
serviceRegistry.initialize(app, {
  apiKeys: [apiKey],
  requireApiKey: true,
  excludePaths: ['/services/*/status', '/services/', '/services/*/views/*']
});
```

## Service Registry Architecture

**Core Principles:**
- Singleton Pattern: One instance per service type/provider
- Provider Pattern: Multiple backends (memory, redis, s3, etc.)
- Event-Driven: Global EventEmitter for inter-service communication
- RESTful APIs: Consistent HTTP endpoints

### Available Services

| Service | Providers | Purpose |
|---------|-----------|---------|
| **aiservice** | claude, chatgpt, ollama | LLM integration with token tracking |
| **caching** | memory, redis, memcached | High-performance caching |
| **dataserve** | memory, simpledb, file | JSON document storage with UUIDs |
| **filing** | local, ftp, s3, git, sync | File management |
| **logging** | console, file | Application logging |
| **measuring** | memory | Metrics collection |
| **notifying** | memory | Pub/sub messaging |
| **queueing** | memory | Task queueing |
| **scheduling** | memory | Task scheduling |
| **searching** | memory | Full-text search |
| **workflow** | memory | Multi-step workflows |
| **working** | memory | Background tasks |

## API Usage

### Authentication
Five methods supported:
```bash
# 1. x-api-key header
curl -H "x-api-key: YOUR_KEY" ...

# 2. Authorization Bearer
curl -H "Authorization: Bearer YOUR_KEY" ...

# 3. Authorization ApiKey
curl -H "Authorization: ApiKey YOUR_KEY" ...

# 4. Query parameter
curl "...?api_key=YOUR_KEY"

# 5. api-key header
curl -H "api-key: YOUR_KEY" ...
```

### Caching API
```bash
# Store data
POST /services/caching/api/put/:key
{"value": {...}}

# Retrieve data
GET /services/caching/api/get/:key

# Delete data
DELETE /services/caching/api/delete/:key

# List keys with analytics
GET /services/caching/api/list

# Status (no auth)
GET /services/caching/api/status
```

### DataServe API

Database-style storage with UUIDs and JSON search.

```bash
# Insert into container (returns UUID)
POST /services/dataserve/api/:container
{"name": "John", "status": "active"}
# Response: {"id": "uuid-here"}

# Retrieve by UUID
GET /services/dataserve/api/:container/:uuid

# Delete by UUID
DELETE /services/dataserve/api/:container/:uuid

# JSON Search - Custom predicate
POST /services/dataserve/api/jsonFind/:container
{"predicate": "obj.status === 'active'"}

# JSON Search - By path
GET /services/dataserve/api/jsonFindByPath/:container/:path/:value

# JSON Search - Multi-criteria
POST /services/dataserve/api/jsonFindByCriteria/:container
{"status": "active", "profile.role": "developer"}
```

### Filing API
```bash
# Upload
POST /services/filing/api/upload/:path
[multipart file data]

# Download
GET /services/filing/api/download/:path

# Delete
DELETE /services/filing/api/remove/:path
```

### Workflow API
```bash
# Define workflow
POST /services/workflow/api/defineworkflow
{"name": "myWorkflow", "steps": ["/path/step1.js", "/path/step2.js"]}

# Start execution
POST /services/workflow/api/start
{"name": "myWorkflow", "data": {...}}
```

### Queue API
```bash
# Enqueue task
POST /services/queueing/api/enqueue
{task data}

# Dequeue task
GET /services/queueing/api/dequeue

# Queue size
GET /services/queueing/api/size
```

### AI Service API

**Configuration**: Requires API keys/connection info in constructor.

```javascript
// Initialize with credentials
const claudeAI = serviceRegistry.aiservice('claude', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  tokensStorePath: './.data/ai-tokens-claude.json'
});

const chatGPT = serviceRegistry.aiservice('chatgpt', {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-3.5-turbo'
});

const ollama = serviceRegistry.aiservice('ollama', {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2'
});

// Send prompt
const response = await claudeAI.prompt('Your prompt here', {
  maxTokens: 1000,
  temperature: 0.7
});
// Returns: {content, usage: {promptTokens, completionTokens, totalTokens, estimatedCost}}

// Get analytics
const analytics = claudeAI.getAnalytics();
// Returns: {modelUsage, totalSessions, totalCost, totalTokens}
```

**API Endpoints:**
```bash
# Send prompt
POST /services/ai/api/prompt
{"prompt": "...", "maxTokens": 500, "temperature": 0.7}

# Get analytics
GET /services/ai/api/analytics

# Status
GET /services/ai/api/status
```

## Programmatic Usage

### Service Configuration
```javascript
// Memory providers (dev/testing)
const cache = serviceRegistry.cache('memory');
const dataServe = serviceRegistry.dataServe('memory');

// Production providers
const cache = serviceRegistry.cache('redis', {
  host: 'redis.example.com',
  port: 6379,
  password: 'password',
  keyPrefix: 'myapp:'
});

const dataServe = serviceRegistry.dataServe('simpledb', {
  domain: 'myapp-data',
  region: 'us-east-1'
});

const filing = serviceRegistry.filing('s3', {
  bucket: 'myapp-files',
  region: 'us-west-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
```

### Caching Patterns

**Basic Operations:**
```javascript
// Store with TTL
await cache.put('session:123', userData, 3600); // 1 hour

// Retrieve
const userData = await cache.get('session:123');

// Delete
await cache.delete('session:123');

// Analytics
const analytics = cache.getAnalytics();
```

**Session Management:**
```javascript
const sessionData = {userId: '123', roles: ['admin']};
await cache.put(`session:${token}`, sessionData, 86400); // 24h

const session = await cache.get(`session:${token}`);
if (session) {
  session.lastActivity = new Date().toISOString();
  await cache.put(`session:${token}`, session, 86400);
}
```

**Rate Limiting:**
```javascript
async function checkRateLimit(clientId, limit = 100, windowSec = 3600) {
  const key = `rate:${clientId}`;
  const current = await cache.get(key) || 0;

  if (current >= limit) throw new Error('Rate limit exceeded');

  await cache.put(key, current + 1, windowSec);
  return {remaining: limit - current - 1};
}
```

### DataServe Patterns

**Database-Style Operations:**
```javascript
// Insert and get UUID
const userUuid = await dataServe.add('users', {
  name: 'John',
  email: 'john@example.com',
  profile: {department: 'engineering', role: 'developer'}
});

// Retrieve by UUID
const user = await dataServe.getByUuid('users', userUuid);

// Delete by UUID
await dataServe.remove('users', userUuid);
```

**JSON Search:**
```javascript
// Custom predicate
const activeEngineers = await dataServe.jsonFind('users',
  user => user.status === 'active' && user.profile.department === 'engineering'
);

// Path-based
const developers = await dataServe.jsonFindByPath('users', 'profile.role', 'developer');

// Multi-criteria
const results = await dataServe.jsonFindByCriteria('users', {
  'status': 'active',
  'profile.department': 'engineering'
});
```

**User Management Example:**
```javascript
async function createUser(userData) {
  // Check existing
  const existing = await dataServe.jsonFindByPath('users', 'email', userData.email);
  if (existing.length > 0) throw new Error('User exists');

  // Create user
  const user = {
    ...userData,
    id: Date.now(),
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  const uuid = await dataServe.add('users', user);
  return {uuid, user};
}

async function findUsersByDepartment(dept) {
  return await dataServe.jsonFindByPath('users', 'profile.department', dept);
}
```

### Filing Patterns

**Document Upload/Download:**
```javascript
const fs = require('fs');

// Upload
const fileStream = fs.createReadStream('./document.pdf');
await filing.create('documents/report.pdf', fileStream);

// Download
const downloadStream = await filing.read('documents/report.pdf');

// Check exists
const exists = await filing.exists('documents/report.pdf');

// Get metadata
const metadata = await filing.getMetadata('documents/report.pdf');

// Delete
await filing.delete('documents/report.pdf');
```

**Document Manager:**
```javascript
async function uploadDocument(userId, file, metadata = {}) {
  const filename = `${Date.now()}_${file.originalname}`;
  const filePath = `users/${userId}/documents/${filename}`;

  const fileStream = require('stream').Readable.from(file.buffer);
  await filing.create(filePath, fileStream);

  const record = {
    userId, filename, filePath,
    size: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date().toISOString(),
    metadata
  };

  const uuid = await dataServe.add('documents', record);
  return {uuid, filePath, document: record};
}

async function downloadDocument(docUuid) {
  const doc = await dataServe.getByUuid('documents', docUuid);
  if (!doc) throw new Error('Document not found');

  const stream = await filing.read(doc.filePath);
  const metadata = await filing.getMetadata(doc.filePath);

  return {stream, document: doc, metadata};
}
```

### AI Service Integration

```javascript
// Content generation
async function generateBlogPost(topic, keywords) {
  const prompt = `Write a blog post about ${topic}. Include: ${keywords.join(', ')}`;

  const response = await claudeAI.prompt(prompt, {
    maxTokens: 2000,
    temperature: 0.8
  });

  return {
    content: response.content,
    tokensUsed: response.usage.totalTokens,
    cost: response.usage.estimatedCost
  };
}

// Code review
async function reviewCode(code, language) {
  const prompt = `Review this ${language} code:\n\n${code}`;
  const response = await chatGPT.prompt(prompt, {maxTokens: 1500});
  return response.content;
}

// Batch processing with local LLM
async function summarizeDocuments(documents) {
  const summaries = [];
  for (const doc of documents) {
    const response = await ollama.prompt(`Summarize:\n${doc.content}`, {
      maxTokens: 500
    });
    summaries.push({documentId: doc.id, summary: response.content});
  }
  return summaries;
}
```

### Workflow Orchestration

```javascript
const workflow = serviceRegistry.workflow('memory');

// Define steps
const steps = [
  path.resolve(__dirname, './steps/validateInput.js'),
  path.resolve(__dirname, './steps/processData.js'),
  path.resolve(__dirname, './steps/saveResults.js')
];

await workflow.defineWorkflow('dataProcessing', steps);

// Execute
workflow.runWorkflow('dataProcessing', {inputData: rawData}, (result) => {
  console.log('Workflow completed:', result);
});
```

### Pub/Sub Messaging

```javascript
const notifying = serviceRegistry.notifying('memory');

// Create topic
notifying.createTopic('user-events');

// Subscribe
notifying.subscribe('user-events', (message) => {
  console.log('Event:', message);
  // Handle event
});

notifying.subscribe('user-events', (message) => {
  analyticsService.track(message);
});

// Publish
notifying.notify('user-events', {
  type: 'user-registered',
  userId: '123',
  timestamp: new Date().toISOString()
});
```

**Event System Example:**
```javascript
// Setup subscribers for e-commerce
notifying.createTopic('orders');
notifying.createTopic('inventory');
notifying.createTopic('payments');

notifying.subscribe('orders', async (event) => {
  switch (event.type) {
    case 'order_placed':
      await processOrder(event.data);
      break;
    case 'order_shipped':
      await sendShippingNotification(event.data);
      break;
  }
});

notifying.subscribe('payments', async (event) => {
  if (event.type === 'payment_completed') {
    notifying.notify('orders', {
      type: 'payment_confirmed',
      orderId: event.data.orderId
    });
  }
});

// Publish events
notifying.notify('orders', {type: 'order_placed', data: orderData});
```

### Queue Processing

```javascript
const queueing = serviceRegistry.queueing('memory');

// Add tasks
await queueing.enqueue({
  taskType: 'sendEmail',
  recipient: 'user@example.com',
  template: 'welcome'
});

// Process tasks
async function processQueue() {
  while (await queueing.size() > 0) {
    const task = await queueing.dequeue();
    await handleTask(task);
  }
}
```

### Scheduling

```javascript
const scheduling = serviceRegistry.scheduling('memory');

// Schedule one-time task
scheduling.scheduleTask('backup-db', () => {
  backupDatabase();
}, new Date(Date.now() + 3600000)); // 1 hour from now

// Schedule recurring task
scheduling.scheduleRecurring('cleanup', () => {
  cleanupTempFiles();
}, 86400000); // Every 24 hours
```

## Web Interface

NooblyJS includes built-in web UIs for service management:

- **Glass theme**: `/` or `/glass`
- **Flat theme**: `/flat`
- **Material theme**: `/material`
- **Minimalist theme**: `/minimalist`
- **Shadcn theme**: `/shadcn`

## Configuration

### Initialize Options
```javascript
serviceRegistry.initialize(app, {
  // Security
  apiKeys: ['key1', 'key2'],
  requireApiKey: true,
  excludePaths: ['/services/*/status', '/public/*'],

  // Event system (optional)
  eventEmitter: customEventEmitter
});
```

### Service-Specific Options

**Redis Cache:**
```javascript
{host: 'localhost', port: 6379, password: 'secret', keyPrefix: 'app:'}
```

**S3 Filing:**
```javascript
{bucket: 'my-bucket', region: 'us-east-1', accessKeyId: '...', secretAccessKey: '...'}
```

**AI Services:**
```javascript
{apiKey: 'sk-...', model: 'claude-3-5-sonnet-20241022', tokensStorePath: './tokens.json'}
```

**File Logging:**
```javascript
{filename: './app.log', maxFiles: 5, maxSize: '10m'}
```

## Event System

Global EventEmitter for inter-service communication:

```javascript
const eventEmitter = serviceRegistry.getEventEmitter();

// Listen to service events
eventEmitter.on('cache:put', (data) => {
  console.log('Cache updated:', data.key);
});

eventEmitter.on('ai:usage', (data) => {
  console.log('AI tokens used:', data.tokens);
});

eventEmitter.on('workflow:complete', (data) => {
  console.log('Workflow done:', data.name);
});

// Emit custom events
eventEmitter.emit('custom:event', {data: 'value'});
```

## Best Practices

### 1. Service Selection
- Use **memory** providers for development/testing
- Use **redis/memcached** for distributed caching in production
- Use **s3** for cloud file storage at scale
- Use **file** provider for simple persistent storage

### 2. Error Handling
```javascript
try {
  const data = await cache.get('key');
  if (!data) {
    // Handle cache miss
  }
} catch (error) {
  logger.error('Cache error:', error);
  // Fallback logic
}
```

### 3. API Key Management
```javascript
// Generate secure keys
const apiKey = serviceRegistry.generateApiKey();

// Store in environment variables
process.env.API_KEY = apiKey;

// Exclude public paths
excludePaths: ['/health', '/services/*/status', '/docs']
```

### 4. Performance
- Set appropriate TTLs for cached data
- Use connection pooling for Redis
- Implement rate limiting for APIs
- Monitor service metrics via measuring service

### 5. Security
- Always use API keys in production
- Validate input data before storage
- Sanitize file paths to prevent directory traversal
- Use environment variables for credentials

## Testing

### Unit Tests
```bash
npm test
```

### Load Tests
```bash
npm run test-load
```

### Manual API Tests
Use `.http` files in `tests-api/` directory with REST clients.

## Deployment

### Docker
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

### Environment Variables
```bash
NODE_ENV=production
PORT=3000
REDIS_HOST=redis.example.com
REDIS_PORT=6379
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
ANTHROPIC_API_KEY=...
```

## Troubleshooting

### Service Not Initializing
- Ensure `serviceRegistry.initialize(app)` is called before accessing services
- Check provider name is valid (e.g., 'memory', 'redis', not 'Memory')

### Cache Not Working
- Verify Redis connection if using redis provider
- Check if data exceeds size limits
- Confirm TTL is set appropriately

### File Upload Fails
- Ensure base directory exists for local provider
- Check S3 credentials and permissions
- Verify file size limits

### AI Service Errors
- Confirm API keys are set in constructor options
- Check token limits aren't exceeded
- Verify network connectivity to AI provider

### API Key Issues
- Ensure key is passed in correct header/parameter
- Check path isn't excluded from auth
- Verify key is in apiKeys array

## Error Response Format

All APIs return consistent error responses:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `MISSING_API_KEY` - API key required but not provided
- `INVALID_API_KEY` - API key invalid
- `KEY_NOT_FOUND` - Cache/data key doesn't exist
- `FILE_NOT_FOUND` - File doesn't exist
- `VALIDATION_ERROR` - Input validation failed

## Additional Resources

- GitHub: https://github.com/StephenBooysen/nooblyjs-core
- NPM: https://www.npmjs.com/package/noobly-core
- Documentation: Generated via JSDoc in `docs/` directory
