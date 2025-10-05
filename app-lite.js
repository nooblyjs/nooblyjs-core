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

// Initialize registry
serviceRegistry.initialize(app);

// Initialize auth service (required for login/register functionality)
const authservice = serviceRegistry.authservice('memory');

// Get other services
const cache = serviceRegistry.cache('memory');
const logger = serviceRegistry.logger('console');
const dataServe = serviceRegistry.dataServe('memory');

app.listen(9001, () => {
  logger.info('Server running on port 9001');
  logger.info('Access services at: http://localhost:9001/services/');
  logger.info('Login page at: http://localhost:9001/login.html');
});
