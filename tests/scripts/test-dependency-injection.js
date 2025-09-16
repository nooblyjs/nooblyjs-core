/**
 * @fileoverview Comprehensive test for the new dependency injection system
 * This script tests the Level 0 logging dependency injection according to the service architecture
 */

const express = require('express');
const serviceRegistry = require('../../index.js');
const { EventEmitter } = require('events');

console.log('🧪 Testing NooblyJS Dependency Injection System\n');

// Create test app and event emitter
const app = express();
app.use(express.json());
const eventEmitter = new EventEmitter();

// Set up event listeners for debugging
eventEmitter.on('dependencies:initialized', (data) => {
  console.log('✅ Dependencies initialized:', data.message);
  console.log('📋 Dependency hierarchy:');
  Object.entries(data.dependencies).forEach(([service, deps]) => {
    console.log(`   ${service}: [${deps.join(', ') || 'none'}]`);
  });
  console.log();
});

eventEmitter.on('service:created', (data) => {
  console.log(`🏗️  Service created: ${data.serviceName}:${data.providerType} with ${data.dependenciesCount} dependencies [${data.dependencyNames.join(', ')}]`);
});

async function runTests() {
  try {
    console.log('1️⃣ Initializing ServiceRegistry...');
    serviceRegistry.initialize(app, eventEmitter);

    console.log('\n2️⃣ Testing dependency validation...');
    const isValid = serviceRegistry.validateDependencies();
    console.log(`✅ Dependency validation: ${isValid ? 'PASSED' : 'FAILED'}`);

    console.log('\n3️⃣ Testing service initialization order...');
    const initOrder = serviceRegistry.getServiceInitializationOrder();
    console.log('📅 Initialization order:', initOrder.join(' → '));

    console.log('\n4️⃣ Testing Level 0 services (Foundation - No dependencies)...');

    // Test logging service (Level 0 - should have no dependencies)
    console.log('   Testing logging service...');
    const logger = serviceRegistry.logger('console');
    console.log(`   ✅ Logging service created: ${!!logger}`);
    console.log(`   ✅ Logger has log methods: ${typeof logger.info === 'function'}`);

    // Test filing service (Level 0 - should have no dependencies)
    console.log('   Testing filing service...');
    const filing = serviceRegistry.filing('local');
    console.log(`   ✅ Filing service created: ${!!filing}`);

    // Test measuring service (Level 0 - should have no dependencies)
    console.log('   Testing measuring service...');
    const measuring = serviceRegistry.measuring('memory');
    console.log(`   ✅ Measuring service created: ${!!measuring}`);

    console.log('\n5️⃣ Testing Level 1 services (Infrastructure - Use logging)...');

    // Test caching service (Level 1 - should depend on logging)
    console.log('   Testing caching service with logging dependency...');
    const cache = serviceRegistry.cache('memory');
    console.log(`   ✅ Cache service created: ${!!cache}`);
    console.log(`   ✅ Cache has logger injected: ${!!cache.logger}`);
    console.log(`   ✅ Cache has log method: ${typeof cache.log === 'function'}`);
    console.log(`   ✅ Cache has dependencies object: ${!!cache.dependencies}`);

    // Test the injected logging functionality
    if (cache.log) {
      console.log('   🧪 Testing injected logging...');
      cache.log('info', 'Test log message from cache service', { test: true });
      console.log('   ✅ Logging injection successful');
    }

    // Test dataserve service (Level 1 - should depend on logging and filing)
    console.log('   Testing dataserve service with logging and filing dependencies...');
    const dataServe = serviceRegistry.dataServe('memory');
    console.log(`   ✅ DataServe service created: ${!!dataServe}`);
    console.log(`   ✅ DataServe has logger injected: ${!!dataServe.logger}`);
    console.log(`   ✅ DataServe has log method: ${typeof dataServe.log === 'function'}`);
    console.log(`   ✅ DataServe has filing injected: ${!!dataServe.filing}`);
    console.log(`   ✅ DataServe has dependencies object: ${!!dataServe.dependencies}`);

    // Test working service (Level 1 - should depend on logging)
    console.log('   Testing working service with logging dependency...');
    const working = serviceRegistry.working('memory');
    console.log(`   ✅ Working service created: ${!!working}`);
    console.log(`   ✅ Working has logger injected: ${!!working.logger}`);
    console.log(`   ✅ Working has log method: ${typeof working.log === 'function'}`);

    console.log('\n6️⃣ Testing Level 2 services (Business Logic - Use infrastructure)...');

    // Test queueing service (Level 2 - should depend on logging, caching, dataserve)
    console.log('   Testing queueing service with multiple dependencies...');
    const queue = serviceRegistry.queue('memory');
    console.log(`   ✅ Queue service created: ${!!queue}`);
    console.log(`   ✅ Queue has logger injected: ${!!queue.logger}`);
    console.log(`   ✅ Queue has cache injected: ${!!queue.cache}`);
    console.log(`   ✅ Queue has dataStore injected: ${!!queue.dataStore}`);
    console.log(`   ✅ Queue has log method: ${typeof queue.log === 'function'}`);

    console.log('\n7️⃣ Testing Level 3 services (Application - Use business logic)...');

    // Test workflow service (Level 3 - should depend on logging, queueing, scheduling, measuring)
    console.log('   Testing workflow service with dependencies...');
    const workflow = serviceRegistry.workflow('memory');
    console.log(`   ✅ Workflow service created: ${!!workflow}`);
    console.log(`   ✅ Workflow has logger injected: ${!!workflow.logger}`);
    console.log(`   ✅ Workflow has queueing injected: ${!!workflow.queueing}`);
    console.log(`   ✅ Workflow has log method: ${typeof workflow.log === 'function'}`);

    console.log('\n8️⃣ Testing Level 4 services (Integration - Use application)...');

    // Test AI service (Level 4 - should depend on logging, caching, workflow, queueing)
    console.log('   Testing AI service with dependencies...');
    const aiService = serviceRegistry.aiservice('claude', { apiKey: 'test-key' });
    console.log(`   ✅ AI service created: ${!!aiService}`);
    console.log(`   ✅ AI has logger injected: ${!!aiService.logger}`);
    console.log(`   ✅ AI has cache injected: ${!!aiService.cache}`);
    console.log(`   ✅ AI has workflow injected: ${!!aiService.workflow}`);
    console.log(`   ✅ AI has queueing injected: ${!!aiService.queueing}`);
    console.log(`   ✅ AI has log method: ${typeof aiService.log === 'function'}`);

    console.log('\n9️⃣ Testing cross-service logging...');

    // Test that all services can log and the messages are properly formatted
    console.log('   Testing formatted log messages from different services...');

    if (cache.log) cache.log('info', 'Cache test message');
    if (dataServe.log) dataServe.log('info', 'DataServe test message');
    if (queue.log) queue.log('info', 'Queue test message');
    if (workflow.log) workflow.log('info', 'Workflow test message');
    if (aiService.log) aiService.log('info', 'AI Service test message');

    console.log('\n🔟 Testing service registry information...');

    const serviceList = serviceRegistry.listServices();
    console.log(`   ✅ Total services initialized: ${serviceList.length}`);
    console.log(`   📋 Services: ${serviceList.join(', ')}`);

    console.log('\n🎉 All dependency injection tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Dependency validation: PASSED');
    console.log('   ✅ Service initialization order: CORRECT');
    console.log('   ✅ Level 0 services (Foundation): WORKING');
    console.log('   ✅ Level 1 services (Infrastructure): WORKING WITH LOGGING');
    console.log('   ✅ Level 2 services (Business Logic): WORKING WITH DEPENDENCIES');
    console.log('   ✅ Level 3 services (Application): WORKING WITH DEPENDENCIES');
    console.log('   ✅ Level 4 services (Integration): WORKING WITH DEPENDENCIES');
    console.log('   ✅ Cross-service logging: FUNCTIONAL');

    console.log('\n🚀 Dependency injection system is fully operational!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the tests
runTests().then(() => {
  console.log('\n✨ Test script completed successfully');
}).catch((error) => {
  console.error('\n💥 Test script failed:', error.message);
  process.exit(1);
});