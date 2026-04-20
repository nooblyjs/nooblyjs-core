/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');
const EventEmitter = require('events');
const express = require('express');

const app = express();
app.use(express.json());

// Add options
const options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  'express-app': app,
  brandingConfig: {
    appName: 'Measuring Test',
    primaryColor: '#000'
  },
  security: {
    apiKeyAuth: {
      requireApiKey: false,
      apiKeys: []
    },
    servicesAuth: {
      requireLogin: false
    }
  }
};

// Declare the Event Emitter
const eventEmitter = new EventEmitter();
const serviceRegistry = require('../../../index');
serviceRegistry.initialize(app, eventEmitter, options);

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

// Load styles
app.use('/styles.css', express.static(path.join(__dirname, 'styles.css')));

// Load styles
app.use('/images/nooblyjs-logo.png', express.static(path.join(__dirname, 's-tech-logo-colour.png')));


app.listen(3101, async () => {
  logger.info('Server running on port 3101');
  logger.info('Visit: http://localhost:3101/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3101/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3101/services/authservice/views/register.html');
  logger.info('Activities folder: ./activities');

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
