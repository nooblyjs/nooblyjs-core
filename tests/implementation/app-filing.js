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
const filing = serviceRegistry.filing('local');

// Redirect root to services
app.get('/', (req, res) => {
  res.redirect('/services');
});

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
async function generateFolderStructure(basePath, depth = 0, maxDepth = 5) {
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
      await filing.create(folderPath + '/.placeholder', 'placeholder');
      createdPaths.push(folderPath);
      logger.info(`Created folder: ${folderPath}`);

      // Recursively create subfolders
      const subPaths = await generateFolderStructure(folderPath, depth + 1, maxDepth);
      createdPaths.push(...subPaths);
    } catch (error) {
      logger.error(`Error creating folder ${folderPath}: ${error.message}`);
    }
  }

  // Create files in current folder
  for (let i = 0; i < numFiles; i++) {
    const fileName = FILE_NAMES[Math.floor(Math.random() * FILE_NAMES.length)] + '-' + Math.random().toString(36).substring(7);
    const fileExt = FILE_EXTENSIONS[Math.floor(Math.random() * FILE_EXTENSIONS.length)];
    const filePath = path.join(basePath, fileName + fileExt);

    try {
      const content = generateRandomContent();
      await filing.create(filePath, content);
      createdPaths.push(filePath);
      logger.info(`Created file: ${filePath}`);
    } catch (error) {
      logger.error(`Error creating file ${filePath}: ${error.message}`);
    }
  }

  return createdPaths;
}

/**
 * Perform random file operations
 */
async function performRandomOperations(filePaths, numOperations = 50) {
  logger.info(`Performing ${numOperations} random file operations...`);

  for (let i = 0; i < numOperations; i++) {
    const randomPath = filePaths[Math.floor(Math.random() * filePaths.length)];
    const operation = Math.floor(Math.random() * 4); // 0=read, 1=write, 2=delete, 3=recreate

    try {
      switch (operation) {
        case 0: // Read
          await filing.read(randomPath);
          logger.info(`Read: ${randomPath}`);
          break;

        case 1: // Write/Update
          const newContent = generateRandomContent();
          await filing.update(randomPath, newContent);
          logger.info(`Updated: ${randomPath}`);
          break;

        case 2: // Delete
          await filing.delete(randomPath);
          logger.info(`Deleted: ${randomPath}`);
          // Remove from filePaths array
          const index = filePaths.indexOf(randomPath);
          if (index > -1) {
            filePaths.splice(index, 1);
          }
          break;

        case 3: // Recreate (write to potentially deleted file)
          const content = generateRandomContent();
          await filing.create(randomPath, content);
          logger.info(`Recreated: ${randomPath}`);
          // Add back to array if it was deleted
          if (!filePaths.includes(randomPath)) {
            filePaths.push(randomPath);
          }
          break;
      }

      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.warn(`Operation failed on ${randomPath}: ${error.message}`);
    }
  }

  logger.info('Random operations completed!');
}

/**
 * Initialize test data structure
 */
async function initializeTestData() {
  const dataRoot = path.join(__dirname, 'data');

  logger.info('======================================');
  logger.info('Initializing test data structure...');
  logger.info(`Root folder: ${dataRoot}`);
  logger.info('======================================');

  try {
    // Generate folder structure
    logger.info('Generating folder structure (5 levels deep)...');
    const createdPaths = await generateFolderStructure(dataRoot, 0, 5);

    logger.info(`Created ${createdPaths.length} folders and files`);

    // Perform initial random operations
    await performRandomOperations(createdPaths, 100);

    logger.info('======================================');
    logger.info('Test data initialization complete!');
    logger.info('Check the analytics dashboard at:');
    logger.info('http://localhost:3001/services/filing/');
    logger.info('======================================');
    logger.info('Starting continuous operations every 10 seconds...');
    logger.info('Press Ctrl+C to stop');
    logger.info('======================================');

    // Start continuous operations
    startContinuousOperations(createdPaths, 10000);

  } catch (error) {
    logger.error(`Error initializing test data: ${error.message}`);
  }
}

/**
 * Continuous random operations (optional)
 */
async function startContinuousOperations(filePaths, intervalMs = 5000) {
  setInterval(async () => {
    if (filePaths.length === 0) {
      logger.warn('No files available for operations');
      return;
    }

    logger.info('Performing continuous random operations...');
    await performRandomOperations(filePaths, 10);
  }, intervalMs);
}

app.listen(3001, async () => {
  logger.info('Server running on port 3001');
  logger.info('Visit: http://localhost:3001/ (redirects to /services)');
  logger.info('Login page at: http://localhost:3001/services/authservice/views/login.html');
  logger.info('Register page at: http://localhost:3001/services/authservice/views/register.html');
  logger.info('Filing Analytics: http://localhost:3001/services/filing/');
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
