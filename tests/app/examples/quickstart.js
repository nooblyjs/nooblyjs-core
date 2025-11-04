const express = require('express');
const serviceRegistry = require('nooblyjs-core');

const app = express();
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