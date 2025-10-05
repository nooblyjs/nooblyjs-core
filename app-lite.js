/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const serviceRegistry = require('./index');

const app = express();
app.use(express.json());

// Initialize registry (no public folder needed!)
serviceRegistry.initialize(app);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice('memory');

// Get other services
const cache = serviceRegistry.cache('memory');
const logger = serviceRegistry.logger('console');
const dataServe = serviceRegistry.dataServe('memory');

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

app.listen(9001, () => {
  logger.info('Server running on port 9001');
  logger.info('Visit: http://localhost:9001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:9001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:9001/services/authservice/views/register.html');
});
