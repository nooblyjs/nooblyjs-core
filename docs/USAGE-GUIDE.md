# Noobly JS Core - Usage Guide

This document provides detailed examples and best practices for integrating and using Noobly JS Core in your applications.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Service Registry Initialization](#service-registry-initialization)
3. [Service Usage Examples](#service-usage-examples)
4. [Advanced Patterns](#advanced-patterns)
5. [Real-World Scenarios](#real-world-scenarios)
6. [Error Handling](#error-handling)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Performance Tips](#performance-tips)
9. [Testing with the Library](#testing-with-the-library)

---

## Installation & Setup

### NPM Installation

```bash
npm install nooblyjs-core
```

### Basic Import

```javascript
const serviceRegistry = require('nooblyjs-core');
```

The library exports a singleton `ServiceRegistry` instance that manages all services.

---

## Service Registry Initialization

### Minimal Setup

For development or simple applications:

```javascript
const express = require('express');
const { EventEmitter } = require('events');
const serviceRegistry = require('nooblyjs-core');

const app = express();
const eventEmitter = new EventEmitter();

// Minimal initialization
serviceRegistry.initialize(app, eventEmitter, {});

// Start using services
const logger = serviceRegistry.logger('memory');
logger.info('Application started');

app.listen(3000, () => {
  logger.info('Server running on port 3000');
});
```

### Production Setup

For production applications with security and persistence:

```javascript
const express = require('express');
const path = require('node:path');
const { EventEmitter } = require('events');
const serviceRegistry = require('nooblyjs-core');

const app = express();
const eventEmitter = new EventEmitter();

// Comprehensive configuration
const options = {
  // Logging configuration
  logDir: path.join(__dirname, './logs'),

  // Data persistence
  dataDir: path.join(__dirname, './data'),

  // API Key authentication
  apiKeys: process.env.API_KEYS?.split(',') || [],
  requireApiKey: process.env.NODE_ENV === 'production',
  excludePaths: [
    '/health',
    '/metrics',
    '/api/public/*',
    '/services/authservice/api/login',
    '/services/authservice/api/register'
  ],

  // Security configuration
  security: {
    apiKeyAuth: {
      requireApiKey: true,
      excludePaths: ['/health']
    },
    servicesAuth: {
      requireLogin: true
    }
  }
};

serviceRegistry.initialize(app, eventEmitter, options);

// Set up event listeners
const eventEmitter = serviceRegistry.getEventEmitter();
eventEmitter.on('error', (error) => {
  console.error('Service error:', error);
});

app.listen(process.env.PORT || 3000);
```

---

## Service Usage Examples

### 1. Logging Service

#### Basic Logging

```javascript
const logger = serviceRegistry.logger('file', {
  logDir: './logs',
  level: 'info'
});

// Log at different levels
logger.debug('Debug message', { requestId: '123' });
logger.info('User logged in', { userId: 'user-456' });
logger.warn('Rate limit approaching', { userId: 'user-456', remaining: 10 });
logger.error('Database connection failed', { error: 'ECONNREFUSED' });
```

#### Using Logger in Route Handler

```javascript
app.get('/api/users/:id', (req, res) => {
  const logger = serviceRegistry.logger('file');

  try {
    logger.info('Fetching user', { userId: req.params.id });
    // fetch user logic
    logger.info('User fetched successfully', { userId: req.params.id });
    res.json(user);
  } catch (error) {
    logger.error('Failed to fetch user', {
      userId: req.params.id,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Analytics

```javascript
const logger = serviceRegistry.logger('file');

// Get log statistics
const stats = logger.analytics.getAnalytics();
console.log(`Total logs: ${stats.totalLogs}`);
console.log(`Info: ${stats.infoCount}, Warnings: ${stats.warnCount}, Errors: ${stats.errorCount}`);
```

### 2. Caching Service

#### Basic Caching

```javascript
const cache = serviceRegistry.cache('memory');

// Set a value
await cache.set('user:123', {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com'
});

// Get a value
const user = await cache.get('user:123');

// Check existence
const exists = await cache.has('user:123');

// Delete
await cache.delete('user:123');

// Clear all
await cache.clear();
```

#### Redis Caching in Production

```javascript
const cache = serviceRegistry.cache('redis', {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  ttl: 3600 // 1 hour default TTL
});

// Use exactly like memory cache
await cache.set('session:abc123', sessionData);
const session = await cache.get('session:abc123');
```

#### Cache Aside Pattern

```javascript
async function getUserData(userId) {
  const cache = serviceRegistry.cache('redis');
  const cacheKey = `user:${userId}`;

  // Try cache first
  let user = await cache.get(cacheKey);
  if (user) {
    console.log('Cache hit for user:', userId);
    return user;
  }

  // Cache miss - fetch from database
  console.log('Cache miss for user:', userId);
  user = await fetchUserFromDatabase(userId);

  // Store in cache
  await cache.set(cacheKey, user);

  return user;
}

// Usage in route
app.get('/api/users/:id', async (req, res) => {
  const user = await getUserData(req.params.id);
  res.json(user);
});
```

#### Memcached for Distributed Caching

```javascript
const cache = serviceRegistry.cache('memcached', {
  servers: ['localhost:11211'],
  keyPrefix: 'myapp:'
});

// Compatible API across all cache providers
await cache.set('key', 'value', { ttl: 300 });
const value = await cache.get('key');
```

### 3. Data Service

#### In-Memory Data Store

```javascript
const dataService = serviceRegistry.dataService('memory');

// Create
const userId = await dataService.create('users', {
  name: 'Jane Smith',
  email: 'jane@example.com',
  role: 'admin'
});

// Read
const user = await dataService.read('users', userId);

// Update
await dataService.update('users', userId, {
  role: 'user'
});

// Delete
await dataService.delete('users', userId);

// List all
const allUsers = await dataService.list('users');

// Query
const admins = await dataService.query('users', { role: 'admin' });
```

#### MongoDB Integration

```javascript
const dataService = serviceRegistry.dataService('mongodb', {
  connectionString: process.env.MONGO_URI || 'mongodb://localhost:27017',
  database: 'myapplication'
});

// Same API as memory provider
const userId = await dataService.create('users', {
  name: 'Bob Johnson',
  email: 'bob@example.com'
});

const user = await dataService.read('users', userId);
```

#### File-Based Persistence

```javascript
const dataService = serviceRegistry.dataService('file', {
  dataDir: './data'
});

// Useful for development and small datasets
await dataService.create('tasks', {
  title: 'Complete project',
  completed: false
});
```

#### Working with Collections

```javascript
const dataService = serviceRegistry.dataService('mongodb');

// Different collections
const users = await dataService.list('users');
const products = await dataService.list('products');
const orders = await dataService.list('orders');

// Each collection is separate
await dataService.create('products', {
  name: 'Laptop',
  price: 999.99,
  stock: 50
});

const product = await dataService.read('products', productId);
```

### 4. Queueing Service

#### In-Memory Queuing

```javascript
const queue = serviceRegistry.queue('memory');

// Enqueue a job
const jobId = await queue.enqueue('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome'
});

// Process queue
queue.process('send-email', async (job) => {
  console.log('Sending email to:', job.data.to);
  // send email logic
  return { sent: true };
});

// Get job status
const status = await queue.getJobStatus(jobId);
console.log('Job status:', status); // 'pending', 'processing', 'completed', 'failed'
```

#### Redis Queue for Distributed Processing

```javascript
const queue = serviceRegistry.queue('redis', {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

// Enqueue from one process
app.post('/api/send-notification', async (req, res) => {
  const jobId = await queue.enqueue('send-notification', {
    userId: req.body.userId,
    message: req.body.message
  });
  res.json({ jobId });
});

// Process from another process (worker)
queue.process('send-notification', async (job) => {
  const { userId, message } = job.data;
  await sendNotificationToUser(userId, message);
  console.log('Notification sent to user:', userId);
});
```

#### Retry Logic

```javascript
const queue = serviceRegistry.queue('redis');

// Enqueue with retry configuration
const jobId = await queue.enqueue('download-file', {
  url: 'https://example.com/file.zip',
  destination: '/uploads/file.zip'
}, {
  retries: 3,
  backoff: 'exponential'
});

// Process with error handling
queue.process('download-file', async (job) => {
  try {
    await downloadFile(job.data);
    return { success: true };
  } catch (error) {
    if (job.attemptsMade < job.opts.retries) {
      throw error; // Triggers retry
    }
    // Max retries exceeded, log failure
    console.error('Download failed after retries:', error);
    throw error;
  }
});
```

### 5. Workflow Service

#### Simple Workflow

```javascript
const workflow = serviceRegistry.workflow('memory');

// Define workflow steps
const workflow = {
  name: 'order-processing',
  steps: [
    {
      id: 'validate-order',
      handler: async (context) => {
        console.log('Validating order:', context.orderId);
        if (!context.items || context.items.length === 0) {
          throw new Error('Order must have items');
        }
        return { validated: true };
      }
    },
    {
      id: 'calculate-total',
      handler: async (context) => {
        const total = context.items.reduce((sum, item) => {
          return sum + (item.price * item.quantity);
        }, 0);
        return { total };
      }
    },
    {
      id: 'process-payment',
      handler: async (context) => {
        console.log('Processing payment of $' + context.total);
        // payment logic
        return { paymentId: 'pay-123', status: 'completed' };
      }
    },
    {
      id: 'send-confirmation',
      handler: async (context) => {
        console.log('Sending confirmation to:', context.email);
        // send email
        return { sent: true };
      }
    }
  ]
};

// Execute workflow
try {
  const result = await workflow.execute(workflow, {
    orderId: 'order-123',
    items: [
      { sku: 'SKU1', price: 29.99, quantity: 2 },
      { sku: 'SKU2', price: 49.99, quantity: 1 }
    ],
    email: 'customer@example.com'
  });

  console.log('Workflow completed:', result);
  // Output: { total: 109.97, paymentId: 'pay-123', status: 'completed', sent: true }
} catch (error) {
  console.error('Workflow failed:', error.message);
}
```

#### Conditional Workflow

```javascript
const workflow = serviceRegistry.workflow('memory');

const checkoutWorkflow = {
  name: 'checkout',
  steps: [
    {
      id: 'check-inventory',
      handler: async (context) => {
        const dataService = serviceRegistry.dataService('mongodb');
        const product = await dataService.read('products', context.productId);

        if (product.stock < context.quantity) {
          context.outOfStock = true;
          return { available: false };
        }
        context.outOfStock = false;
        return { available: true };
      }
    },
    {
      id: 'apply-discount',
      condition: (context) => context.applyCoupon === true,
      handler: async (context) => {
        const discount = context.subtotal * 0.1; // 10% discount
        return { discount };
      }
    },
    {
      id: 'send-out-of-stock-email',
      condition: (context) => context.outOfStock === true,
      handler: async (context) => {
        console.log('Sending out of stock notification');
        return { notified: true };
      }
    }
  ]
};

const result = await workflow.execute(checkoutWorkflow, {
  productId: 'prod-123',
  quantity: 5,
  subtotal: 100,
  applyCoupon: true
});
```

### 6. Scheduling Service

#### Schedule Tasks

```javascript
const scheduler = serviceRegistry.scheduling('memory');

// Schedule a task to run every day at 2 AM
scheduler.schedule('0 2 * * *', async () => {
  const logger = serviceRegistry.logger('file');
  logger.info('Running daily cleanup task');

  const dataService = serviceRegistry.dataService('mongodb');
  const oldRecords = await dataService.query('logs', {
    createdAt: { $lt: Date.now() - (30 * 24 * 60 * 60 * 1000) }
  });

  for (const record of oldRecords) {
    await dataService.delete('logs', record.id);
  }

  logger.info('Cleanup completed', { deleted: oldRecords.length });
});

// Schedule with interval (every 5 minutes)
scheduler.scheduleInterval('send-pending-emails', 5 * 60 * 1000, async () => {
  const queue = serviceRegistry.queue('redis');
  await queue.enqueue('send-email', { /* ... */ });
});

// One-time scheduled execution (in 1 hour)
scheduler.scheduleOnce('generate-report', Date.now() + 60 * 60 * 1000, async () => {
  console.log('Generating report');
  // report generation logic
});
```

### 7. Search Service

#### Full-Text Search

```javascript
const search = serviceRegistry.searching('memory');
const dataService = serviceRegistry.dataService('mongodb');

// Index documents
const documents = await dataService.list('articles');
documents.forEach(doc => {
  search.index(doc.id, {
    title: doc.title,
    content: doc.content,
    author: doc.author,
    tags: doc.tags
  });
});

// Search
const results = search.search('typescript tutorial', {
  fields: ['title', 'content'],
  limit: 10
});

console.log('Found articles:', results.length);
results.forEach(result => {
  console.log(`- ${result.title} (relevance: ${result.score})`);
});
```

### 8. File Operations Service

#### Local File Operations

```javascript
const filing = serviceRegistry.filing('local', {
  baseDir: './uploads'
});

// Upload/Write file
const filePath = await filing.write('documents/report.pdf', fileBuffer);

// Read file
const content = await filing.read('documents/report.pdf');

// Delete file
await filing.delete('documents/report.pdf');

// List files
const files = await filing.list('documents');

// Check if exists
const exists = await filing.exists('documents/report.pdf');
```

#### S3 Cloud Storage

```javascript
const filing = serviceRegistry.filing('s3', {
  bucket: process.env.AWS_BUCKET,
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Upload to S3
await filing.write('user-uploads/profile.jpg', imageBuffer);

// Download from S3
const imageBuffer = await filing.read('user-uploads/profile.jpg');

// Delete from S3
await filing.delete('user-uploads/old-file.txt');
```

#### Git-Based File Storage

```javascript
const filing = serviceRegistry.filing('git', {
  repository: 'https://github.com/org/repo.git',
  branch: 'main',
  commitMessage: 'Update files'
});

// Commit changes to Git
await filing.write('config/settings.json', JSON.stringify(settings));

// Files are committed to Git automatically
```

### 9. Authentication Service

#### File-Based Authentication

```javascript
const auth = serviceRegistry.authservice('file', {
  dataDir: './users'
});

// Register user
await auth.register({
  username: 'john.doe',
  password: 'securePassword123',
  email: 'john@example.com'
});

// Login
const loginResult = await auth.authenticate({
  username: 'john.doe',
  password: 'securePassword123'
});

const token = loginResult.token;

// Verify token
const user = await auth.verifyToken(token);
console.log('Authenticated user:', user.username);

// Logout
await auth.logout(token);
```

#### Using Auth in Express Routes

```javascript
const auth = serviceRegistry.authservice('file');

// Middleware to protect routes
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const user = await auth.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Protected route
app.get('/api/profile', authMiddleware, (req, res) => {
  res.json({
    username: req.user.username,
    email: req.user.email
  });
});

// Login route
app.post('/api/login', async (req, res) => {
  try {
    const result = await auth.authenticate({
      username: req.body.username,
      password: req.body.password
    });
    res.json({ token: result.token });
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});
```

#### Google OAuth

```javascript
const auth = serviceRegistry.authservice('google', {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/google/callback'
});

// Google login route (handled by Passport internally)
app.get('/auth/google',
  auth.authenticate('google', { scope: ['profile', 'email'] })
);

// Google callback
app.get('/auth/google/callback',
  auth.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);
```

### 10. AI Service

#### Using Claude AI

```javascript
const ai = serviceRegistry.aiservice('claude', {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022'
});

// Simple prompt
const response = await ai.prompt('What is the capital of France?');
console.log(response);

// Prompt with context
const userText = 'The quick brown fox jumps over the lazy dog';
const analysis = await ai.prompt(
  `Analyze this text for sentiment: ${userText}`,
  { maxTokens: 200 }
);

// Multi-turn conversation
const conversation = [
  { role: 'user', content: 'What is machine learning?' },
  { role: 'assistant', content: 'Machine learning is...' },
  { role: 'user', content: 'Can you give me an example?' }
];

const result = await ai.prompt(conversation, {
  maxTokens: 500,
  temperature: 0.7
});
```

#### Using OpenAI

```javascript
const ai = serviceRegistry.aiservice('chatgpt', {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});

const response = await ai.prompt('Generate a product description for a laptop');
console.log(response);
```

---

## Advanced Patterns

### Multi-Instance Services

Create multiple independent instances of the same service:

```javascript
// Session cache with short TTL
const sessionCache = serviceRegistry.cache('redis', {
  instanceName: 'sessions',
  ttl: 1800 // 30 minutes
});

// Data cache with longer TTL
const dataCache = serviceRegistry.cache('redis', {
  instanceName: 'data',
  ttl: 86400 // 24 hours
});

// Image cache
const imageCache = serviceRegistry.cache('redis', {
  instanceName: 'images',
  ttl: 604800 // 7 days
});

// Each instance operates independently
await sessionCache.set('user:123:session', sessionData);
await dataCache.set('products:all', products);
await imageCache.set('avatar:user:123', imageUrl);
```

### Dependency Injection Pattern

```javascript
class UserService {
  constructor(dependencies) {
    this.dataService = dependencies.dataService;
    this.cache = dependencies.cache;
    this.logger = dependencies.logger;
  }

  async getUser(userId) {
    this.logger.info('Getting user', { userId });

    // Try cache
    let user = await this.cache.get(`user:${userId}`);
    if (user) return user;

    // Fetch from database
    user = await this.dataService.read('users', userId);

    // Cache result
    await this.cache.set(`user:${userId}`, user);

    return user;
  }

  async createUser(userData) {
    this.logger.info('Creating user', { userData });

    const userId = await this.dataService.create('users', userData);

    // Invalidate cache
    await this.cache.delete('users:all');

    this.logger.info('User created', { userId });
    return userId;
  }
}

// Usage
const userService = new UserService({
  dataService: serviceRegistry.dataService('mongodb'),
  cache: serviceRegistry.cache('redis'),
  logger: serviceRegistry.logger('file')
});

const user = await userService.getUser('user-123');
```

### Error Handling with Event Emitters

```javascript
const eventEmitter = serviceRegistry.getEventEmitter();

// Global error handler
eventEmitter.on('service:error', (error) => {
  console.error('Service error:', {
    service: error.serviceName,
    message: error.message,
    timestamp: new Date()
  });

  // Alert ops team
  // sendSlackNotification(error);
});

// Service-specific handlers
eventEmitter.on('cache:error', (error) => {
  console.error('Cache error:', error);
  // Fallback logic
});

eventEmitter.on('database:error', (error) => {
  console.error('Database error:', error);
  // Use replica or cache fallback
});
```

### Transaction Pattern with Rollback

```javascript
async function transferFunds(fromUserId, toUserId, amount) {
  const dataService = serviceRegistry.dataService('mongodb');
  const cache = serviceRegistry.cache('redis');

  try {
    // Start transaction
    const transactionId = `txn:${Date.now()}`;

    // Debit from user
    const fromUser = await dataService.read('users', fromUserId);
    await dataService.update('users', fromUserId, {
      balance: fromUser.balance - amount
    });

    // Credit to user
    const toUser = await dataService.read('users', toUserId);
    await dataService.update('users', toUserId, {
      balance: toUser.balance + amount
    });

    // Record transaction
    await dataService.create('transactions', {
      id: transactionId,
      from: fromUserId,
      to: toUserId,
      amount: amount,
      status: 'completed'
    });

    // Invalidate cache
    await cache.delete(`user:${fromUserId}`);
    await cache.delete(`user:${toUserId}`);

    return { success: true, transactionId };
  } catch (error) {
    // Log error
    const logger = serviceRegistry.logger('file');
    logger.error('Transfer failed', { fromUserId, toUserId, amount, error });

    throw error;
  }
}
```

---

## Real-World Scenarios

### E-Commerce Application

```javascript
const express = require('express');
const serviceRegistry = require('nooblyjs-core');

const app = express();
const logger = serviceRegistry.logger('file');
const cache = serviceRegistry.cache('redis');
const dataService = serviceRegistry.dataService('mongodb');
const queue = serviceRegistry.queue('redis');
const ai = serviceRegistry.aiservice('claude');

// Get products with caching
app.get('/api/products', async (req, res) => {
  try {
    const cacheKey = 'products:all';
    let products = await cache.get(cacheKey);

    if (!products) {
      products = await dataService.list('products');
      await cache.set(cacheKey, products, { ttl: 3600 });
    }

    res.json(products);
  } catch (error) {
    logger.error('Failed to fetch products', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create order with workflow
app.post('/api/orders', async (req, res) => {
  try {
    const order = {
      userId: req.user.id,
      items: req.body.items,
      status: 'pending'
    };

    // Create order in database
    const orderId = await dataService.create('orders', order);

    // Queue order processing
    await queue.enqueue('process-order', {
      orderId,
      userId: req.user.id
    });

    // Invalidate user's orders cache
    await cache.delete(`user:${req.user.id}:orders`);

    res.json({ orderId, status: 'processing' });
  } catch (error) {
    logger.error('Failed to create order', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate product description with AI
app.post('/api/products/generate-description', async (req, res) => {
  try {
    const prompt = `Generate a compelling product description for: ${req.body.productName}`;
    const description = await ai.prompt(prompt, { maxTokens: 200 });

    res.json({ description });
  } catch (error) {
    logger.error('Failed to generate description', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process order queue
queue.process('process-order', async (job) => {
  const { orderId, userId } = job.data;
  const dataService = serviceRegistry.dataService('mongodb');

  try {
    // Fetch order
    const order = await dataService.read('orders', orderId);

    // Process payment
    await processPayment(order);

    // Update order status
    await dataService.update('orders', orderId, {
      status: 'paid',
      paidAt: new Date()
    });

    // Send confirmation email
    await queue.enqueue('send-email', {
      to: await getUserEmail(userId),
      template: 'order-confirmation',
      orderId
    });

    logger.info('Order processed', { orderId });
  } catch (error) {
    logger.error('Order processing failed', { orderId, error });
    throw error; // Triggers retry
  }
});

app.listen(3000);
```

### Content Management System

```javascript
const express = require('express');
const serviceRegistry = require('nooblyjs-core');

const app = express();
const logger = serviceRegistry.logger('file');
const dataService = serviceRegistry.dataService('mongodb');
const filing = serviceRegistry.filing('s3');
const search = serviceRegistry.searching('memory');
const auth = serviceRegistry.authservice('file');

// Publish article
app.post('/api/articles', async (req, res) => {
  try {
    const article = {
      title: req.body.title,
      content: req.body.content,
      author: req.user.id,
      status: 'draft',
      createdAt: new Date()
    };

    const articleId = await dataService.create('articles', article);

    logger.info('Article created', { articleId, author: req.user.id });
    res.json({ articleId });
  } catch (error) {
    logger.error('Failed to create article', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload featured image
app.post('/api/articles/:id/image', async (req, res) => {
  try {
    const articleId = req.params.id;
    const filePath = `articles/${articleId}/featured.jpg`;

    await filing.write(filePath, req.files.image.data);

    // Update article with image URL
    await dataService.update('articles', articleId, {
      imageUrl: `https://cdn.example.com/${filePath}`
    });

    res.json({ url: `https://cdn.example.com/${filePath}` });
  } catch (error) {
    logger.error('Failed to upload image', { error });
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Search articles
app.get('/api/articles/search', async (req, res) => {
  try {
    // Index all articles if not already indexed
    const articles = await dataService.query('articles', { status: 'published' });

    articles.forEach(article => {
      search.index(article.id, {
        title: article.title,
        content: article.content,
        author: article.author
      });
    });

    // Perform search
    const results = search.search(req.query.q, { limit: 20 });

    res.json(results);
  } catch (error) {
    logger.error('Search failed', { query: req.query.q, error });
    res.status(500).json({ error: 'Search failed' });
  }
});

app.listen(3000);
```

### Real-Time Analytics Platform

```javascript
const express = require('express');
const WebSocket = require('ws');
const serviceRegistry = require('nooblyjs-core');

const app = express();
const measuring = serviceRegistry.measuring('memory');
const dataService = serviceRegistry.dataService('mongodb');
const logger = serviceRegistry.logger('file');

// Collect event
app.post('/api/events', async (req, res) => {
  try {
    const event = {
      type: req.body.type,
      userId: req.user?.id,
      data: req.body.data,
      timestamp: new Date()
    };

    // Store event
    await dataService.create('events', event);

    // Record metric
    measuring.increment(`event:${event.type}`);
    measuring.histogram(`event:${event.type}:value`, req.body.value);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to record event', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const metrics = measuring.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to fetch analytics', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket for real-time metrics
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  const interval = setInterval(() => {
    const metrics = measuring.getMetrics();
    ws.send(JSON.stringify(metrics));
  }, 1000);

  ws.on('close', () => clearInterval(interval));
});

app.listen(3000);
```

---

## Error Handling

### Basic Error Handling

```javascript
async function safeServiceCall(callback) {
  const logger = serviceRegistry.logger('file');

  try {
    return await callback();
  } catch (error) {
    logger.error('Service call failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Usage
app.get('/api/data', async (req, res) => {
  try {
    const data = await safeServiceCall(async () => {
      const dataService = serviceRegistry.dataService('mongodb');
      return await dataService.list('items');
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Fallback Pattern

```javascript
async function getDataWithFallback(key) {
  const cache = serviceRegistry.cache('redis');
  const dataService = serviceRegistry.dataService('mongodb');
  const logger = serviceRegistry.logger('file');

  try {
    // Try primary data source
    return await dataService.read('items', key);
  } catch (error) {
    logger.warn('Primary data source failed, trying cache', { key, error });

    try {
      // Try cache
      const cached = await cache.get(key);
      if (cached) return cached;
    } catch (cacheError) {
      logger.warn('Cache also failed', { key, cacheError });
    }

    // Both failed
    logger.error('All data sources failed', { key, error });
    throw new Error('Data unavailable');
  }
}
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(handler, options = {}) {
    this.handler = handler;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = null;
  }

  async execute(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await this.handler(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
}

// Usage
const dbCircuitBreaker = new CircuitBreaker(
  async (query) => {
    const dataService = serviceRegistry.dataService('mongodb');
    return await dataService.query('items', query);
  },
  { failureThreshold: 3, resetTimeout: 30000 }
);

app.get('/api/items', async (req, res) => {
  try {
    const items = await dbCircuitBreaker.execute({ status: 'active' });
    res.json(items);
  } catch (error) {
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});
```

---

## Monitoring & Health Checks

Noobly JS Core provides comprehensive health check endpoints for monitoring and orchestration.

### Global Health Endpoints

```bash
# Quick health check (Docker, load balancers)
curl http://localhost:11000/health

# Kubernetes liveness probe
curl http://localhost:11000/health/live

# Kubernetes readiness probe
curl http://localhost:11000/health/ready

# Detailed status report (requires authentication)
curl -H "X-API-Key: your-api-key" \
  http://localhost:11000/health/detailed
```

### Per-Service Health Endpoints

Check the health of individual services:

```javascript
// Example: Check caching service health
const response = await fetch('http://localhost:11000/services/caching/api/health');
const health = await response.json();

console.log(`Caching service status: ${health.status}`);
// Output: Caching service status: healthy
```

**All Available Services:**
- logging, caching, fetching, queueing, notifying, working
- scheduling, measuring, searching, dataservice, filing
- workflow, authservice, aiservice

### Monitoring Pattern

```javascript
const express = require('express');
const app = express();

// Check all service health
app.get('/monitoring/services', async (req, res) => {
  const services = [
    'logging', 'caching', 'fetching', 'queueing', 'dataservice'
  ];

  const health = await Promise.all(
    services.map(async (service) => {
      try {
        const response = await fetch(
          `http://localhost:11000/services/${service}/api/health`
        );
        const data = await response.json();
        return {
          service,
          status: data.status,
          healthy: response.ok
        };
      } catch (error) {
        return {
          service,
          status: 'error',
          healthy: false
        };
      }
    })
  );

  const allHealthy = health.every(h => h.healthy);
  res.status(allHealthy ? 200 : 503).json({
    overall: allHealthy ? 'healthy' : 'unhealthy',
    services: health
  });
});
```

### Kubernetes Integration

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nooblyjs-core
spec:
  containers:
  - name: app
    image: nooblyjs-core:latest
    
    # Liveness probe
    livenessProbe:
      httpGet:
        path: /health/live
        port: 11000
      initialDelaySeconds: 10
      periodSeconds: 10
    
    # Readiness probe
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 11000
      initialDelaySeconds: 5
      periodSeconds: 5
```

### Docker Integration

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:11000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
```

For complete monitoring documentation, see [Health Checks Guide](./design/HEALTH_CHECKS.md).

---

## Performance Tips

### 1. Cache Strategy

```javascript
// Cache frequently accessed data
const cache = serviceRegistry.cache('redis');

async function getCachedData(key, fetchFn, ttl = 3600) {
  const cached = await cache.get(key);
  if (cached) return cached;

  const data = await fetchFn();
  await cache.set(key, data, { ttl });
  return data;
}

// Usage
const product = await getCachedData(
  `product:${productId}`,
  () => dataService.read('products', productId),
  7200 // 2 hours
);
```

### 2. Batch Operations

```javascript
// Don't do this (N+1 queries):
for (const orderId of orderIds) {
  const order = await dataService.read('orders', orderId);
}

// Do this instead (batch query):
const orders = await dataService.query('orders', {
  id: { $in: orderIds }
});
```

### 3. Queue Heavy Operations

```javascript
// Don't process in request:
app.post('/api/process-csv', (req, res) => {
  // processLargeCsv(req.file); // BAD - times out
});

// Queue the work:
app.post('/api/process-csv', async (req, res) => {
  const queue = serviceRegistry.queue('redis');
  const jobId = await queue.enqueue('process-csv', {
    filePath: req.file.path
  });

  res.json({ jobId, status: 'queued' });
});
```

### 4. Connection Pooling

```javascript
// Reuse service instances instead of creating new ones
// DON'T do this:
app.get('/api/data', (req, res) => {
  const cache = serviceRegistry.cache('redis'); // Inefficient
});

// DO this:
const cache = serviceRegistry.cache('redis'); // Created once

app.get('/api/data', (req, res) => {
  // Reuse the same instance
});
```

### 5. Index Important Fields

```javascript
// For data services supporting indexes
const dataService = serviceRegistry.dataService('mongodb');

// Create indexes for frequently queried fields
await dataService.createIndex('users', 'email', { unique: true });
await dataService.createIndex('orders', 'userId');
await dataService.createIndex('orders', 'createdAt');
```

---

## Testing with the Library

### Unit Testing Services

```javascript
const serviceRegistry = require('nooblyjs-core');
const { EventEmitter } = require('events');

describe('User Service', () => {
  let cache;
  let dataService;
  let eventEmitter;

  beforeEach(() => {
    // Reset services for each test
    serviceRegistry.reset();

    eventEmitter = new EventEmitter();
    cache = serviceRegistry.cache('memory');
    dataService = serviceRegistry.dataService('memory');

    // Initialize with mock event emitter
    serviceRegistry.initialize(
      { use: jest.fn() },
      eventEmitter,
      {}
    );
  });

  it('should cache user data', async () => {
    const userId = await dataService.create('users', {
      name: 'Test User',
      email: 'test@example.com'
    });

    // First call hits database
    const user1 = await dataService.read('users', userId);

    // Cache the result
    await cache.set(`user:${userId}`, user1);

    // Second call hits cache
    const user2 = await cache.get(`user:${userId}`);

    expect(user2).toEqual(user1);
  });

  it('should emit events on cache set', async (done) => {
    eventEmitter.once('cache:set', (data) => {
      expect(data.key).toBe('test-key');
      done();
    });

    await cache.set('test-key', 'test-value');
  });

  afterEach(() => {
    serviceRegistry.reset();
  });
});
```

### Integration Testing

```javascript
describe('API Integration', () => {
  let app;
  let server;
  let eventEmitter;

  beforeEach(async () => {
    app = express();
    eventEmitter = new EventEmitter();

    serviceRegistry.initialize(app, eventEmitter, {
      logDir: './test-logs',
      dataDir: './test-data'
    });

    // Setup routes
    setupRoutes(app);

    server = app.listen(3001);
  });

  it('should create and retrieve data', async () => {
    const response = await fetch('http://localhost:3001/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Item' })
    });

    const { itemId } = await response.json();

    const getResponse = await fetch(
      `http://localhost:3001/api/items/${itemId}`
    );
    const item = await getResponse.json();

    expect(item.name).toBe('Test Item');
  });

  afterEach(() => {
    server.close();
    serviceRegistry.reset();
  });
});
```

---

## Summary

Noobly JS Core provides a flexible, modular approach to building scalable backend applications. By understanding these usage patterns and best practices, you can effectively integrate it into your systems to handle:

- **Data Management** - Multiple database backends with consistent API
- **Caching** - In-memory, Redis, Memcached with cache-aside patterns
- **Job Processing** - Queues with retries and error handling
- **Workflows** - Complex orchestration with conditional logic
- **File Operations** - Local, cloud, or git-based storage
- **Authentication** - Multiple auth strategies
- **AI Integration** - Seamless AI model integration
- **Monitoring** - Built-in metrics and analytics

For more information, refer to the main README.md and CLAUDE.md files.
