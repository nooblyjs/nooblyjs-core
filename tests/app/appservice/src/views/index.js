/**
 * @fileoverview Caching API routes for Express.js application.
 * Provides RESTful endpoints for cache operations including put, get, delete,
 * status monitoring, and analytics retrieval.
 * 
 * @author NooblyJS Core Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const express = require('express');

/**
 * Create the route
 * @param {} type 
 * @param {*} options 
 * @param {*} eventEmitter 
 */
function createViews(type, options, eventEmitter)   {
 
    const app = options['express-app'];
    if (!options.baseUrl.endsWith('/')){
      options.baseUrl = options.baseUrl + '/';
    }    
    
    // Use the view folder
    app.use(options.baseUrl, express.static(__dirname));

};
module.exports = createViews;
