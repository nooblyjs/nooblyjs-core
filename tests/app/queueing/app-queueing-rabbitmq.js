/**
 * @fileoverview RabbitMQ Queueing app
 *
 * Demonstrates the queueing service with RabbitMQ as the backend provider.
 * RabbitMQ provides distributed, durable, and persistent queue operations.
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

// Initialize queue service with RabbitMQ provider
// Make sure RabbitMQ is running on localhost:5672 (default port)
// RabbitMQ provides distributed, persistent queue operations
const queue = serviceRegistry.queue('rabbitmq', {
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost'
});

// Queue provider type
const queueProviderType = 'rabbitmq';

// Is the queue running
let isQueueRunning = false;

// Queue statistics tracking
const queueStats = {
  provider: queueProviderType,
  cycleCount: 0,
  totalEnqueueOperations: 0,
  totalDequeueOperations: 0,
  cycles: []
};

/**
 * Continuous queue operations function
 * Performs enqueue dequeue operations on 1000 items with configurable intervals
 */
async function continuousQueueOperations() {
  if (isQueueRunning) {
    // Schedule next operation in 500ms
    setTimeout(continuousQueueOperations, 500);
    return;
  }

  isQueueRunning = true;
  const cycleStart = Date.now();
  const cycleNum = queueStats.cycleCount++;

  logger.info(`=== Starting Queue Cycle ${cycleNum + 1} [Provider: ${queueProviderType}] ===`);

  const cycleData = {
    cycleNum,
    startTime: cycleStart,
    enqueue: { count: 0, duration: 0, failed: 0 },
    dequeue: { count: 0, duration: 0, failed: 0, successful: 0 },
    size: { count: 0, duration: 0, failed: 0 }
  };

  try {
    const queueName = `test-queue-${cycleNum}`;

    // Phase 1: ENQUEUE 1000 items
    const enqueueStart = Date.now();
    logger.info(`[Cycle ${cycleNum + 1}] Starting ENQUEUE operations on queue "${queueName}"...`);

    for (let i = 0; i < 1000; i++) {
      const taskData = {
        cycleId: cycleNum,
        index: i,
        timestamp: Date.now(),
        data: `Queue test data for task index ${i}`
      };

      try {
        await queue.enqueue(queueName, taskData);
        cycleData.enqueue.count++;
        queueStats.totalEnqueueOperations++;
      } catch (err) {
        cycleData.enqueue.failed++;
        logger.error(`[Cycle ${cycleNum + 1}] ENQUEUE failed: ${err.message}`);
      }
    }

    cycleData.enqueue.duration = Date.now() - enqueueStart;
    logger.info(`[Cycle ${cycleNum + 1}] ENQUEUE: ${cycleData.enqueue.count} items in ${cycleData.enqueue.duration}ms`);

    // Phase 2: DEQUEUE 100 items from current cycle
    const dequeueStart = Date.now();
    logger.info(`[Cycle ${cycleNum + 1}] Starting DEQUEUE operations (dequeueing 100 items)...`);

    for (let i = 0; i < 100; i++) {
      try {
        const taskData = await queue.dequeue(queueName);
        if (taskData) {
          cycleData.dequeue.successful++;
        }
        cycleData.dequeue.count++;
        queueStats.totalDequeueOperations++;
      } catch (err) {
        cycleData.dequeue.failed++;
        logger.error(`[Cycle ${cycleNum + 1}] DEQUEUE failed: ${err.message}`);
      }
    }

    cycleData.dequeue.duration = Date.now() - dequeueStart;
    logger.info(`[Cycle ${cycleNum + 1}] DEQUEUE: ${cycleData.dequeue.successful}/${cycleData.dequeue.count} successful in ${cycleData.dequeue.duration}ms`);

    // Phase 3: Get queue size
    const sizeStart = Date.now();
    logger.info(`[Cycle ${cycleNum + 1}] Getting queue size...`);

    try {
      const queueSize = await queue.size(queueName);
      cycleData.size.count = queueSize;
      logger.info(`[Cycle ${cycleNum + 1}] Queue size: ${queueSize} items remaining`);
    } catch (err) {
      cycleData.size.failed++;
      logger.error(`[Cycle ${cycleNum + 1}] SIZE check failed: ${err.message}`);
    }

    cycleData.size.duration = Date.now() - sizeStart;

    cycleData.totalDuration = Date.now() - cycleStart;
    queueStats.cycles.push(cycleData);

    logger.info(`=== Cycle ${cycleNum + 1} Complete in ${cycleData.totalDuration}ms ===`);
    logger.info(`Total Operations: ENQUEUE(${queueStats.totalEnqueueOperations}) DEQUEUE(${queueStats.totalDequeueOperations})`);

  } catch (error) {
    logger.error(`[Cycle ${cycleNum + 1}] Error: ${error.message}`);
  }

  isQueueRunning = false;

  // Schedule next cycle in 500ms
  setTimeout(continuousQueueOperations, 500);
}

app.get('/', (_req, res) => {
  res.redirect('/services');
});

// Expose the public folder
app.use('/README', express.static('README.md'));

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

// API endpoints for queue test control
app.get('/queue-stats', (_req, res) => {
  res.json({
    isRunning: isQueueRunning,
    stats: queueStats
  });
});


// Start continuous queue operations
continuousQueueOperations();

// Start server
const PORT = process.env.PORT || 3101; // Use different port than default app
app.listen(PORT, async () => {
  logger.info(`Queue test server running on port ${PORT}`);
  logger.info(`Using queue provider: ${queueProviderType}`);
  logger.info('Available endpoints:');

  logger.info('\nNote: Using RABBITMQ queue provider for distributed/persistent queue operations.');
  const connInfo = queue.getConnectionInfo?.();
  if (connInfo) {
    logger.info(`RabbitMQ Connection: ${connInfo.url} (Status: ${connInfo.status})`);
  }

  logger.info('\nRabbitMQ Configuration:');
  logger.info('  - Default URL: amqp://localhost');
  logger.info('  - Set RABBITMQ_URL environment variable to use custom URL');
  logger.info('  - Example: RABBITMQ_URL=amqp://user:pass@rabbitmq.example.com npm start');
});
