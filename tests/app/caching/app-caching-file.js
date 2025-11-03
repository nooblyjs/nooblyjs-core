/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
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
  logDir:  path.join(__dirname, './.application/', 'logs'),
  dataDir : path.join(__dirname, './.application/', 'data'),
  cacheDir : path.join(__dirname, './.application/', 'caching'),
  'express-app': app,
    brandingConfig: {
      appName: 'App Lite',
      primaryColor: '#000'
    }
};

// Declare the Event Emitter
const eventEmitter = new EventEmitter();

// Initialize registry (no public folder needed!)
const serviceRegistry = require('nooblyjs-core');
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice();

// Get other services
// Note: Using 'memory' provider for logger since we need it immediately
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService();

// Initialize cache with memcached provider
const cache = serviceRegistry.cache('file');

// Global stats for continuous caching operations
let cacheStats = {
  startTime: Date.now(),
  cycleCount: 0,
  totalPutOperations: 0,
  totalGetOperations: 0,
  totalDeleteOperations: 0,
  cycles: []
};

// Flag to control continuous operation
let isCachingRunning = false;

/**
 * Continuous cache operation function
 * Performs put, get, and delete operations on 1000 items every 10 seconds
 */
async function continuousCacheOperations() {
  if (isCachingRunning) {
    // Schedule next operation in 10 seconds
    setTimeout(continuousCacheOperations, 10000);
    return;
  }

  isCachingRunning = true;
  const cycleStart = Date.now();
  const cycleNum = cacheStats.cycleCount++;

  logger.info(`=== Starting Cache Cycle ${cycleNum + 1} ===`);

  const cycleData = {
    cycleNum,
    startTime: cycleStart,
    put: { count: 0, duration: 0, failed: 0 },
    get: { count: 0, duration: 0, failed: 0, successful: 0 },
    delete: { count: 0, duration: 0, failed: 0 }
  };

  try {
    // Phase 1: PUT 1000 values
    const putStart = Date.now();
    logger.info(`[Cycle ${cycleNum + 1}] Starting PUT operations...`);

    for (let i = 0; i < 1000; i++) {
      const key = `cache-key-cycle${cycleNum}-${i}`;
      const value = {
        cycleId: cycleNum,
        index: i,
        timestamp: Date.now(),
        data: `Cache test data for key ${key}`
      };

      try {
        await cache.put(key, value, 600); // 10 minute TTL
        cycleData.put.count++;
        cacheStats.totalPutOperations++;
      } catch (err) {
        cycleData.put.failed++;
        logger.error(`[Cycle ${cycleNum + 1}] PUT failed for ${key}: ${err.message}`);
      }
    }

    cycleData.put.duration = Date.now() - putStart;
    logger.info(`[Cycle ${cycleNum + 1}] PUT: ${cycleData.put.count} items in ${cycleData.put.duration}ms`);

    // Phase 2: GET 100 random values from current cycle
    const getStart = Date.now();
    logger.info(`[Cycle ${cycleNum + 1}] Starting GET operations (sampling 100 items)...`);

    for (let i = 0; i < 100; i++) {
      const randomIndex = Math.floor(Math.random() * 1000);
      const key = `cache-key-cycle${cycleNum}-${randomIndex}`;

      try {
        const value = await cache.get(key);
        if (value) {
          cycleData.get.successful++;
        }
        cycleData.get.count++;
        cacheStats.totalGetOperations++;
      } catch (err) {
        cycleData.get.failed++;
        logger.error(`[Cycle ${cycleNum + 1}] GET failed for ${key}: ${err.message}`);
      }
    }

    cycleData.get.duration = Date.now() - getStart;
    logger.info(`[Cycle ${cycleNum + 1}] GET: ${cycleData.get.successful}/${cycleData.get.count} successful in ${cycleData.get.duration}ms`);

    // Phase 3: DELETE 100 values (10% of 1000) from current cycle
    const deleteStart = Date.now();
    logger.info(`[Cycle ${cycleNum + 1}] Starting DELETE operations (deleting 100 items / 10%)...`);

    for (let i = 0; i < 100; i++) {
      const randomIndex = Math.floor(Math.random() * 1000);
      const key = `cache-key-cycle${cycleNum}-${randomIndex}`;

      try {
        await cache.delete(key);
        cycleData.delete.count++;
        cacheStats.totalDeleteOperations++;
      } catch (err) {
        cycleData.delete.failed++;
        logger.error(`[Cycle ${cycleNum + 1}] DELETE failed for ${key}: ${err.message}`);
      }
    }

    cycleData.delete.duration = Date.now() - deleteStart;
    logger.info(`[Cycle ${cycleNum + 1}] DELETE: ${cycleData.delete.count} items in ${cycleData.delete.duration}ms`);

    cycleData.totalDuration = Date.now() - cycleStart;
    cacheStats.cycles.push(cycleData);

    logger.info(`=== Cycle ${cycleNum + 1} Complete in ${cycleData.totalDuration}ms ===`);
    logger.info(`Total Operations: PUT(${cacheStats.totalPutOperations}) GET(${cacheStats.totalGetOperations}) DELETE(${cacheStats.totalDeleteOperations})`);

  } catch (error) {
    logger.error(`[Cycle ${cycleNum + 1}] Error: ${error.message}`);
  }

  isCachingRunning = false;

  // Schedule next cycle in 10 seconds
  setTimeout(continuousCacheOperations, 100);
}

app.get('/', (req, res) => {
  res.redirect('/services');
});

// Expose the public folder
app.use('/README', express.static('README.md'));

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

// Start continuous caching operations
continuousCacheOperations();

// Real-time cache statistics

app.listen(process.env.PORT || 3101, async () => {
  logger.info('Server running on port ' + (process.env.PORT || 3101));
  logger.info('Continuous cache test endpoints:');
  logger.info('  - Start test: http://localhost:3101/start-cache-test');
  logger.info('  - Stop test: http://localhost:3101/stop-cache-test');
  logger.info('  - View stats: http://localhost:3101/cache-stats');
});
