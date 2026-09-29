/**
 * @fileoverview Apache ActiveMQ Queueing app
 *
 * Demonstrates the queueing service with Apache ActiveMQ as the backend provider.
 * Messaging (enqueue/dequeue) is performed over STOMP (default port 61613); queue
 * introspection (size/listQueues/purge) is performed via the Jolokia JMX REST API
 * exposed by the ActiveMQ web console (default port 8161).
 *
 * Make sure ActiveMQ is running with:
 *   - STOMP connector enabled on 61613
 *   - Web console / Jolokia available on 8161 (default credentials admin/admin)
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const helmet = require('helmet');
const EventEmitter = require('events');
const path = require('node:path');

const app = express();

// Security headers: applied before other middleware so every response is
// covered. CSP is disabled here to match the main apps (app.js / app-noauth.js)
// because the service dashboards use inline styles/scripts; enable a tuned CSP
// per deployment.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Add options
let options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  'express-app': app,
  brandingConfig: {
    appName: 'App Lite',
    primaryColor: '#000'
  }
};

// Declare the Event Emitter
const eventEmitter = new EventEmitter();

// Initialize registry (no public folder needed!)
const serviceRegistry = require('../../../index');
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize auth service (required for login/register functionality)
const authservice = serviceRegistry.authservice();

// Get other services
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService();

// Initialize queue service with ActiveMQ provider.
// STOMP host/port for messaging; Jolokia for management operations.
const queue = serviceRegistry.queue('activemq', {
  host: process.env.ACTIVEMQ_HOST || 'localhost',
  port: parseInt(process.env.ACTIVEMQ_STOMP_PORT || '61613', 10),
  login: process.env.ACTIVEMQ_USER || 'admin',
  passcode: process.env.ACTIVEMQ_PASSWORD || 'admin',
  jolokiaUrl: process.env.ACTIVEMQ_JOLOKIA_URL || 'http://localhost:8161/api/jolokia',
  dequeueTimeout: 1000
});

// Queue provider type
const queueProviderType = 'activemq';

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
 * Continuous queue operations function.
 * Performs enqueue/dequeue operations with configurable intervals.
 */
async function continuousQueueOperations() {
  if (isQueueRunning) {
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

    // Phase 1: ENQUEUE 100 items
    const enqueueStart = Date.now();
    logger.info(`[Cycle ${cycleNum + 1}] Starting ENQUEUE operations on queue "${queueName}"...`);

    for (let i = 0; i < 100; i++) {
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

    // Phase 2: DEQUEUE 50 items from current cycle
    const dequeueStart = Date.now();
    logger.info(`[Cycle ${cycleNum + 1}] Starting DEQUEUE operations (dequeueing 50 items)...`);

    for (let i = 0; i < 50; i++) {
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

// Expose the README and public folder
app.use('/README', express.static('README.md'));
app.use('/', express.static(__dirname + '/public'));

// API endpoint for queue test control
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

  logger.info('\nNote: Using ACTIVEMQ queue provider (STOMP + Jolokia JMX).');
  const connInfo = queue.getConnectionInfo?.();
  if (connInfo) {
    logger.info(`ActiveMQ Connection: ${connInfo.url} (Status: ${connInfo.status})`);
    logger.info(`ActiveMQ Jolokia: ${connInfo.jolokiaUrl}`);
  }

  logger.info('\nActiveMQ Configuration:');
  logger.info('  - STOMP (messaging):  localhost:61613');
  logger.info('  - Jolokia (size/list/purge): http://localhost:8161/api/jolokia');
  logger.info('  - Override with ACTIVEMQ_HOST / ACTIVEMQ_STOMP_PORT / ACTIVEMQ_USER / ACTIVEMQ_PASSWORD / ACTIVEMQ_JOLOKIA_URL');
});
