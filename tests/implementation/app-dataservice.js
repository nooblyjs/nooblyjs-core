/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const serviceRegistry = require('../../index');

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

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

// Random data generators
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'James', 'Mary', 'Robert', 'Jennifer', 'William', 'Linda', 'Richard', 'Patricia'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson'];
const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd', 'Elm St', 'Washington Blvd', 'Park Ave', 'Lake View Dr', 'Forest Rd'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH', 'MI', 'GA'];
const countries = ['USA', 'Canada', 'Mexico', 'UK', 'Germany', 'France', 'Italy', 'Spain', 'Japan', 'Australia'];
const bankNames = ['Chase Bank', 'Wells Fargo', 'Bank of America', 'Citibank', 'US Bank', 'Capital One', 'PNC Bank', 'TD Bank'];
const transactionTypes = ['deposit', 'withdrawal', 'transfer', 'payment', 'refund'];

// Helper to get random element
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Store UUIDs for later operations
const containerData = {
  people: [],
  addresses: [],
  countries: [],
  cities: [],
  'bank-transactions': []
};

// Generate random person
function generatePerson() {
  return {
    firstName: getRandomElement(firstNames),
    lastName: getRandomElement(lastNames),
    age: getRandomNumber(18, 80),
    email: `${getRandomElement(firstNames).toLowerCase()}.${getRandomElement(lastNames).toLowerCase()}@example.com`,
    phone: `+1-${getRandomNumber(200, 999)}-${getRandomNumber(200, 999)}-${getRandomNumber(1000, 9999)}`,
    status: getRandomElement(['active', 'inactive', 'pending']),
    createdAt: new Date().toISOString()
  };
}

// Generate random address
function generateAddress() {
  return {
    street: `${getRandomNumber(1, 9999)} ${getRandomElement(streets)}`,
    city: getRandomElement(cities),
    state: getRandomElement(states),
    zipCode: `${getRandomNumber(10000, 99999)}`,
    country: 'USA',
    type: getRandomElement(['home', 'work', 'billing', 'shipping'])
  };
}

// Generate random country
function generateCountry() {
  const country = getRandomElement(countries);
  return {
    name: country,
    code: country.substring(0, 2).toUpperCase(),
    population: getRandomNumber(1000000, 1000000000),
    gdp: getRandomNumber(100000000, 20000000000),
    continent: getRandomElement(['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania'])
  };
}

// Generate random city
function generateCity() {
  return {
    name: getRandomElement(cities),
    population: getRandomNumber(50000, 10000000),
    state: getRandomElement(states),
    founded: getRandomNumber(1600, 2000),
    mayor: `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`,
    area: getRandomNumber(10, 500)
  };
}

// Generate random bank transaction
function generateBankTransaction() {
  return {
    transactionId: `TXN-${Date.now()}-${getRandomNumber(1000, 9999)}`,
    bank: getRandomElement(bankNames),
    type: getRandomElement(transactionTypes),
    amount: (Math.random() * 5000).toFixed(2),
    currency: 'USD',
    accountNumber: `****${getRandomNumber(1000, 9999)}`,
    timestamp: new Date().toISOString(),
    status: getRandomElement(['completed', 'pending', 'failed'])
  };
}

// Add data to a container
async function addData(container, generator) {
  try {
    const data = generator();
    const result = await dataService.add(container, data);
    if (result && result.id) {
      containerData[container].push(result.id);
      logger.info(`Added ${container}: ${result.id}`);
    }
  } catch (error) {
    logger.error(`Error adding ${container}:`, error.message);
  }
}

// Read random data from container
async function readData(container) {
  try {
    if (containerData[container].length === 0) return;

    const uuid = getRandomElement(containerData[container]);
    const result = await dataService.getByUuid(container, uuid);
    logger.info(`Read ${container}: ${uuid} - Found: ${result !== null}`);
  } catch (error) {
    logger.error(`Error reading ${container}:`, error.message);
  }
}

// Search data in container
async function searchData(container) {
  try {
    const result = await dataService.find(container, '');
    logger.info(`Searched ${container}: Found ${result ? result.length : 0} items`);
  } catch (error) {
    logger.error(`Error searching ${container}:`, error.message);
  }
}

// Delete random data from container
async function deleteData(container) {
  try {
    if (containerData[container].length === 0) return;

    const randomIndex = Math.floor(Math.random() * containerData[container].length);
    const uuid = containerData[container][randomIndex];

    const result = await dataService.remove(container, uuid);
    if (result) {
      containerData[container].splice(randomIndex, 1);
      logger.info(`Deleted ${container}: ${uuid}`);
    }
  } catch (error) {
    logger.error(`Error deleting ${container}:`, error.message);
  }
}

// Perform random operations on all containers
async function performRandomOperations() {
  const containers = [
    { name: 'people', generator: generatePerson },
    { name: 'addresses', generator: generateAddress },
    { name: 'countries', generator: generateCountry },
    { name: 'cities', generator: generateCity },
    { name: 'bank-transactions', generator: generateBankTransaction }
  ];

  logger.info('=== Starting random operations cycle ===');

  // Add 5-10 new items to each container
  for (const container of containers) {
    const numToAdd = getRandomNumber(5, 10);
    for (let i = 0; i < numToAdd; i++) {
      await addData(container.name, container.generator);
    }
  }

  // Perform 5 random reads
  for (let i = 0; i < 5; i++) {
    const container = getRandomElement(containers);
    await readData(container.name);
  }

  // Perform 3 random searches
  for (let i = 0; i < 3; i++) {
    const container = getRandomElement(containers);
    await searchData(container.name);
  }

  // Perform 2-3 random deletes
  const numDeletes = getRandomNumber(2, 3);
  for (let i = 0; i < numDeletes; i++) {
    const container = getRandomElement(containers);
    await deleteData(container.name);
  }

  logger.info('=== Completed random operations cycle ===');
}

app.listen(3001, async () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:3001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3001/services/authservice/views/register.html');

  // Create containers
  const containers = ['people', 'addresses', 'countries', 'cities', 'bank-transactions'];
  for (const container of containers) {
    try {
      await dataService.createContainer(container);
      logger.info(`Container created: ${container}`);
    } catch (error) {
      logger.info(`Container may already exist: ${container}`);
    }
  }

  // Perform initial operations
  logger.info('Performing initial data operations...');
  await performRandomOperations();

  // Start continuous operations every 10 seconds
  setInterval(async () => {
    await performRandomOperations();
  }, 10000);

  logger.info('Continuous operations started (every 10 seconds)');
});
