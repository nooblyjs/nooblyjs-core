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
const { v4: uuidv4 } = require('uuid');
const serviceRegistry = require('./index');
const { EventEmitter } = require('events');
const config = require('dotenv').config();

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

const eventEmitter = new EventEmitter();
serviceRegistry.initialize(app, eventEmitter);

const log = serviceRegistry.logger('file');
const cache = serviceRegistry.cache('inmemory');
const dataserve = serviceRegistry.dataServe('file');
const filing = serviceRegistry.filing('local');
const queue = serviceRegistry.queue('memory');
const scheduling = serviceRegistry.scheduling('memory');
const searching = serviceRegistry.searching('memory');
const measuring = serviceRegistry.measuring('memory');
const notifying = serviceRegistry.notifying('memory');
const worker = serviceRegistry.working('memory');
const workflow = serviceRegistry.workflow('memory');

// const aiservice = serviceRegistry.aiservice('claude', {
//   apiKey: process.env.aiapikey
// });
const authservice = serviceRegistry.authservice('memory', {
  'express-app': app,
  createDefaultAdmin: true
});

cache.put('currentdate', new Date());
log.info(cache.get('currentdate'));
queue.enqueue(new Date());

const PORT = process.env.PORT || 3001;
app.use('/', express.static(__dirname + '/public'));
app.listen(PORT, () => {
  log.info(`Server is running on port ${PORT}`);
});
