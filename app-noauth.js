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
const { EventEmitter } = require('events');
const config = require('dotenv').config();

const serviceRegistry = require('.');

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
// Default instance (backward compatible)
const defaultCache = serviceRegistry.cache('memory');
const cacheSessions = serviceRegistry.getService('caching', 'memory', { instanceName: 'sessions' });
const cacheMetrics = serviceRegistry.getService('caching', 'memory', { instanceName: 'metrics' });
const dataservice = serviceRegistry.dataService('file');
const filing = serviceRegistry.filing('local');
const queue = serviceRegistry.queue('memory');
const scheduling = serviceRegistry.scheduling('memory');
const searching = serviceRegistry.searching('memory');
const measuring = serviceRegistry.measuring('memory');
const notifying = serviceRegistry.notifying('memory');
const worker = serviceRegistry.working('memory');
const workflow = serviceRegistry.workflow('memory');

const authservice = serviceRegistry.authservice('file', {
  'express-app': app,
  dataDir: './data/auth'
});

defaultCache.put('running status','running');

cacheSessions.put('currentdate', new Date());
log.info(cacheSessions.get('currentdate'));
queue.enqueue('test queue',new Date());

cacheMetrics.put('Startup Time', new Date());

const PORT = process.env.PORT || 3001;
app.use('/', express.static(__dirname + '/public'));
app.listen(PORT, () => {
  log.info(`Server is running on port ${PORT}`);
  log.info(cacheMetrics.get('Startup Time'));
  log.info(defaultCache.get('running status'));
});
