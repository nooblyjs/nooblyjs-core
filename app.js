/**
 * @fileoverview Application demonstrating Noobly JS Core services.
 * This file serves as a comprehensive example of how to use all available
 * services in the Noobly JS Core framework.
 *
 * @author Noobly JS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const config = require('dotenv').config();

const parseCommaSeparated = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

// Create the Express application
const app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Configure session management with secure defaults
 * SESSION_SECRET environment variable is required for secure session storage
 */
const sessionSecret = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === 'production';

if (!sessionSecret && isProduction) {
  console.error('FATAL ERROR: SESSION_SECRET is not set in production.');
  console.error('Set the SESSION_SECRET environment variable to a strong, random value.');
  console.error('Example: export SESSION_SECRET=$(node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")');
  process.exit(1);
}

if (!sessionSecret && !isProduction) {
  console.warn('⚠️  WARNING: SESSION_SECRET is not set. Using development default.');
  console.warn('   For production, set SESSION_SECRET to a secure random value.');
}

app.use(session({
  secret: sessionSecret || 'dev-only-insecure-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Load the service registry library
const serviceRegistry = require('./index');

/**
 * Configure API keys for authentication
 *
 * Environment Variables (in order of precedence):
 * - KNOWLEDGEREPOSITORY_API_KEYS: Comma-separated API keys (legacy name)
 * - API_KEYS: Comma-separated API keys
 * - API_KEY: Single API key
 *
 * ⚠️ SECURITY WARNING:
 * - In PRODUCTION: API keys must be set via environment variables. Never auto-generated.
 * - In DEVELOPMENT: If no keys are configured, one will be auto-generated for convenience.
 *   Auto-generated keys are logged to console. DO NOT use in production.
 * - API keys should be long, random values (min 32 characters recommended)
 * - Rotate API keys regularly
 * - Never commit API keys to version control
 */
const configuredApiKeys = parseCommaSeparated(
  process.env.KNOWLEDGEREPOSITORY_API_KEYS || process.env.API_KEYS || process.env.API_KEY || ''
);

// Enforce strict security in production
if (configuredApiKeys.length === 0 && isProduction) {
  console.error('FATAL ERROR: No API keys configured for production.');
  console.error('Set API_KEYS or API_KEY environment variable with comma-separated values.');
  console.error('Example: export API_KEYS="key1,key2,key3"');
  process.exit(1);
}

// Generate a development API key only if not in production
let generatedDevApiKey = null;
if (configuredApiKeys.length === 0 && !isProduction) {
  generatedDevApiKey = serviceRegistry.generateApiKey();
  configuredApiKeys.push(generatedDevApiKey);
  console.warn('⚠️  DEVELOPMENT MODE: Generated temporary API key (for testing only)');
  console.warn(`    API Key: ${generatedDevApiKey}`);
  console.warn('    Store this key to test API endpoints.');
  console.warn('    For production, set API_KEYS environment variable with real keys.');
}

// Instantiate the options
// options.logDir - Directory for log files
// options.dataDir - Directory for data storage
// options.apiKeys - Array of valid API keys
// options.requireApiKey - Boolean indicating if API key is required
// options.excludePaths - Array of paths to exclude from API key checks
const options = {
  logDir: path.join(__dirname, './.application/', 'logs'),
  dataDir: path.join(__dirname, './.application/', 'data'),
  apiKeys: configuredApiKeys,
  requireApiKey: configuredApiKeys.length > 0,
  excludePaths: [
    '/services/*/status',
    '/services/',
    '/services/uiservice/*',
    '/services/*/views/*',
    '/services/authservice/api/login',
    '/services/authservice/api/register'
  ]
};

// Initialize the service registry
const eventEmitter = new EventEmitter();
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize all services
const log = serviceRegistry.logger('file');
app.set('logger', log); // Make logger available to app
const cache = serviceRegistry.cache('inmemory');
const dataService = serviceRegistry.dataService('file');
const filing = serviceRegistry.filing('local');
const queue = serviceRegistry.queue('memory');
const scheduling = serviceRegistry.scheduling('memory');
const searching = serviceRegistry.searching('memory');
const measuring = serviceRegistry.measuring('memory');
const notifying = serviceRegistry.notifying('memory');
const worker = serviceRegistry.working('memory');
const workflow = serviceRegistry.workflow('memory');
const fetching = serviceRegistry.fetching('node');
const authservice = serviceRegistry.authservice('file');

/**
 * Setup production health checks for load balancers and orchestration
 * Provides:
 * - /health - Quick liveness check (Docker, load balancers)
 * - /health/live - Kubernetes liveness probe
 * - /health/ready - Kubernetes readiness probe
 * - /health/startup - Kubernetes startup probe
 * - /health/detailed - Full status report (protected)
 */
const { createHealthCheckMiddleware } = require('./src/middleware/healthCheck');
const setupHealthChecks = createHealthCheckMiddleware({
  logger: log,
  criticalDependencies: ['cache', 'dataService']
});

// Setup health check endpoints (must be before other middleware)
const healthCheckManager = setupHealthChecks(app, serviceRegistry.servicesAuthMiddleware);

// Mark application as ready after services are initialized
healthCheckManager.markReady();

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

// ... (docs/ui route definitions)

// Global Error Handler
const errorHandler = require('./src/middleware/errorHandler');
app.use(errorHandler);

app.listen(process.env.PORT || 9000, () => {
  log.info(`Server is running on port ${process.env.PORT || 9000}`);
});

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  log.info(`${signal} received. Starting graceful shutdown...`);
  try {
    await serviceRegistry.shutdown();
    log.info('All services shut down successfully.');
    process.exit(0);
  } catch (error) {
    log.error('Error during graceful shutdown:', error.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
