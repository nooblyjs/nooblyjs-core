/**
 * @fileoverview Caching Service Demo
 * Example showing how to use the NooblyJS Caching Service
 * @author NooblyJS Team
 * @version 1.0.0
 */

const express = require('express');
const serviceRegistry = require('../index');

const app = express();

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the service registry
const eventEmitter = require('events');
const globalEventEmitter = new eventEmitter();

serviceRegistry.initialize(app, globalEventEmitter, {
  // Optional API key authentication
  // apiKeys: ['your-api-key-here'],
  // requireApiKey: false
});

// Example 1: Using memory cache (default)
const memoryCache = serviceRegistry.caching('memory', {
  ttl: 3600, // Time to live in seconds (1 hour)
  maxKeys: 1000 // Maximum number of keys to store
});

// Example 2: Using Redis cache (requires Redis server)
/*
const redisCache = serviceRegistry.caching('redis', {
  host: 'localhost',
  port: 6379,
  // password: 'your-redis-password',
  ttl: 3600
});
*/

// Example 3: Using file-based cache
const fileCache = serviceRegistry.caching('file', {
  cachePath: './cache',
  ttl: 3600
});

// Cache middleware for expensive operations
const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    const cacheKey = `route:${req.method}:${req.path}:${JSON.stringify(req.query)}`;

    try {
      const cachedResult = await memoryCache.get(cacheKey);
      if (cachedResult) {
        console.log(`Cache HIT for key: ${cacheKey}`);
        return res.json({
          cached: true,
          timestamp: new Date().toISOString(),
          data: cachedResult
        });
      }

      // Store original res.json
      const originalJson = res.json;
      res.json = function(data) {
        // Cache the response
        memoryCache.put(cacheKey, data, ttl);
        console.log(`Cache MISS - stored key: ${cacheKey}`);

        // Call original res.json
        return originalJson.call(this, {
          cached: false,
          timestamp: new Date().toISOString(),
          data: data
        });
      };

      next();
    } catch (error) {
      next();
    }
  };
};

// Example routes using caching
app.get('/expensive-operation', cacheMiddleware(600), async (req, res) => {
  // Simulate expensive operation
  await new Promise(resolve => setTimeout(resolve, 2000));

  const result = {
    message: 'This was an expensive operation',
    randomNumber: Math.random(),
    processedAt: new Date().toISOString()
  };

  res.json(result);
});

app.get('/user/:id', cacheMiddleware(300), async (req, res) => {
  const userId = req.params.id;

  // Simulate database lookup
  await new Promise(resolve => setTimeout(resolve, 500));

  const userData = {
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`,
    lastLogin: new Date().toISOString()
  };

  res.json(userData);
});

// Direct cache manipulation routes
app.post('/cache/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, ttl = 3600 } = req.body;

    await memoryCache.put(key, value, ttl);

    res.json({
      success: true,
      message: `Cached data with key: ${key}`,
      ttl: ttl
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/cache/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await memoryCache.get(key);

    if (value === null) {
      return res.status(404).json({ error: 'Key not found' });
    }

    res.json({
      key: key,
      value: value,
      retrieved: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/cache/:key', async (req, res) => {
  try {
    const { key } = req.params;
    await memoryCache.delete(key);

    res.json({
      success: true,
      message: `Deleted cache key: ${key}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/cache', async (req, res) => {
  try {
    await memoryCache.clear();

    res.json({
      success: true,
      message: 'Cleared all cache entries'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cache stats route
app.get('/cache-stats', async (req, res) => {
  try {
    const stats = await memoryCache.getStats();

    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('cache:hit', (data) => {
  console.log(`Cache HIT: ${data.key}`);
});

globalEventEmitter.on('cache:miss', (data) => {
  console.log(`Cache MISS: ${data.key}`);
});

globalEventEmitter.on('cache:set', (data) => {
  console.log(`Cache SET: ${data.key} (TTL: ${data.ttl}s)`);
});

globalEventEmitter.on('cache:delete', (data) => {
  console.log(`Cache DELETE: ${data.key}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🗄️ Caching Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Cache Interface: http://localhost:3000/services/caching/');
  console.log('- Swagger API Docs: http://localhost:3000/services/caching/swagger');
  console.log('- Service Status: http://localhost:3000/services/caching/api/status');
  console.log('- Expensive Operation (cached): GET http://localhost:3000/expensive-operation');
  console.log('- User Data (cached): GET http://localhost:3000/user/123');
  console.log('- Store Cache: POST http://localhost:3000/cache/mykey');
  console.log('- Get Cache: GET http://localhost:3000/cache/mykey');
  console.log('- Delete Cache: DELETE http://localhost:3000/cache/mykey');
  console.log('- Clear All Cache: DELETE http://localhost:3000/cache');
  console.log('- Cache Stats: GET http://localhost:3000/cache-stats');
  console.log('\nExample cache request body:');
  console.log('{ "value": {"message": "Hello World"}, "ttl": 300 }');
  console.log('\nTry the expensive-operation endpoint twice to see caching in action!');
});