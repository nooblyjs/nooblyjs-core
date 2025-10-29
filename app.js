/**
 * @fileoverview Application demonstrating NooblyJS Core services.
 * This file serves as a comprehensive example of how to use all available
 * services in the NooblyJS Core framework.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const serviceRegistry = require('./index');
const { EventEmitter } = require('events');
const config = require('dotenv').config();

const parseCommaSeparated = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Configure sessions for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'nooblyjs-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

const configuredApiKeys = parseCommaSeparated(
  process.env.NOOBLY_API_KEYS || process.env.API_KEYS || process.env.API_KEY || ''
);

let generatedDevApiKey = null;
if (configuredApiKeys.length === 0 && process.env.NODE_ENV !== 'production') {
  generatedDevApiKey = serviceRegistry.generateApiKey();
  configuredApiKeys.push(generatedDevApiKey);
}

// Instantiate the options
const options = {
  logDir: path.join(__dirname, './.noobly-core/', 'logs'),
  dataDir: path.join(__dirname, './.noobly-core/', 'data'),
  apiKeys: configuredApiKeys,
  requireApiKey: configuredApiKeys.length > 0,
  excludePaths: [
    '/services/*/status',
    '/services/',
    '/services/*/views/*',
    '/services/authservice/api/login',
    '/services/authservice/api/register'
  ]
};

const eventEmitter = new EventEmitter();
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize all services
const log = serviceRegistry.logger('file');
const cache = serviceRegistry.cache('inmemory');
const dataService = serviceRegistry.dataService('file');
const filing = serviceRegistry.filing('local');
const queue = serviceRegistry.queue('memory');
const scheduling = serviceRegistry.scheduling('memory');
const searching = serviceRegistry.searching('memory');
const measuring = serviceRegistry.measuring('memory');
const notifying = serviceRegistry.notifying('memory');
const worker = serviceRegistry.working('memory');
const workflow = serviceRegistry.workflow('memory');
const fetching = serviceRegistry.fetching('node');

// Implement Auth Service
const authservice = serviceRegistry.authservice('file');
const { configurePassport } = authservice.passportConfigurator(authservice.getAuthStrategy);
configurePassport(passport);

// Show generated api-key
if (generatedDevApiKey) {
  log.warn('Development API key generated automatically for local testing', {
    keyPrefix: `${generatedDevApiKey.slice(0, 6)}...`
  });
}

//Implement Auth Middleware
const apiAuthMiddleware = serviceRegistry.authMiddleware || ((req, res, next) => next());

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

app.listen(process.env.PORT || 3001, () => {
  log.info(`Server is running on port ${process.env.PORT || 3001}`);

  // Add some things to services
  cache.put('currentdate', new Date());
  log.info(cache.get('currentdate'));
  queue.enqueue(new Date());

});
