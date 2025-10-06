/**
 * @fileoverview Example demonstrating API provider usage for enterprise architecture.
 *
 * This example shows how to set up both a backend server and frontend client
 * using NooblyJS Core API providers for a distributed system.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const express = require('express');
const serviceRegistry = require('../../index');

// ============================================================================
// BACKEND SERVER - Exposes Service APIs
// ============================================================================

/**
 * Creates and starts the backend API server.
 * This server hosts the actual service providers (Redis, MongoDB, S3, etc.)
 * and exposes them via REST APIs.
 */
function startBackendServer() {
  const app = express();
  app.use(express.json());

  // Generate API key for client authentication
  const apiKey = serviceRegistry.generateApiKey();
  console.log('Backend API Key:', apiKey);
  console.log('Use this key in your frontend client configuration');

  // Initialize service registry with security
  serviceRegistry.initialize(app, {
    apiKeys: [apiKey],
    requireApiKey: true,
    excludePaths: [
      '/services/*/status',
      '/health'
    ]
  });

  // Configure services with real providers
  const cache = serviceRegistry.cache('redis', {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  });

  const dataService = serviceRegistry.dataService('mongodb', {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp'
  });

  const filing = serviceRegistry.filing('s3', {
    bucket: process.env.S3_BUCKET || 'my-app-files',
    region: process.env.AWS_REGION || 'us-east-1'
  });

  const logger = serviceRegistry.logger('file', {
    filename: './logs/backend.log',
    maxFiles: 5
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        cache: 'connected',
        database: 'connected',
        storage: 'connected'
      }
    });
  });

  const PORT = process.env.BACKEND_PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Backend API server running on port ${PORT}`);
    console.log(`Backend server started on http://localhost:${PORT}`);
    console.log(`API Key: ${apiKey}`);
  });

  return { app, apiKey };
}

// ============================================================================
// FRONTEND CLIENT - Consumes Backend APIs
// ============================================================================

/**
 * Creates and starts the frontend client application.
 * This client uses API providers to communicate with the backend server.
 *
 * @param {string} backendApiKey - The API key for backend authentication
 */
function startFrontendClient(backendApiKey) {
  const app = express();
  app.use(express.json());

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  // Initialize WITHOUT exposing services (client-only mode)
  serviceRegistry.initialize(app, {
    exposeServices: false
  });

  // Use API providers to connect to backend
  const cache = serviceRegistry.cache('api', {
    apiRoot: backendUrl,
    apiKey: backendApiKey,
    timeout: 5000
  });

  const dataService = serviceRegistry.dataService('api', {
    apiRoot: backendUrl,
    apiKey: backendApiKey,
    timeout: 10000
  });

  const filing = serviceRegistry.filing('api', {
    apiRoot: backendUrl,
    apiKey: backendApiKey,
    timeout: 30000
  });

  const logger = serviceRegistry.logger('api', {
    apiRoot: backendUrl,
    apiKey: backendApiKey
  });

  // Example: User profile endpoint with caching
  app.get('/api/users/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      const cacheKey = `user:${userId}`;

      // Try to get from cache first
      let user = await cache.get(cacheKey);

      if (!user) {
        // Not in cache, fetch from database
        user = await dataService.readById('users', userId);

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Cache for 1 hour
        await cache.put(cacheKey, user, 3600);
        await logger.info(`User ${userId} loaded from database and cached`);
      } else {
        await logger.info(`User ${userId} served from cache`);
      }

      res.json(user);
    } catch (error) {
      await logger.error(`Error fetching user: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Example: Create user endpoint
  app.post('/api/users', async (req, res) => {
    try {
      const userData = req.body;

      // Validate input
      if (!userData.name || !userData.email) {
        return res.status(400).json({ error: 'Name and email required' });
      }

      // Store in database via API
      const result = await dataService.add('users', userData);

      // Invalidate any related cache
      await cache.delete(`user:${result.id}`);

      await logger.info(`New user created: ${result.id}`);

      res.status(201).json(result);
    } catch (error) {
      await logger.error(`Error creating user: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Example: File upload endpoint
  app.post('/api/files/upload', async (req, res) => {
    try {
      const { filename, content } = req.body;

      if (!filename || !content) {
        return res.status(400).json({ error: 'Filename and content required' });
      }

      // Upload file via API
      const filePath = `uploads/${Date.now()}_${filename}`;
      await filing.create(filePath, content);

      await logger.info(`File uploaded: ${filePath}`);

      res.json({
        success: true,
        path: filePath
      });
    } catch (error) {
      await logger.error(`Error uploading file: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      backend: backendUrl,
      timestamp: new Date().toISOString()
    });
  });

  const PORT = process.env.FRONTEND_PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Frontend client started on http://localhost:${PORT}`);
    console.log(`Connected to backend: ${backendUrl}`);
  });

  return app;
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

if (require.main === module) {
  console.log('='.repeat(80));
  console.log('NooblyJS Core - API Provider Example');
  console.log('Enterprise Architecture: Backend + Frontend');
  console.log('='.repeat(80));
  console.log();

  // Start backend server
  console.log('Starting backend server...');
  const { apiKey } = startBackendServer();

  // Wait a moment for backend to be ready, then start frontend
  setTimeout(() => {
    console.log();
    console.log('Starting frontend client...');
    startFrontendClient(apiKey);

    console.log();
    console.log('='.repeat(80));
    console.log('Both servers are running!');
    console.log('='.repeat(80));
    console.log();
    console.log('Backend API: http://localhost:3000');
    console.log('Frontend App: http://localhost:4000');
    console.log();
    console.log('Try these requests:');
    console.log('  GET  http://localhost:4000/api/users/123');
    console.log('  POST http://localhost:4000/api/users');
    console.log('       { "name": "John", "email": "john@example.com" }');
    console.log('  POST http://localhost:4000/api/files/upload');
    console.log('       { "filename": "test.txt", "content": "Hello World" }');
    console.log();
  }, 2000);
}

module.exports = {
  startBackendServer,
  startFrontendClient
};
