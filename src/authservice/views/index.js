/**
 * @fileoverview Authentication service views module for noobly-core framework.
 * This module provides Express.js view registration and static file serving
 * capabilities for the authentication service. It registers static routes to serve
 * auth-related view files and templates through the Express application.
 *
 * @author NooblyJS
 * @version 1.0.0
 * @since 1.0.0
 * @module AuthViews
 */

'use strict';

const path = require('path');
const express = require('express');

/**
 * Registers authentication service views with the Express application.
 * Sets up static file serving for auth-related view templates and assets.
 * This function integrates the authentication service views into the main Express
 * application by mounting static file middleware at the '/services/authservice' route.
 *
 * @function
 * @param {Object} options - Configuration options for the views setup
 * @param {express.Application} options.express-app - The Express application instance
 * @param {Object} _eventEmitter - Event emitter instance for inter-service communication
 * @param {Object} auth - The authentication service provider instance
 * @returns {void}
 */
module.exports = (options, _eventEmitter, _auth) => {
  if (options['express-app']) {
    const app = options['express-app'];

    // Serve static files for the auth service views
    app.use('/services/authservice',
      express.static(path.join(__dirname)));

    // Serve the main auth interface at the service root
    app.get('/services/authservice/', (req, res) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    });

  }
};