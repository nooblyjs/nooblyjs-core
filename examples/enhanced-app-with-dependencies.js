/**
 * @fileoverview Enhanced NooblyJS Application with Dependency Injection
 * This example demonstrates the Level 0 logging dependency injection system
 * where all services automatically receive the logging service as a dependency.
 *
 * @author NooblyJS Team
 * @version 1.0.15
 * @since 1.3.1
 */

'use strict';

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const serviceRegistry = require('../index');
const { EventEmitter } = require('events');
const config = require('dotenv').config();

console.log('🚀 Starting Enhanced NooblyJS Core with Dependency Injection\n');

/** @type {express.Application} Express application instance */
const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Create global event emitter and set up dependency injection event listeners
 */
const eventEmitter = new EventEmitter();

// Set up event listeners to monitor dependency injection
eventEmitter.on('dependencies:initialized', (data) => {
  console.log('🔗 Service dependency hierarchy initialized');
  console.log('📋 Dependencies:', JSON.stringify(data.dependencies, null, 2));
  console.log();
});

eventEmitter.on('service:created', (data) => {
  console.log(`🏗️  ${data.serviceName}:${data.providerType} created with ${data.dependenciesCount} injected dependencies: [${data.dependencyNames.join(', ')}]`);
});

/**
 * Initialize the service registry with the Express app.
 * This sets up all services and their REST endpoints with dependency injection.
 */
serviceRegistry.initialize(app, eventEmitter);

/**
 * Initialize services to demonstrate the dependency injection system.
 * Services will automatically receive their dependencies based on the hierarchy.
 */
console.log('📦 Creating services with dependency injection...\n');

// Level 0 services (Foundation - No dependencies)
console.log('Level 0 Services (Foundation):');
const logger = serviceRegistry.logger('console');
const filing = serviceRegistry.filing('local');
const measuring = serviceRegistry.measuring('memory');

// Level 1 services (Infrastructure - Use foundation services)
console.log('\nLevel 1 Services (Infrastructure):');
const cache = serviceRegistry.cache('memory');
const dataServe = serviceRegistry.dataServe('memory');
const working = serviceRegistry.working('memory');

// Level 2 services (Business Logic - Use infrastructure services)
console.log('\nLevel 2 Services (Business Logic):');
const queue = serviceRegistry.queue('memory');

// Level 3 services (Application - Use business logic services)
console.log('\nLevel 3 Services (Application):');
const workflow = serviceRegistry.workflow('memory');

// Level 4 services (Integration - Use application services)
console.log('\nLevel 4 Services (Integration):');
const aiservice = serviceRegistry.aiservice('claude', {
  apiKey: process.env.aiapikey || 'demo-key'
});

console.log('\n🎯 Demonstrating Enhanced Service Capabilities with Logging:\n');

/**
 * Demonstrate enhanced cache operations with dependency injection
 */
function demonstrateEnhancedCache() {
  console.log('📦 Enhanced Cache Service Demonstration:');

  // The cache service now has logging capabilities injected
  if (cache.log) {
    cache.log('info', 'Starting cache demonstration');
  }

  // Perform cache operations - these will be automatically logged
  cache.put('demo-key', { message: 'Hello Dependency Injection!', timestamp: new Date() });
  const value = cache.get('demo-key');

  if (cache.log) {
    cache.log('info', 'Cache operations completed', {
      operations: ['put', 'get'],
      keyCount: 1
    });
  }

  console.log('   ✅ Cache operations with automatic logging');
  console.log(`   ✅ Retrieved value: ${JSON.stringify(value)}`);
  console.log();
}

/**
 * Demonstrate enhanced data service operations with dependency injection
 */
async function demonstrateEnhancedDataServe() {
  console.log('💾 Enhanced DataServe Service Demonstration:');

  // The dataserve service now has logging and filing capabilities injected
  if (dataServe.log) {
    dataServe.log('info', 'Starting dataserve demonstration');
  }

  // Create container and add data - these will be automatically logged
  await dataServe.createContainer('users');
  const userId = await dataServe.add('users', {
    username: 'john_doe',
    fullname: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date()
  });

  if (dataServe.log) {
    dataServe.log('info', 'User data stored', {
      container: 'users',
      userId: userId,
      hasFilingService: !!dataServe.filing
    });
  }

  console.log('   ✅ DataServe operations with automatic logging');
  console.log(`   ✅ User ID: ${userId}`);
  console.log(`   ✅ Filing service available: ${!!dataServe.filing}`);
  console.log();
}

/**
 * Demonstrate enhanced queue operations with dependency injection
 */
function demonstrateEnhancedQueue() {
  console.log('🔄 Enhanced Queue Service Demonstration:');

  // The queue service now has logging, caching, and datastore capabilities injected
  if (queue.log) {
    queue.log('info', 'Starting queue demonstration');
  }

  // Enqueue items - these will be automatically logged
  queue.enqueue({
    type: 'email',
    recipient: 'user@example.com',
    message: 'Welcome to NooblyJS!'
  });

  queue.enqueue({
    type: 'notification',
    userId: '12345',
    alert: 'System maintenance scheduled'
  });

  if (queue.log) {
    queue.log('info', 'Queue operations completed', {
      itemsEnqueued: 2,
      hasCaching: !!queue.cache,
      hasDataStore: !!queue.dataStore
    });
  }

  console.log('   ✅ Queue operations with automatic logging');
  console.log(`   ✅ Cache service available: ${!!queue.cache}`);
  console.log(`   ✅ DataStore service available: ${!!queue.dataStore}`);
  console.log();
}

/**
 * Demonstrate enhanced workflow operations with dependency injection
 */
function demonstrateEnhancedWorkflow() {
  console.log('⚡ Enhanced Workflow Service Demonstration:');

  // The workflow service now has logging, queueing, scheduling, and measuring capabilities injected
  if (workflow.log) {
    workflow.log('info', 'Starting workflow demonstration');
  }

  // Define a simple workflow
  const steps = [
    path.resolve(__dirname, '../tests/unit/workflow/steps/exampleStep1.js'),
    path.resolve(__dirname, '../tests/unit/workflow/steps/exampleStep2.js'),
  ];

  workflow.defineWorkflow('enhanced-demo-workflow', steps);

  if (workflow.log) {
    workflow.log('info', 'Workflow defined', {
      workflowName: 'enhanced-demo-workflow',
      stepCount: steps.length,
      hasQueueing: !!workflow.queueing,
      hasScheduling: !!workflow.scheduling,
      hasMeasuring: !!workflow.measuring
    });
  }

  console.log('   ✅ Workflow definition with automatic logging');
  console.log(`   ✅ Queueing service available: ${!!workflow.queueing}`);
  console.log(`   ✅ Scheduling service available: ${!!workflow.scheduling}`);
  console.log(`   ✅ Measuring service available: ${!!workflow.measuring}`);
  console.log();
}

/**
 * Demonstrate enhanced AI service operations with dependency injection
 */
function demonstrateEnhancedAIService() {
  console.log('🤖 Enhanced AI Service Demonstration:');

  // The AI service now has logging, caching, workflow, and queueing capabilities injected
  if (aiservice.log) {
    aiservice.log('info', 'Starting AI service demonstration');
  }

  if (aiservice.log) {
    aiservice.log('info', 'AI service capabilities', {
      provider: 'claude',
      hasLogging: !!aiservice.logger,
      hasCaching: !!aiservice.cache,
      hasWorkflow: !!aiservice.workflow,
      hasQueueing: !!aiservice.queueing
    });
  }

  console.log('   ✅ AI service with automatic logging');
  console.log(`   ✅ Cache service available: ${!!aiservice.cache}`);
  console.log(`   ✅ Workflow service available: ${!!aiservice.workflow}`);
  console.log(`   ✅ Queueing service available: ${!!aiservice.queueing}`);
  console.log();
}

/**
 * Demonstrate service information and dependency graph
 */
function demonstrateServiceRegistry() {
  console.log('📊 Service Registry Information:');

  const serviceList = serviceRegistry.listServices();
  const initOrder = serviceRegistry.getServiceInitializationOrder();

  console.log(`   📦 Total services: ${serviceList.length}`);
  console.log(`   🔗 Services: ${serviceList.join(', ')}`);
  console.log(`   📅 Initialization order: ${initOrder.join(' → ')}`);
  console.log();
}

/**
 * Main application execution
 */
async function runEnhancedApplication() {
  try {
    console.log('🎯 Running enhanced service demonstrations...\n');

    // Demonstrate each enhanced service
    demonstrateEnhancedCache();
    await demonstrateEnhancedDataServe();
    demonstrateEnhancedQueue();
    demonstrateEnhancedWorkflow();
    demonstrateEnhancedAIService();
    demonstrateServiceRegistry();

    console.log('✨ All enhanced service demonstrations completed successfully!');
    console.log('\n🔍 Key Benefits of Dependency Injection:');
    console.log('   ✅ Automatic logging in all services');
    console.log('   ✅ Service composition and reusability');
    console.log('   ✅ Proper initialization order');
    console.log('   ✅ Consistent service interfaces');
    console.log('   ✅ Enhanced observability and debugging');

  } catch (error) {
    console.error('❌ Enhanced application error:', error.message);
  }
}

// Start the enhanced application
const PORT = process.env.PORT || 3002;
app.use('/', express.static(__dirname + '/../public'));

app.listen(PORT, async () => {
  console.log(`🌟 Enhanced NooblyJS Core server running on port ${PORT}`);
  console.log(`📋 Services available at: http://localhost:${PORT}/services/`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/services/documentation`);
  console.log();

  // Run the enhanced demonstrations
  await runEnhancedApplication();

  console.log(`\n🚀 Enhanced server ready for requests with dependency injection!`);
});

module.exports = { app, serviceRegistry };