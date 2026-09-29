/**
 * @fileoverview Settings service views module for nooblyjs-core.
 * Registers static file serving for the settings service admin screen at
 * '/services/settings'.
 *
 * @author NooblyJS
 * @version 1.0.0
 * @since 1.0.0
 * @module SettingsViews
 */

'use strict';

const path = require('node:path');
const express = require('express');

/**
 * Registers settings service views with the Express application.
 *
 * @function
 * @param {Object} options - Configuration options for the views setup
 * @param {express.Application} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for inter-service communication
 * @param {Object} settings - The settings service provider instance
 * @return {void}
 *
 * @example
 * const settingsViews = require('./src/settings/views');
 * settingsViews({ 'express-app': app }, eventEmitter, settingsService);
 */
module.exports = (options, eventEmitter, settings) => {
  if (options['express-app']) {
    const app = options['express-app'];

    // Serve static files from the views directory for the settings service
    app.use('/services/settings', express.static(path.join(__dirname)));

    // Serve the client library so consumers can also reference it by its
    // static path, e.g. /services/settings/scripts/js/index.js. Only the `js`
    // folder is exposed — mounting the whole scripts folder would also serve
    // the server-side route module sitting next to it.
    app.use('/services/settings/scripts/js',
      express.static(path.join(__dirname, '../scripts/js')));

    eventEmitter.emit('settings:loading view', {
      folder: path.join(__dirname),
    });
  }
};
