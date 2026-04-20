/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');
const express = require('express');
const { EventEmitter } = require('events');

const app = express();
app.use(express.json());

// Add options
const options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  'express-app': app,
  brandingConfig: {
    appName: 'Measuring Test',
    primaryColor: '#000'
  },
  security: {
    apiKeyAuth: {
      requireApiKey: false,
      apiKeys: []
    },
    servicesAuth: {
      requireLogin: false
    }
  }
};

// Declare the Event Emitter
const eventEmitter = new EventEmitter();

// Initialize registry
const serviceRegistry = require('../../../index');
serviceRegistry.initialize(app, eventEmitter, options);

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

// Load styles
app.use('/styles.css', express.static(path.join(__dirname, 'styles.css')));

// Load styles
app.use('/images/s-tech-logo-colour.png', express.static(path.join(__dirname, '/images/s-tech-logo-colour.png')));

app.listen(3101, async () => {
  logger.info('Server running on port 3101');
  logger.info('Visit: http://localhost:3101/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3101/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3101/services/authservice/views/register.html');

  // Define workflow with ExampleTask.js and ExampleTask-2.js
  await workflow.defineWorkflow('example-workflow', [
    'exampleTask.js',
    'exampleTask-2.js'
  ]);

  await workflow.defineWorkflow('example-workflow-1', [
    'exampleTask.js'
  ]);

  await workflow.defineWorkflow('example-workflow-2', [
    'exampleTask-2.js'
  ]);


  logger.info('Workflow "example-workflow" defined');
  logger.info('Starting workflow execution every 10 seconds...');

  // Function to run the workflow
  const runWorkflow = async () => {
    try {
      logger.info('Starting workflow execution...');
      await workflow.runWorkflow('example-workflow', { timestamp: new Date().toISOString() }, (status) => {
        logger.info(`Workflow status: ${status.status}`, status);
      });
      await workflow.runWorkflow('example-workflow-1', { timestamp: new Date().toISOString() }, (status) => {
        logger.info(`Workflow status: ${status.status}`, status);
      });
      await workflow.runWorkflow('example-workflow-2', { timestamp: new Date().toISOString() }, (status) => {
        logger.info(`Workflow status: ${status.status}`, status);
      });
      logger.info('Workflow completed successfully');
    } catch (error) {
      console.error('Workflow execution failed - Full error:', error);
      logger.error('Workflow execution failed:', error.message || 'Unknown error');
      if (error.stack) {
        console.error('Error stack:', error.stack);
      }
    }
  };

  // Run workflow immediately
  runWorkflow();

  // Then run every 10 seconds
  setInterval(runWorkflow, 1000);
});
