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
const { configurePassport } = require('./src/authservice/middleware');

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
  console.warn('[NooblyJS] Generated development API key. Set NOOBLY_API_KEYS to override this value.');
}

const eventEmitter = new EventEmitter();
serviceRegistry.initialize(app, eventEmitter, {
  apiKeys: configuredApiKeys,
  requireApiKey: configuredApiKeys.length > 0,
  excludePaths: [
    '/services/*/status',
    '/services/',
    '/services/*/views/*',
    '/services/authservice/api/login',
    '/services/authservice/api/register'
  ]
});

const log = serviceRegistry.logger('file');
if (generatedDevApiKey) {
  log.warn('Development API key generated automatically for local testing', {
    keyPrefix: `${generatedDevApiKey.slice(0, 6)}...`
  });
}
const cache = serviceRegistry.cache('inmemory');
const dataservice = serviceRegistry.dataService('file');
const filing = serviceRegistry.filing('local');
const queue = serviceRegistry.queue('memory');
const scheduling = serviceRegistry.scheduling('memory');
const searching = serviceRegistry.searching('memory');
const measuring = serviceRegistry.measuring('memory');
const notifying = serviceRegistry.notifying('memory');
const worker = serviceRegistry.working('memory');
const workflow = serviceRegistry.workflow('memory');

// Initialize AI service with graceful handling of missing API key
// Use Ollama as fallback since it doesn't require an API key
let aiservice;
if (process.env.aiapikey) {
  try {
    aiservice = serviceRegistry.aiservice('claude', {
      apiKey: process.env.aiapikey,
      'express-app': app
    });
    log.info('AI service (Claude) initialized successfully');
  } catch (error) {
    log.error('Failed to initialize Claude AI service:', error.message);
  }
}

// If Claude isn't available, try Ollama as fallback
if (!aiservice) {
  try {
    aiservice = serviceRegistry.aiservice('ollama', {
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: 'llama3.2',
      'express-app': app
    });
    log.info('AI service (Ollama) initialized - configure Claude with aiapikey env var for Claude support');
  } catch (error) {
    log.info('AI service not available - Ollama not running and no API key configured');
    log.info('To enable AI features:');
    log.info('  - For Claude: Set aiapikey environment variable');
    log.info('  - For Ollama: Start Ollama server at http://localhost:11434');
  }
}

const authservice = serviceRegistry.authservice('file', {
  'express-app': app,
  dataDir: './data/auth'
});

/*
 * Example: Enable Google OAuth by switching providers.
 * Uncomment the block below and supply your credentials when ready.
 */
// const authservice = serviceRegistry.authservice('google', {
//   'express-app': app,
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
// });

const strategyFactory = authservice && typeof authservice.getAuthStrategy === 'function'
  ? authservice.getAuthStrategy
  : null;

if (strategyFactory) {
  try {
    configurePassport(strategyFactory, passport);
  } catch (error) {
    log.warn(`Passport configuration skipped: ${error.message}`);
  }
} else {
  log.info('Passport strategy not available for current auth provider.');
}

const apiAuthMiddleware = serviceRegistry.authMiddleware || ((req, res, next) => next());

app.get('/api/secure/ping', apiAuthMiddleware, (req, res) => {
  res.json({
    ok: true,
    authorized: Boolean(req.apiKey),
    keyPrefix: req.apiKey ? `${req.apiKey.slice(0, 6)}...` : null
  });
});

if (serviceRegistry.servicesAuthMiddleware) {
  app.get('/services/protected/ping', serviceRegistry.servicesAuthMiddleware, (req, res) => {
    res.json({
      ok: true,
      user: req.user ? req.user.username : null
    });
  });
}

cache.put('currentdate', new Date());
log.info(cache.get('currentdate'));
queue.enqueue(new Date());

const PORT = process.env.PORT || 3001;
app.use('/', express.static(__dirname + '/public'));
app.listen(PORT, () => {
  log.info(`Server is running on port ${PORT}`);
});
