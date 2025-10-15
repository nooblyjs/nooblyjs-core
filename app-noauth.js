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

const express = require('express');
const bodyParser = require('body-parser');
const serviceRegistry = require('./index');
const { EventEmitter } = require('events');
const config = require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

const eventEmitter = new EventEmitter();
serviceRegistry.initialize(app, eventEmitter, {
  security: {
    apiKeyAuth: {
      requireApiKey: false,
      apiKeys: []
    },
    servicesAuth: {
      requireLogin: false
    }
  }
});

const log = serviceRegistry.logger('file');
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
// authservice.passportConfigurator(...) is available if passport setup is needed in custom hosts.

app.get('/api/secure/ping', (req, res) => {
  res.json({ ok: true, authorized: true });
});

cache.put('currentdate', new Date());
log.info(cache.get('currentdate'));
queue.enqueue(new Date());

const PORT = process.env.PORT || 3001;
app.use('/', express.static(__dirname + '/public'));
app.listen(PORT, () => {
  log.info(`Server is running on port ${PORT}`);
});
