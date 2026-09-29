/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });

const express = require('express');
const helmet = require('helmet');
const EventEmitter = require('events');
const path = require('node:path');
const serviceRegistry = require('../../../index');

const app = express();

// Security headers: applied before other middleware so every response is
// covered. CSP is disabled here to match the main apps (app.js / app-noauth.js)
// because the service dashboards use inline styles/scripts; enable a tuned CSP
// per deployment.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Some commont options (noauth - no API key or login required)
const options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  'express-app': app,
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
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice('file', options);

// Get other services
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService('file', options );


const aiservice = serviceRegistry.aiservice('claude', {
  apikey: process.env.ANTHROPIC_API_KEY,
  model: process.env.ANTHROPIC_MODEL,
  'express-app': app
});
logger.info('AI service (Claude) initialized successfully');
aiservice
  .prompt('Please give me an inspiring quote')
  .then((response) => console.log(response.content))
  .catch((error) => console.error('AI prompt failed:', error.message));

// Load images
app.use('/images/nooblyjs-logo.png', express.static(path.join(__dirname, 'nooblyjs-core.png')));

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

app.listen(3101, async () => {
  logger.info('Server running on port 3101');
  logger.info('Visit: http://localhost:3101/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3101/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3101/services/authservice/views/register.html');
});
