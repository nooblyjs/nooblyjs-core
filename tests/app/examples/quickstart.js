const express = require('express');
const helmet = require('helmet');
const serviceRegistry = require('../../../index');

const app = express();

// Security headers: applied before other middleware so every response is
// covered. CSP is disabled here to match the main apps (app.js / app-noauth.js)
// because the service dashboards use inline styles/scripts; enable a tuned CSP
// per deployment.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// STEP 1: Initialize the service registry (REQUIRED FIRST)
serviceRegistry.initialize(app);

// STEP 2: Get services you need
const cache = serviceRegistry.cache('memory');
const logger = serviceRegistry.logger('file', { logDir: './logs' });
const dataService = serviceRegistry.dataService('memory');

// STEP 3: Use services
async function demo() {
  // Caching example
  await cache.put('user:123', { name: 'John' }, 3600);
  const user = await cache.get('user:123');
  logger.info('User:', user);

  // DataService example
  const uuid = await dataService.add('users', { name: 'Jane', status: 'active' });
  logger.error('Created user:' + uuid);
}

app.listen(3000, () => {
  logger.info('Server running on port 3000');
  demo();
});