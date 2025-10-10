/**
 * @fileoverview Test script for logging UI with analytics dashboard
 * Starts a server and generates test logs to populate the dashboard
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

console.log('\n=== Testing Logging UI with Analytics Dashboard ===\n');

// Generate diverse test logs
async function generateTestLogs() {
  console.log('Generating test logs...\n');

  // Application lifecycle logs
  await logger.info('Application initialization started');
  await logger.info('Database connection pool created');
  await logger.info('Redis cache connected successfully');

  // User activity logs
  await logger.info('User john@example.com logged in from 192.168.1.100');
  await logger.info('User jane@example.com accessed dashboard');
  await logger.info('User admin@example.com updated system settings');

  // Warning logs
  await logger.warn('Cache memory usage at 75% - consider cleanup');
  await logger.warn('API rate limit approaching threshold for client_123');
  await logger.warn('Slow query detected: users table scan took 2.5s');
  await logger.warn('Disk space on /var/log at 85%');

  // Processing logs
  await logger.info('Batch job #1001 started - processing 5000 records');
  await logger.info('Email notification sent to user@example.com');
  await logger.info('Scheduled task "daily_backup" completed successfully');

  // Error logs
  await logger.error('Database connection timeout - retrying in 5s');
  await logger.error('Failed to send SMS notification - provider unreachable');
  await logger.error('File upload failed: insufficient permissions on /uploads');

  // More warnings
  await logger.warn('High CPU usage detected: 92% average over 5 minutes');
  await logger.warn('Retry attempt 1/3 for failed operation op_12345');

  // System logs
  await logger.info('Cleanup task started: removing old session data');
  await logger.info('Cache cleared successfully: 1,234 entries removed');

  // Critical errors
  await logger.error('Payment gateway returned error 500 - transaction rolled back');
  await logger.error('Security scan detected suspicious activity from IP 203.0.113.42');

  // Performance logs
  await logger.info('API endpoint /api/users responded in 45ms');
  await logger.warn('API endpoint /api/reports responded in 3.2s - investigating');

  // More info logs
  await logger.info('New user registration: user_789');
  await logger.info('Configuration reloaded from config.json');
  await logger.info('Background worker #3 completed task queue');

  console.log('✓ Generated 25+ test logs across all levels\n');
}

// Start the server and run tests
const server = app.listen(3000, async () => {
  console.log('Test server started on http://localhost:3000\n');

  try {
    await generateTestLogs();

    // Wait a moment for events to propagate
    await new Promise(resolve => setTimeout(resolve, 200));

    // Test the analytics API
    console.log('--- Testing Analytics API ---\n');

    // Test all logs
    const allLogsResponse = await fetch('http://localhost:3000/services/logging/api/logs');
    const allLogs = await allLogsResponse.json();
    console.log(`✓ All logs: ${allLogs.count} entries`);

    // Test INFO filter
    const infoResponse = await fetch('http://localhost:3000/services/logging/api/logs?level=INFO');
    const infoLogs = await infoResponse.json();
    console.log(`✓ INFO logs: ${infoLogs.count} entries`);

    // Test WARN filter
    const warnResponse = await fetch('http://localhost:3000/services/logging/api/logs?level=WARN');
    const warnLogs = await warnResponse.json();
    console.log(`✓ WARN logs: ${warnLogs.count} entries`);

    // Test ERROR filter
    const errorResponse = await fetch('http://localhost:3000/services/logging/api/logs?level=ERROR');
    const errorLogs = await errorResponse.json();
    console.log(`✓ ERROR logs: ${errorLogs.count} entries`);

    console.log('\n=== All Tests Completed Successfully! ===\n');
    console.log('🌐 Open your browser to: http://localhost:3000/services/logging/views/\n');
    console.log('You can now:');
    console.log('  • View the Dashboard tab with all log entries');
    console.log('  • Filter logs by level using the dropdown');
    console.log('  • Use the Data tab to submit new logs');
    console.log('  • Test the API using Swagger UI\n');
    console.log('Press Ctrl+C to stop the server\n');

  } catch (error) {
    console.error('❌ Test error:', error);
    server.close();
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down test server...');
  server.close(() => {
    console.log('Server stopped. Goodbye!\n');
    process.exit(0);
  });
});
