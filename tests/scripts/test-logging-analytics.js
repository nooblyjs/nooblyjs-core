/**
 * @fileoverview Test script for logging analytics module
 * Demonstrates the analytics functionality with log capture and retrieval
 */

const express = require('express');
const serviceRegistry = require('../../index');

// Create Express app
const app = express();
app.use(express.json());

// Initialize the service registry
serviceRegistry.initialize(app);

// Get the logging service (memory provider by default)
const logger = serviceRegistry.logger('memory');

console.log('\n=== Testing Logging Analytics Module ===\n');

// Helper function to make HTTP request
async function makeRequest(url, level) {
  const response = await fetch(url);
  const data = await response.json();
  console.log(`\n${level} logs (count: ${data.count}):`);
  if (data.logs && data.logs.length > 0) {
    data.logs.slice(0, 3).forEach(log => {
      console.log(`  - [${log.level}] ${log.timestamp}: ${log.message.substring(0, 80)}...`);
    });
    if (data.logs.length > 3) {
      console.log(`  ... and ${data.logs.length - 3} more`);
    }
  }
}

// Start the server and run tests
const server = app.listen(3000, async () => {
  console.log('Test server started on port 3000\n');

  try {
    // Generate some test logs
    console.log('Generating test logs...\n');

    await logger.info('Application started successfully');
    await logger.info('User authentication initialized');
    await logger.warn('Cache memory usage at 75%');
    await logger.info('Processing batch job #1001');
    await logger.error('Database connection timeout');
    await logger.warn('Retry attempt 1 of 3');
    await logger.info('Batch job completed');
    await logger.error('Failed to send notification email');
    await logger.info('Cleanup task started');
    await logger.warn('High CPU usage detected');

    // Wait a moment for events to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('Test logs generated successfully!\n');

    // Test retrieving all logs
    console.log('--- Test 1: Retrieve ALL logs ---');
    await makeRequest('http://localhost:3000/services/logging/api/logs', 'ALL');

    // Test retrieving INFO logs
    console.log('\n--- Test 2: Retrieve INFO logs ---');
    await makeRequest('http://localhost:3000/services/logging/api/logs?level=info', 'INFO');

    // Test retrieving WARN logs
    console.log('\n--- Test 3: Retrieve WARN logs ---');
    await makeRequest('http://localhost:3000/services/logging/api/logs?level=warn', 'WARN');

    // Test retrieving ERROR logs
    console.log('\n--- Test 4: Retrieve ERROR logs ---');
    await makeRequest('http://localhost:3000/services/logging/api/logs?level=error', 'ERROR');

    console.log('\n=== All Tests Completed Successfully! ===\n');

  } catch (error) {
    console.error('Test error:', error);
  } finally {
    // Close the server
    server.close();
    console.log('Test server stopped\n');
  }
});
