/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');
const express = require('express');
const { EventEmitter } = require('events');
const serviceRegistry = require('../../../index');

const app = express();
app.use(express.json());

// Add options
var options = { 
  logDir:  path.join(__dirname, './.application/', 'logs'),
  dataDir : path.join(__dirname, './.application/', 'data'),
  cacheDir : path.join(__dirname, './.application/', 'caching'),
  'express-app': app,
    brandingConfig: {
      appName: 'App Lite',
      primaryColor: '#000'
  },
  security: {
    apiKeyAuth: {
      requireApiKey: false,
      apiKeys: []
    },
    servicesAuth: {
      requireLogin: false
    }
  }
};

// Initialize registry (no public folder needed!)
const eventEmitter = new EventEmitter();
serviceRegistry.initialize(app, eventEmitter, options);

// Initialize services
const logger = serviceRegistry.logger();
const authservice = serviceRegistry.authservice();

// Create default filing service (for routes to be mounted at /services/filing/api)
const filing = serviceRegistry.filing('local', {
  baseDir: path.join(__dirname, './.application/', 'data')
});

// Create two filing instances - one for Folder1 and one for Folder2
const filingFolder1 = serviceRegistry.filing('local', {
  baseDir: path.join(__dirname, './.application/', 'data', 'Folder1'),
  instanceName: 'folder1'
});

const filingFolder2 = serviceRegistry.filing('local', {
  baseDir: path.join(__dirname, './.application/', 'data', 'Folder2'),
  instanceName: 'folder2'
});


// Load styles
app.use('/styles.css', express.static(path.join(__dirname, 'styles.css')));

// Load images
app.use('/images/nooblyjs-logo.png', express.static(path.join(__dirname, 'nooblyjs-core.png')));

// Serve client files
app.use('/', express.static(path.join(__dirname, 'client')));

// Random data generator for testing filing analytics
const FOLDER_NAMES = ['users', 'documents', 'images', 'reports', 'logs', 'backups', 'temp', 'config', 'data', 'archive'];
const FILE_NAMES = ['report', 'document', 'log', 'config', 'data', 'backup', 'temp', 'file', 'note', 'record'];
const FILE_EXTENSIONS = ['.txt', '.log', '.json', '.csv', '.xml', '.md'];

/**
 * Generate random text content
 */
function generateRandomContent() {
  const words = ['Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt'];
  const length = Math.floor(Math.random() * 50) + 10;
  const content = [];
  for (let i = 0; i < length; i++) {
    content.push(words[Math.floor(Math.random() * words.length)]);
  }
  return content.join(' ');
}

/**
 * Generate random folder structure
 */
async function generateFolderStructure(filingInstance, basePath, depth = 0, maxDepth = 5) {
  if (depth >= maxDepth) return [];

  const createdPaths = [];
  const numFolders = Math.floor(Math.random() * 3) + 1; // 1-3 folders per level
  const numFiles = Math.floor(Math.random() * 5) + 2; // 2-6 files per folder

  // Create folders
  for (let i = 0; i < numFolders; i++) {
    const folderName = FOLDER_NAMES[Math.floor(Math.random() * FOLDER_NAMES.length)] + '-' + Math.random().toString(36).substring(7);
    const folderPath = path.join(basePath, folderName);

    try {
      // Create folder using filing service
      await filingInstance.create(path.join(folderPath, '.placeholder'), 'placeholder');
      createdPaths.push(folderPath);
      logger.info(`  Created folder: ${folderPath}`);

      // Recursively create subfolders
      const subPaths = await generateFolderStructure(filingInstance, folderPath, depth + 1, maxDepth);
      createdPaths.push(...subPaths);
    } catch (error) {
      logger.error(`  Error creating folder ${folderPath}: ${error.message}`);
    }
  }

  // Create files in current folder
  for (let i = 0; i < numFiles; i++) {
    const fileName = FILE_NAMES[Math.floor(Math.random() * FILE_NAMES.length)] + '-' + Math.random().toString(36).substring(7);
    const fileExt = FILE_EXTENSIONS[Math.floor(Math.random() * FILE_EXTENSIONS.length)];
    const filePath = path.join(basePath, fileName + fileExt);

    try {
      const content = generateRandomContent();
      await filingInstance.create(filePath, content);
      createdPaths.push(filePath);
      logger.info(`  Created file: ${filePath}`);
    } catch (error) {
      logger.error(`  Error creating file ${filePath}: ${error.message}`);
    }
  }

  return createdPaths;
}

/**
 * Perform random file operations
 */
async function performRandomOperations(filingInstance, filePaths, numOperations = 50) {
  if (!filePaths || filePaths.length === 0) {
    logger.warn('No file paths available for operations');
    return;
  }

  logger.info(`  Performing ${numOperations} random file operations...`);

  for (let i = 0; i < numOperations; i++) {
    if (filePaths.length === 0) {
      logger.warn('  No more files available, stopping operations');
      break;
    }

    const randomPath = filePaths[Math.floor(Math.random() * filePaths.length)];
    const operation = Math.floor(Math.random() * 4); // 0=read, 1=write, 2=delete, 3=recreate

    try {
      switch (operation) {
        case 0: // Read
          await filingInstance.read(randomPath);
          break;

        case 1: // Write/Update
          const newContent = generateRandomContent();
          await filingInstance.update(randomPath, newContent);
          break;

        case 2: // Delete
          await filingInstance.delete(randomPath);
          // Remove from filePaths array
          const index = filePaths.indexOf(randomPath);
          if (index > -1) {
            filePaths.splice(index, 1);
          }
          break;

        case 3: // Recreate (write to potentially deleted file)
          const content = generateRandomContent();
          await filingInstance.create(randomPath, content);
          // Add back to array if it was deleted
          if (!filePaths.includes(randomPath)) {
            filePaths.push(randomPath);
          }
          break;
      }

      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      logger.warn(`  Operation failed on ${randomPath}: ${error.message}`);
    }
  }

  logger.info('  Random operations completed!');
}

/**
 * Initialize test data structure
 */
async function initializeTestData() {
  const dataRoot1 = path.join(__dirname, './.application/', 'data', 'Folder1');
  const dataRoot2 = path.join(__dirname, './.application/', 'data', 'Folder2');

  logger.info('======================================');
  logger.info('Initializing test data structure...');
  logger.info(`Folder 1 root: ${dataRoot1}`);
  logger.info(`Folder 2 root: ${dataRoot2}`);
  logger.info('======================================');

  try {
    // Initialize Folder 1
    logger.info('');
    logger.info('>>> Initializing Folder 1...');
    await filingFolder1.create(path.join(dataRoot1, '.init'), 'initialized');
    logger.info(`Base directory ready: ${dataRoot1}`);
    const createdPaths1 = await generateFolderStructure(filingFolder1, dataRoot1, 0, 3);
    logger.info(`Created ${createdPaths1.length} folders and files in Folder 1`);
    await performRandomOperations(filingFolder1, createdPaths1, 50);

    // Initialize Folder 2
    logger.info('');
    logger.info('>>> Initializing Folder 2...');
    await filingFolder2.create(path.join(dataRoot2, '.init'), 'initialized');
    logger.info(`Base directory ready: ${dataRoot2}`);
    const createdPaths2 = await generateFolderStructure(filingFolder2, dataRoot2, 0, 3);
    logger.info(`Created ${createdPaths2.length} folders and files in Folder 2`);
    await performRandomOperations(filingFolder2, createdPaths2, 50);

    // Merge paths for continuous operations
    const allPaths = { folder1: createdPaths1, folder2: createdPaths2 };

    logger.info('======================================');
    logger.info('Test data initialization complete!');
    logger.info('Check the analytics dashboard at:');
    logger.info('http://localhost:3101/services/filing/');
    logger.info('');
    logger.info('Or view the advanced dual-folder UI at:');
    logger.info('http://localhost:3101/client/index.html');
    logger.info('======================================');
    logger.info('Starting continuous operations every 10 seconds...');
    logger.info('Press Ctrl+C to stop');
    logger.info('======================================');

    // Start continuous operations
    startContinuousOperations(allPaths, 10000);

  } catch (error) {
    logger.error(`Error initializing test data: ${error.message}`);
  }
}

/**
 * Continuous random operations (optional)
 */
async function startContinuousOperations(pathsByFolder, intervalMs = 5000) {
  setInterval(async () => {
    logger.info('Performing continuous random operations...');

    if (pathsByFolder.folder1 && pathsByFolder.folder1.length > 0) {
      await performRandomOperations(filingFolder1, pathsByFolder.folder1, 5);
    }

    if (pathsByFolder.folder2 && pathsByFolder.folder2.length > 0) {
      await performRandomOperations(filingFolder2, pathsByFolder.folder2, 5);
    }
  }, intervalMs);
}

app.listen(3101, async () => {
  logger.info('Server running on port 3101');
  logger.info('Visit: http://localhost:3101/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3101/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3101/services/authservice/views/register.html');
  logger.info('Filing Analytics: http://localhost:3101/services/filing/');
  logger.info('Activities folder: ./activities');
  logger.info('');

  // Wait a moment for services to initialize
  setTimeout(async () => {
    try {
      await initializeTestData();
    } catch (error) {
      logger.error(`Failed to initialize test data: ${error.message}`);
    }
  }, 2000);
});
