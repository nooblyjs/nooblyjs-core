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
const path = require('node:path');

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

// Initialize registry (no public folder needed!)
const serviceRegistry = require('../../../index');
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice();

// Get other services - use file provider for load testing
const logger = serviceRegistry.logger();

// Redirect to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

// Expose the public folder
app.use('/README', express.static('README.md'));

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

// Load images
app.use('/images/nooblyjs-logo.png', express.static(path.join(__dirname, 's-tech-logo-colour.png')));

// Start the listener
app.listen(process.env.PORT || 3101, async () => {
  logger.info('Server running on port ' + (process.env.PORT || 3101));

  // Load test: log 1000 messages every 10 seconds
  setInterval(async () => {
    const startTime = Date.now();
    const levels = ['info', 'log', 'warn', 'error'];
    const logsPerLevel = 250;

    for (let level = 0; level < levels.length; level++) {
      for (let i = 0; i < logsPerLevel; i++) {
        const logLevel = levels[level];
        const message = `Load test message ${level * logsPerLevel + i}`;
        const meta = { iteration: i, timestamp: Date.now() };

        try {
          await logger[logLevel](message, meta);
        } catch (err) {
          console.error('Log error:', err.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✓ Logged 1000 messages in ${duration}ms (${(1000 / duration * 1000).toFixed(0)} logs/sec)`);
  }, 10000);
});
