/**
 * @fileoverview Fetching Service Test App
 * Tests the fetching service with scheduled API calls to JSONPlaceholder
 * Makes 100 requests every minute with caching enabled
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const EventEmitter = require('events');
const path = require('path');

const app = express();
app.use(express.json());

// Add options
var options = {
  logDir:  path.join(__dirname, './.app-fetching/', 'logs'),
  dataDir : path.join(__dirname, './.app-fetching/', 'data'),
  'express-app': app,
  brandingConfig: {
    appName: 'Fetching Service Test',
    primaryColor: '#007bff'
  }
};

// Declare the Event Emitter
const eventEmitter = new EventEmitter();

// Initialize registry
const serviceRegistry = require('nooblyjs-core');
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize services
const authservice = serviceRegistry.authservice();
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService();
const fetching = serviceRegistry.fetching('node', {
  cacheTime: 60, // Cache responses for 60 seconds
  timeout: 10000,
  dependencies: { logging: logger }
}, eventEmitter);
const scheduler = serviceRegistry.scheduling();

// Redirect root to services dashboard
app.get('/', (req, res) => {
  res.redirect('/services');
});

// Expose the public folder
app.use('/README', express.static('README.md'));
app.use('/', express.static(__dirname + '/public'));

// Test endpoint to view current fetching analytics
app.get('/api/fetch-stats', (req, res) => {
  const stats = fetching.analytics?.getStats();
  res.json(stats || { message: 'No analytics available yet' });
});

// Test endpoint to view top URLs
app.get('/api/fetch-top-urls', (req, res) => {
  const topUrls = fetching.analytics?.getTopUrls(10);
  res.json(topUrls || []);
});

app.listen(process.env.PORT || 3101, async () => {
  await logger.info('Fetching Service Test App running on port ' + (process.env.PORT || 3101));
  await logger.info('Dashboard: http://localhost:' + (process.env.PORT || 3101) + '/services');
  await logger.info('Fetch Stats: http://localhost:' + (process.env.PORT || 3101) + '/api/fetch-stats');

  // Set up event listeners for fetch events
  eventEmitter.on('fetch:success', (data) => {
    // logger.info('Fetch success', { url: data.url, status: data.status });
  });

  eventEmitter.on('fetch:cache-hit', (data) => {
    // logger.info('Cache hit', { url: data.url });
  });

  eventEmitter.on('fetch:dedup-hit', (data) => {
    // logger.info('Dedup hit', { url: data.url });
  });

  eventEmitter.on('fetch:error', (data) => {
    logger.error('Fetch error', { url: data.url, error: data.error });
  });

  // Scheduler function: Makes 100 API requests every minute
  const runFetchTest = async () => {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    await logger.info('Starting fetch test batch - 100 requests');

    // Array of API endpoints from JSONPlaceholder (free testing API)
    const endpoints = [
      'https://jsonplaceholder.typicode.com/posts/1',
      'https://jsonplaceholder.typicode.com/posts/2',
      'https://jsonplaceholder.typicode.com/posts/3',
      'https://jsonplaceholder.typicode.com/users/1',
      'https://jsonplaceholder.typicode.com/users/2',
      'https://jsonplaceholder.typicode.com/comments/1',
      'https://jsonplaceholder.typicode.com/comments/2',
      'https://jsonplaceholder.typicode.com/todos/1',
      'https://jsonplaceholder.typicode.com/todos/2',
      'https://jsonplaceholder.typicode.com/photos/1'
    ];

    // Create fetch promises for 100 requests
    const promises = [];

    for (let i = 0; i < 100; i++) {
      // Cycle through endpoints - this helps us see cache hits
      const endpoint = endpoints[i % endpoints.length];

      // Create cache options - repeat same URLs to demonstrate caching
      const cacheOptions = i < 50
        ? { cache: 'default', next: { revalidate: 60 } } // Cache for 60 seconds
        : { cache: 'no-cache' }; // Bypass cache for second half

      promises.push(
        fetching.fetch(endpoint, cacheOptions)
          .then(response => {
            successCount++;
            return { success: true, status: response.status };
          })
          .catch(error => {
            errorCount++;
            console.error('[REQUEST ERROR]', {
              url: endpoint,
              errorMessage: error.message,
              errorName: error.name,
              stack: error.stack
            });
            logger.error('Request failed', { url: endpoint, error: error.message });
            return { success: false, error: error.message };
          })
      );
    }

    // Execute all requests in parallel
    await Promise.all(promises);

    const duration = Date.now() - startTime;
    await logger.info('Fetch test batch completed', {
      totalRequests: 100,
      successCount: successCount,
      errorCount: errorCount,
      durationMs: duration,
      avgTime: (duration / 100).toFixed(2) + 'ms'
    });

    // Log current analytics
    const stats = fetching.analytics?.getStats();
    if (stats) {
      await logger.info('Fetch Analytics Summary', {
        totalRequests: stats.totalRequests,
        totalSuccess: stats.totalSuccess,
        cacheHitRate: stats.cacheHitRate + '%',
        successRate: stats.successRate + '%',
        totalUrls: stats.totalUrls
      });
    }
  };

  // Schedule the fetch test to run every 60 seconds (1 minute)
  setInterval(runFetchTest, 10000);

  // Run immediately on startup for testing
  await runFetchTest();

  await logger.info('Scheduled fetch tests to run every 60 seconds');
  await logger.info('Each batch will make 100 requests with caching enabled');
  await logger.info('First 50 requests will use cache, last 50 will bypass cache');
});
