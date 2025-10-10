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
const serviceRegistry = require('./index');

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

// Initialize queueing service (required by working service)
const queueing = serviceRegistry.queue();

// Initialize working service with filing dependency for activity resolution
// Activities folder defaults to './activities' relative to project root
const worker = serviceRegistry.working('default', {
  maxThreads: 4,
  activitiesFolder: 'activities', // or use absolute path
  dependencies: {
    queueing,
    filing
  }
});

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

app.listen(3001, () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:3001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3001/services/authservice/views/register.html');
  logger.info('Activities folder: ./activities');

  // Start an example worker task using relative path (resolved from activities folder)
  // No need for path.resolve() - just use the activity filename!
  worker.start(
    'exampleTask.js', // Automatically resolves to ./activities/exampleTask.js
    { exampleParam: 'Hello from main thread!' },
    function (status, result) {
      console.log('Worker completed with status:', status);
      console.log('Worker result:', result);
    }
  ).then((taskId) => {
    logger.info('Example task queued with ID:', taskId);
  }).catch((err) => {
    logger.error('Failed to queue example task:', err);
  });

  const interval = setInterval(() => {
    worker.start(
      'exampleTask.js', // Much simpler! No path.resolve() needed
      { exampleParam: 'Hello from main thread!' },
      function (status, result) {
        console.log('Worker completed with status:', status);
        console.log('Worker result:', result);
      }
    ).then((taskId) => {
      logger.info('Example task queued with ID:', taskId);
    }).catch((err) => {
      logger.error('Failed to queue example task:', err);
    });
  }, 100);


});
