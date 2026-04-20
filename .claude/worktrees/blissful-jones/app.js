/**
 * @fileoverview Application demonstrating Digital Technologies Core services.
 * This file serves as a comprehensive example of how to use all available
 * services in the Digital Technologies Core framework.
 *
 * @author Digital Technologies Team
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

// Configure session management
app.use(session({
  secret: process.env.SESSION_SECRET || 'knowledge-repository-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Configure API keys
const configuredApiKeys = parseCommaSeparated(
  process.env.KNOWLEDGEREPOSITORY_API_KEYS || process.env.API_KEYS || process.env.API_KEY || ''
);

// Load the service registry library
const serviceRegistry = require('./index');

// Generate a development API key if none are configured and not in production
let generatedDevApiKey = null;
if (configuredApiKeys.length === 0 && process.env.NODE_ENV !== 'production') {
  generatedDevApiKey = serviceRegistry.generateApiKey();
  configuredApiKeys.push(generatedDevApiKey);
  console.log(`Genertated API Key: ${generatedDevApiKey}`);
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

// Expose the public folder
app.use('/', express.static(__dirname + '/public'));

// Launch the application docs folder to show the docs on the public site
// /docs retrieves the document
// /docs/list retrieves the list of documents
app.use('/docs', express.static(path.join(__dirname, 'docs')));
app.get('/docs/list', (req, res) => {
    let files= [];
    fs.readdirSync(path.join(__dirname,'docs')).forEach(file => {
      if (fs.lstatSync(path.join(__dirname, 'docs',file)).isDirectory()) {
           fs.readdirSync(path.join(__dirname, 'docs',file)).forEach(subfile => {
            files.push('/'+file + '/' + subfile);
          })
      }
      files.push('/'+ file);
    }
  ); 
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(files));
});

// Expose the public folder
app.use('/ui', express.static(__dirname + '/ui'));

app.listen(process.env.PORT || 11000, () => {
  log.info(`Server is running on port ${process.env.PORT || 11000}`);
});
