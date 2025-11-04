/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('path');
const express = require('express');
const serviceRegistry = require('nooblyjs-core');

const app = express();
app.use(express.json());

// Initialize registry (no public folder needed!)
serviceRegistry.initialize(app);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice();

// Get other services
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService();
const filing = serviceRegistry.filing();
const queueing = serviceRegistry.queue();
const worker = serviceRegistry.working('default', {
  maxThreads: 4,
  activitiesFolder: 'activities', // or use absolute path
  dependencies: {
    queueing,
    filing
  }
});

// Initialize scheduling service
const scheduler = serviceRegistry.scheduling();

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

app.listen(3001, async () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:3001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3001/services/authservice/views/register.html');
  logger.info('Activities folder: ./activities');

  // Schedule ExampleTask.js to run every 3 seconds
  await scheduler.start(
    'exampleTask1',
    'exampleTask.js',
    { taskName: 'ExampleTask 1' },
    3, // Run every 3 seconds
    (status, data) => {
      if (status === 'completed') {
        logger.info('ExampleTask 1 completed:', data);
      } else if (status === 'error') {
        logger.error('ExampleTask 1 failed:', data);
      }
    }
  );

  // Schedule ExampleTask-2.js to run every 5 seconds
  await scheduler.start(
    'exampleTask2',
    'exampleTask-2.js',
    { taskName: 'ExampleTask 2' },
    5, // Run every 5 seconds
    (status, data) => {
      if (status === 'completed') {
        logger.info('ExampleTask 2 completed:', data);
      } else if (status === 'error') {
        logger.error('ExampleTask 2 failed:', data);
      }
    }
  );

  // Schedule ExampleTask-3.js to run every 10 seconds
  await scheduler.start(
    'exampleTask3',
    'exampleTask-3.js',
    { taskName: 'ExampleTask 3' },
    10, // Run every 5 seconds
    (status, data) => {
      if (status === 'completed') {
        logger.info('ExampleTask 3 completed:', data);
      } else if (status === 'error') {
        logger.error('ExampleTask 3 failed:', data);
      }
    }
  );

  logger.info('Scheduled tasks:');
  logger.info('  - ExampleTask 1: runs every 3 seconds');
  logger.info('  - ExampleTask 2: runs every 5 seconds');
  logger.info('  - ExampleTask 3: runs every 10 seconds');

});
