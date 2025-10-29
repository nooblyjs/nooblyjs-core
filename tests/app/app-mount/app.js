/**
 * @fileoverview Mountable app
 * This file uses the nooblyjs-core structure object to 
 */

'use strict';

const express = require('express');
const http = require('http');

const EventEmitter = require('events');
const path = require('path');

const app = express();
const server = http.createServer(app);
app.use(express.json());

// Add options
var options = { 
  logDir:  path.join(__dirname, './.app-lite/', 'logs'),
  dataDir : path.join(__dirname, './.app-lite/', 'data'),
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
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService();

// Initiate the content Registry
const wiki = require('nooblyjs-app-wiki');
wiki(app, server, eventEmitter, serviceRegistry, options);

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

app.listen(process.env.PORT || 3102, async () => {
  logger.info('Server running on port ' + (process.env.PORT || 3102));
});
