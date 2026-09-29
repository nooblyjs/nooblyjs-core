/**
 * @fileoverview Mountable app
 * This file uses the nooblyjs-core structure object to 
 */

'use strict';

const express = require('express');
const helmet = require('helmet');
const http = require('http');
const EventEmitter = require('events');
const path = require('node:path');

const app = express();

// Security headers: applied before other middleware so every response is
// covered. CSP is disabled here to match the main apps (app.js / app-noauth.js)
// because the service dashboards use inline styles/scripts; enable a tuned CSP
// per deployment.
app.use(helmet({ contentSecurityPolicy: false }));
const server = http.createServer(app);
app.use(express.json());

// Add options
let options = { 
  baseUrl: "/",
  name: "Mounted Application",
  logDir:  path.join(__dirname, './.application/', 'logs'),
  dataDir : path.join(__dirname, './.application/', 'data'),
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

// Get other services
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService();

// Launch the application service
const appService = serviceRegistry.appservice();

app.listen(process.env.PORT || 3102, async () => {
  logger.info('Server running on port ' + (process.env.PORT || 3102));
});
