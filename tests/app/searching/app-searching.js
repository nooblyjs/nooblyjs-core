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
const { EventEmitter } = require('events');

const serviceRegistry = require('nooblyjs-core');

const app = express();
app.use(express.json());

var options = { 
  logDir:  path.join(__dirname, './.noobly-core/', 'logs'),
  dataDir : path.join(__dirname, './.noobly-core/', 'data')
};

// Instantiate our event emitter
const eventEmitter = new EventEmitter();

// Initialize registry (no public folder needed!)
serviceRegistry.initialize(app,eventEmitter, options);

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice();

// Get other services
const cache = serviceRegistry.cache();
const logger = serviceRegistry.logger('file');
const dataService = serviceRegistry.dataService('file');
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

const cityNames = ['London', 'New York', 'Tokyo', 'Sydney', 'Toronto', 'Paris', 'Madrid', 'Berlin', 'Dubai', 'Singapore'];
const placeTypes = ['Airport', 'Museum', 'Restaurant', 'Library', 'Park', 'University', 'Café', 'Stadium', 'Hotel', 'Theatre'];
const transactionTypes = ['purchase', 'refund', 'subscription', 'transfer', 'invoice'];
const transactionStatuses = ['pending', 'completed', 'failed', 'refunded', 'processing'];
const currencies = ['USD', 'GBP', 'EUR', 'JPY', 'AUD', 'CAD'];

async function generateRandomPlaces(count) {
  const places = [];
  for (let i = 0; i < count; i++) {
    places.push({
      name: `${getRandomElement(placeTypes)} ${getRandomElement(cityNames)}`,
      type: getRandomElement(placeTypes),
      city: getRandomElement(cityNames),
      country: getRandomElement(countries),
      description: `Popular ${getRandomElement(placeTypes).toLowerCase()} located in ${getRandomElement(cityNames)}`
    });
  }
  return places;
}

async function generateRandomTransactions(count) {
  const transactions = [];
  for (let i = 0; i < count; i++) {
    transactions.push({
      transactionId: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: getRandomElement(transactionTypes),
      status: getRandomElement(transactionStatuses),
      currency: getRandomElement(currencies),
      amount: Number((Math.random() * 5000 + 10).toFixed(2)),
      description: `Auto-generated ${getRandomElement(transactionTypes)} transaction`
    });
  }
  return transactions;
}

const addedDocuments = [];

function pickSearchTermForDocument(entry) {
  if (!entry || !entry.doc) {
    return null;
  }

  switch (entry.index) {
    case 'people':
      return getRandomElement([
        entry.doc.firstname,
        entry.doc.lastname,
        entry.doc.country
      ]);
    case 'places':
      return getRandomElement([
        entry.doc.name,
        entry.doc.type,
        entry.doc.city,
        entry.doc.country
      ]);
    case 'transactions':
      return getRandomElement([
        entry.doc.transactionId,
        entry.doc.type,
        entry.doc.status,
        entry.doc.currency
      ]);
    default:
      return null;
  }
}

function trimDocumentHistory() {
  const MAX_TRACKED = 3000;
  if (addedDocuments.length > MAX_TRACKED) {
    addedDocuments.splice(0, addedDocuments.length - MAX_TRACKED);
  }
}

app.listen(3001, async () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:3001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3001/services/authservice/views/register.html');
  logger.info('Activities folder: ./activities');

  await searching.startIndexing(5, 100);
  logger.info('Started search indexing processor (runs every 5 seconds, batch size: 100)');

  const addDocumentsToIndex = async (indexName, documents) => {
    let added = 0;
    for (const doc of documents) {
      const key = `${indexName}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
      await searching.add(key, doc, indexName);
      addedDocuments.push({ index: indexName, key, doc });
      added++;
    }
    logger.info(`Queued ${added} documents for index "${indexName}"`);
    trimDocumentHistory();
  };

  const performRandomSearches = async () => {
    const searchPools = {
      people: [...firstNames, ...lastNames, ...countries],
      places: [...cityNames, ...placeTypes, ...countries],
      transactions: [...transactionTypes, ...transactionStatuses, ...currencies]
    };

    try {
      for (let i = 0; i < 9; i++) {
        const index = getRandomElement(Object.keys(searchPools));
        const searchTerm = getRandomElement(searchPools[index]);
        const results = await searching.search(searchTerm, index);
        logger.info(`[${index}] Search for "${searchTerm}": found ${results.length} results`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      logger.error('Error performing random searches:', error.message);
    }
  };

  const performRandomReads = async () => {
    if (addedDocuments.length === 0) return;

    try {
      const attempts = Math.min(6, addedDocuments.length);
      logger.info(`Performing ${attempts} random read operations...`);

      for (let i = 0; i < attempts; i++) {
        const entry = getRandomElement(addedDocuments);
        const searchTerm = pickSearchTermForDocument(entry);

        if (!searchTerm) {
          continue;
        }

        await searching.search(searchTerm, entry.index);
        logger.info(`Read simulation for index "${entry.index}" using term "${searchTerm}"`);
        await new Promise(resolve => setTimeout(resolve, 75));
      }
    } catch (error) {
      logger.error('Error performing random reads:', error.message);
    }
  };

  const performRandomDeletes = async () => {
    if (addedDocuments.length === 0) return;

    try {
      const deletions = Math.min(4, addedDocuments.length);
      logger.info(`Performing ${deletions} random delete operations...`);

      for (let i = 0; i < deletions; i++) {
        const randomIndex = Math.floor(Math.random() * addedDocuments.length);
        const { key, index } = addedDocuments[randomIndex];

        const deleted = await searching.remove(key, index);
        if (deleted) {
          logger.info(`Deleted document ${key} from index "${index}"`);
          addedDocuments.splice(randomIndex, 1);
        }

        await new Promise(resolve => setTimeout(resolve, 75));
      }
    } catch (error) {
      logger.error('Error performing random deletes:', error.message);
    }
  };

  const addRandomData = async () => {
    try {
      const aggregatedStats = await searching.getStats();
      logger.info(`Current stats -> indexes: ${aggregatedStats.totalIndexes}, indexed items: ${aggregatedStats.totalIndexedItems}, queue size: ${aggregatedStats.queueSize}`);

      await addDocumentsToIndex('people', await generateRandomPeople(300));
      await addDocumentsToIndex('places', await generateRandomPlaces(150));
      await addDocumentsToIndex('transactions', await generateRandomTransactions(200));

      const peopleStats = await searching.getStats('people');
      const placesStats = await searching.getStats('places');
      const transactionStats = await searching.getStats('transactions');

      logger.info(`Index stats -> people: ${peopleStats.indexedItems || peopleStats.size}, places: ${placesStats.indexedItems || placesStats.size}, transactions: ${transactionStats.indexedItems || transactionStats.size}`);

      await performRandomSearches();
      await performRandomReads();
      await performRandomDeletes();
    } catch (error) {
      logger.error('Error generating random data batches:', error.message);
    }
  };

  await addRandomData();

  setInterval(addRandomData, 10000);
  logger.info('Scheduled random data generation every 10 seconds across people, places, and transactions indexes');
});
