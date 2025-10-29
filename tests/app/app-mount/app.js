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
  baseUrl: "/",
  logDir:  path.join(__dirname, './.app-lite/', 'logs'),
  dataDir : path.join(__dirname, './.app-lite/', 'data')
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

// Launch the application service
const appService = serviceRegistry.appservice();

app.listen(process.env.PORT || 3102, async () => {
  logger.info('Server running on port ' + (process.env.PORT || 3102));
});
