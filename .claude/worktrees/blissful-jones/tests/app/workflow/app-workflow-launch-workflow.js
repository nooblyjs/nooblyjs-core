/**
 * Test Application for Workflow-to-Workflow Invocation
 */

'use strict';

const path = require('node:path');
const EventEmitter = require('events');
const express = require('express');

const app = express();
app.use(express.json());

const options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  'express-app': app,
  security: {
    apiKeyAuth: { requireApiKey: false },
    servicesAuth: { requireLogin: false }
  }
};

const eventEmitter = new EventEmitter();
const serviceRegistry = require('../../../index');
serviceRegistry.initialize(app, eventEmitter, options);

const logger = serviceRegistry.logger();
const authservice = serviceRegistry.authservice();
const filing = serviceRegistry.filing();
const queueing = serviceRegistry.queue();
const worker = serviceRegistry.working('default', {
  maxThreads: 4,
  activitiesFolder: 'activities',
  dependencies: { queueing, filing }
});

const workflow = serviceRegistry.workflow();
const scheduler = serviceRegistry.scheduling();

app.get('/', (req, res) => res.redirect('/services'));

app.listen(3101, async () => {
  logger.info('Server running on port 3101');
  logger.info('Workflow Launch Test started');

  try {
    // Define workflows using absolute paths
    const activitiesPath = path.join(__dirname, '../activities');

    await workflow.defineWorkflow('validate-order', [
      path.join(activitiesPath, 'exampleTask.js')
    ]);
    logger.info('✓ Workflow: validate-order defined');

    await workflow.defineWorkflow('process-order', [
      path.join(activitiesPath, 'exampleTask.js'),
      path.join(activitiesPath, 'exampleTask-2.js')
    ]);
    logger.info('✓ Workflow: process-order defined');

    await workflow.defineWorkflow('composite-order-flow', [
      path.join(activitiesPath, 'exampleTask.js'),
      path.join(__dirname, '../../../src/workflow/activities/workflow-run-workflow.js')
    ]);
    logger.info('✓ Workflow: composite-order-flow defined');

    // TEST 1
    logger.info('\n--- TEST 1: Simple Workflow ---');
    await workflow.runWorkflow('validate-order', 
      { orderId: 1001, amount: 99.99 },
      (status) => {
        if (status.status === 'workflow_complete') {
          logger.info('✓ PASS: validate-order completed');
        }
      }
    );

    // TEST 2
    logger.info('\n--- TEST 2: Multi-Step Workflow ---');
    await workflow.runWorkflow('process-order',
      { orderId: 1002, amount: 149.99 },
      (status) => {
        if (status.status === 'workflow_complete') {
          logger.info('✓ PASS: process-order completed');
        }
      }
    );

    // TEST 3
    logger.info('\n--- TEST 3: Composite Workflow (Workflow -> Workflow) ---');
    await workflow.runWorkflow('composite-order-flow',
      {
        orderId: 1003,
        workflowName: 'process-order',
        workflowData: { nestedOrderId: 1003 }
      },
      (status) => {
        if (status.status === 'workflow_complete') {
          logger.info('✓ PASS: composite-order-flow completed');
        }
      }
    );

    // TEST 4
    logger.info('\n--- TEST 4: Scheduled Workflow ---');
    let count = 0;
    await scheduler.start(
      'scheduled-test',
      '../../../src/workflow/activities/workflow-run-workflow.js',
      { workflowName: 'validate-order', workflowData: { orderId: 2000 } },
      15,
      (status, data) => {
        count++;
        if (status === 'completed') {
          logger.info('✓ Scheduled execution #' + count + ' completed');
        }
      }
    );
    logger.info('✓ TEST 4: Scheduled workflow running (every 15 seconds)');

    logger.info('\n' + '='.repeat(60));
    logger.info('ALL TESTS INITIALIZED');
    logger.info('='.repeat(60));
    logger.info('View workflows: http://localhost:3101/services/workflow/');
    logger.info('View scheduler: http://localhost:3101/services/scheduling/');
    logger.info('Press Ctrl+C to stop');
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error('Initialization failed: ' + error.message);
    console.error(error);
    process.exit(1);
  }
});
