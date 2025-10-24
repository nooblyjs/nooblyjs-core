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
const dataService = serviceRegistry.dataService();
const worker = serviceRegistry.working();
const workflow = serviceRegistry.workflow();

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

app.listen(3001, async () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:3001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3001/services/authservice/views/register.html');

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
