/**
 * Simple test script for authentication service
 */

'use strict';

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { EventEmitter } = require('events');

const createAuth = require('../src/authservice/index');

const app = express();
const eventEmitter = new EventEmitter();

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static files
app.use('/', express.static(path.join(__dirname, 'public')));

// Test the auth service
console.log('Initializing auth service...');

try {
  const authservice = createAuth('memory', {
    'express-app': app,
    createDefaultAdmin: true
  }, eventEmitter);

  console.log('Auth service initialized successfully!');

  // Start server
  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log('Test the following URLs:');
    console.log(`  Home: http://localhost:${PORT}/`);
    console.log(`  Login: http://localhost:${PORT}/login.html`);
    console.log(`  Register: http://localhost:${PORT}/register.html`);
    console.log(`  Dashboard: http://localhost:${PORT}/services`);
    console.log(`  Auth API: http://localhost:${PORT}/services/authservice/api/status`);
  });

  // Event handlers
  eventEmitter.on('auth:provider-initialized', (data) => {
    console.log('Auth provider initialized:', data);
  });

  eventEmitter.on('auth:user-created', (data) => {
    console.log('User created:', data);
  });

} catch (error) {
  console.error('Error initializing auth service:', error);
  process.exit(1);
}