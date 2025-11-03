/**
 * @fileoverview Light App
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const EventEmitter = require('events');
const path = require('path');
const session = require('express-session');
const passport = require('passport');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup session middleware (required for authentication)
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-in-production-for-security',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Add options
var options = {
  logDir:  path.join(__dirname, './.application/', 'logs'),
  dataDir : path.join(__dirname, './.application/', 'data'),
  'express-app': app,
    brandingConfig: {
      appName: 'App Lite',
      primaryColor: '#000'
    }
};

// Declare the Event Emitter
const eventEmitter = new EventEmitter();

// Initialize registry (no public folder needed!)
const serviceRegistry = require('nooblyjs-core');
serviceRegistry.initialize(app, eventEmitter, options);

// Load logger
const logger = serviceRegistry.logger();

// Initialize auth service (required for login/register functionality)
// The authservice automatically serves login.html and register.html from its views folder
const authservice = serviceRegistry.authservice();

// IMPORTANT: Configure Passport BEFORE protecting routes
// This ensures the login endpoint can properly create sessions
const { configurePassport } = authservice.passportConfigurator(authservice.getAuthStrategy);
configurePassport(passport);

// Create authentication middleware from authservice
// This checks req.isAuthenticated() which is set by Passport after login
const requireAuth = authservice.createAuthMiddleware({
  
  saveReferer: true // Preserve original URL so users return after login
});

// Expose the public folder (login page, etc.)
app.use('/README', express.static('README.md'));

// Protect the /app route with authentication
app.use('/app', requireAuth, express.static(__dirname + '/public/app'));

// Expose other public routes
app.use('/', express.static(__dirname + '/public'));

app.listen(process.env.PORT || 3101, async () => {
  logger.info('Server running on port ' + (process.env.PORT || 3101));
});
