/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('path');
const express = require('express');
const serviceRegistry = require('./index');

const app = express();
app.use(express.json());

// Initialize registry (no public folder needed!)
serviceRegistry.initialize(app);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice();

// Get other services
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService();
const worker = serviceRegistry.working();
const workflow = serviceRegistry.workflow();

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

app.listen(3001, () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:9001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:9001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:9001/services/authservice/views/register.html');
  worker.start(path.resolve('/workspaces/nooblyjs-core/tests/activities/exampleTask.js'), {exampleParam: 'Hello from main thread!'}), function() { 
    console.log('Worker completed with result:');
  };
});
