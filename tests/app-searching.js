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
const serviceRegistry = require('../index');

const app = express();
app.use(express.json());

// Initialize registry (no public folder needed!)
serviceRegistry.initialize(app,null, {log: { level: 'log' }});

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice();

// Get other services
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger();
const dataService = serviceRegistry.dataService();
const filing = serviceRegistry.filing();
const queueing = serviceRegistry.queue();
const worker = serviceRegistry.working('default', {
  maxThreads: 4,
  activitiesFolder: 'activities', // or use absolute path
  dependencies: {
    queueing,
    filing
  }
});
const scheduler = serviceRegistry.scheduling();

// start the search service
const searching = serviceRegistry.searching();

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

// Random name generators
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa', 'James', 'Mary', 'Robert', 'Jennifer', 'William', 'Linda', 'Richard', 'Patricia', 'Thomas', 'Barbara', 'Charles', 'Elizabeth'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const countries = ['England', 'USA', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Japan', 'China', 'India', 'Brazil', 'Mexico', 'Argentina', 'Colombia', 'South Africa', 'Nigeria', 'Egypt', 'Russia', 'Poland'];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomAge() {
  return Math.floor(Math.random() * 60) + 18; // Age between 18 and 77
}

async function generateRandomPeople(count) {
  const people = [];
  for (let i = 0; i < count; i++) {
    people.push({
      firstname: getRandomElement(firstNames),
      lastname: getRandomElement(lastNames),
      country: getRandomElement(countries),
      age: getRandomAge()
    });
  }
  return people;
}

app.listen(3001, async () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:3001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3001/services/authservice/views/register.html');
  logger.info('Activities folder: ./activities');

  // Start the built-in indexing processor (runs every 5 seconds, processes up to 100 items per batch)
  await searching.startIndexing(5, 100);
  logger.info('Started search indexing processor (runs every 5 seconds, batch size: 100)');

  // Function to perform random searches
  const performRandomSearches = async () => {
    const searchTerms = [
      ...firstNames,
      ...lastNames,
      ...countries,
      'age:25', 'age:30', 'age:40', 'age:50',
      'John Smith', 'Jane Williams', 'Michael Brown'
    ];

    try {
      for (let i = 0; i < 10; i++) {
        const searchTerm = getRandomElement(searchTerms);
        const results = await searching.search(searchTerm, { limit: 10 });
        logger.info(`Search for "${searchTerm}": found ${results.length} results`);

        // Small delay between searches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      logger.error('Error performing random searches:', error.message);
    }
  };

  // Store keys for later deletion
  const addedKeys = [];

  // Function to perform random read operations
  const performRandomReads = async () => {
    if (addedKeys.length === 0) return;

    try {
      const numReads = Math.min(5, addedKeys.length);
      logger.info(`Performing ${numReads} random read operations...`);

      for (let i = 0; i < numReads; i++) {
        const randomKey = getRandomElement(addedKeys);
        // Read operation via search (simulating a get/read)
        await searching.search(randomKey);
        logger.info(`Read operation for key: ${randomKey}`);

        // Small delay between reads
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      logger.error('Error performing random reads:', error.message);
    }
  };

  // Function to perform random delete operations
  const performRandomDeletes = async () => {
    if (addedKeys.length === 0) return;

    try {
      const numDeletes = Math.min(3, addedKeys.length);
      logger.info(`Performing ${numDeletes} random delete operations...`);

      for (let i = 0; i < numDeletes; i++) {
        const randomIndex = Math.floor(Math.random() * addedKeys.length);
        const keyToDelete = addedKeys[randomIndex];

        const deleted = await searching.remove(keyToDelete);
        if (deleted) {
          logger.info(`Deleted document with key: ${keyToDelete}`);
          // Remove from our tracking array
          addedKeys.splice(randomIndex, 1);
        }

        // Small delay between deletes
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      logger.error('Error performing random deletes:', error.message);
    }
  };

  // Function to add random people to the search queue
  const addRandomPeople = async () => {
    try {
      const stats = await searching.getStats();
      logger.info(`Adding 1000 random people. Current stats: ${stats.indexedItems} indexed, ${stats.queueSize} in queue`);

      const people = await generateRandomPeople(1000);
      let added = 0;

      for (const person of people) {
        const key = `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await searching.add(key, person);
        addedKeys.push(key); // Track the key
        added++;
      }

      logger.info(`Queued ${added} people for indexing`);

      // Perform random operations after adding people
      await performRandomSearches();
      await performRandomReads();
      await performRandomDeletes();
    } catch (error) {
      logger.error('Error adding random people:', error.message);
    }
  };

  // Add initial batch
  await addRandomPeople();

  // Schedule adding random people every 10 seconds
  setInterval(addRandomPeople, 1000);

  logger.info('Scheduled random people generation every 10 seconds (1000 people per batch)');
});
