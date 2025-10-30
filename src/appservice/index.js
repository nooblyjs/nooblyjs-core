/**
 * @fileoverview NooblyJS Core - Structuring
 * This enabler looks for a expected structure that will accelerate some development
 */
'use strict';

// Imports
const fs = require('fs');
const path = require('path');
const express = require('express');

// Base classes 
const appViewBase = require('./baseClasses/appViewBase.js');
const appRouteBase = require('./baseClasses/appRouteBase.js');
const appWorkerBase = require('./baseClasses/appWorkerBase.js');
const appServiceBase = require('./baseClasses/appServiceBase.js');
const appDataBase = require('./baseClasses/appDataBase.js');

/**
 * Creates a cache service instance with the specified provider and dependency injection.
 * Automatically configures routes and views for the cache service.
 * @param {string} type - The type of application
 * @param {Object} options - Provider-specific configuration options
 * @param {Object} options.name - The name of the application
 * @param {Object} options.baseURL - The URL that the application will listen under e.g./applications/wiki
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {Application} Cache service instance with specified provider
 * @throws {Error} When unsupported cache type is provided
 */
module. exports = function(type, options, eventEmitter) {

    const logprefx = `[APPSERVICE:${type}]`

    // set some defaults for options
    options.name = options.name || 'Application';
    options.baseUrl = options.baseUrl || '/';

    const app = options['express-app'];
    const { dependencies = {}, ...providerOptions } = options;
    const logger = dependencies.logging;

    // Determine where we are working
    logger.info(`${logprefx} Application service ${options.name} current working directory is ${process.cwd()}`);

    // Determine if the services folder and index file exists and load it
    if (fs.existsSync('./src/services/')) {
        if (mountFiles(path.resolve('./src/services/'),  type, options, eventEmitter)){
            logger.info(`${logprefx} Application service structure loaded`)
        }
    }

    // Determine if the data folder and index file exists and load it
    if (fs.existsSync('./src/data/')) {
        if (mountFiles(path.resolve('./src/data/'), type, options, eventEmitter)){
            logger.info(`${logprefx} Application service data structures loaded`)
        }
    }

    // Determine if routes folder and index file exists and load it
    if (fs.existsSync('./src/routes/')) {
        if (mountFiles(path.resolve('./src/routes/'), type, options, eventEmitter)){
            logger.info(`${logprefx} Application service routes structures loaded`)
        }
    }

    // Determine if views folder and index file exists and load it else if there us a index.html then server the folder statically
    if (fs.existsSync('./src/views/')) {
        if (mountFiles(path.resolve('./src/views/'), type, options, eventEmitter)){
            logger.info(`${logprefx} Application service views structures loaded`)
        } else if (fs.existsSync('./src/views/index.html')) {
            app.use(options.baseUrl, express.static('./src/views/'));
            logger.info(`${logprefx} Application service static views data loaded on ${options.baseUrl}`)
        }
    } 

    // Determine if activites folder and index file exists and load it
    if (fs.existsSync('./src/activities/index.js')) {
        if (mountFiles(path.resolve('./src/activities/'), type, options, eventEmitter)){
            logger.info(`${logprefx} Application service structures loaded`)
        }
    }

    // Determine if we have a public folder in the route and load the base styles
    if (fs.existsSync('./public/styles.css')) {
        app.use('/base.css', express.static('./public/styles.css'));
        logger.info(`${logprefx} Application service base styles loaded`)
    }


    var baseClasses = {    
        appViewBase,
        appRouteBase,
        appWorkerBase,
        appServiceBase,
        appDataBase
    };

    return baseClasses;
};

/**
 * Mount the files and pass the requires settings to those applications
 * @param {*} servicepath 
 * @param {*} type 
 * @param {*} options 
 * @param {*} eventEmitter 
 * @returns 
 */
function mountFiles(servicepath, type, options, eventEmitter) {
    var filesMounted = false;
    (fs.readdirSync(servicepath)).forEach(file => {
        if (path.extname(file) === '.js') {
            const MountedFile = require(path.join(servicepath ,file));
            MountedFile(type, options, eventEmitter);
            filesMounted = true;
        }
    });
    return filesMounted;
}
