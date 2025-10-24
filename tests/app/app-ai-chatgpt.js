/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const serviceRegistry = require('nooblyjs-core');

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
const dataService = serviceRegistry.dataService('file', { dataDir: './.noobly-core/data' });

dataService.find('ai-config', 'claude').then((result)=> 
  {if (result.length > 0){
    const aiservice = serviceRegistry.aiservice('chatgpt', {
      apikey: result[0].apikey,
      model: result[0].model,
      'express-app': app
    });
    logger.info('AI service (Claude) initialized successfully');
  }
});

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

app.listen(3001, async () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:3001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3001/services/authservice/views/register.html');
});
