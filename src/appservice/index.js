/**
 * @fileoverview NooblyJS Core - Structuring
 * This enabler looks for a expected structure that will accelerate some development
 */
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

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
function createApplication(type, options, eventEmitter) {

    // set some defaults for options
    options.name = options.name || 'Application';
    options.baseUrl = options.baseUrl || '/';

    const app = options['express-app'];
    const { dependencies = {}, ...providerOptions } = options;
    const logger = dependencies.logging;

    // Determine where we are working
    logger.info(`[APPSERVICE:DEFAULT] - ${options.name} current working: ${process.cwd()}`);

    // Determine if the services folder and index file exists and load it
    if (fs.existsSync('./src/services/')) {
        if (mountFiles(path.resolve('./src/services/'),  type, options, eventEmitter)){
            logger.info('[APPSERVICE:DEFAULT] - services structure loaded')
        }
    }

    // Determine if the data folder and index file exists and load it
    if (fs.existsSync('./src/data/')) {
        if (mountFiles(path.resolve('./src/data/'), type, options, eventEmitter)){
            logger.info('[APPSERVICE:DEFAULT] - data structures loaded')
        }
    }

    // Determine if routes folder and index file exists and load it
    if (fs.existsSync('./src/routes/')) {
        if (mountFiles(path.resolve('./src/routes/'), type, options, eventEmitter)){
            logger.info('[APPSERVICE:DEFAULT] - routes structures loaded')
        }
    }

    // Determine if views folder and index file exists and load it else if there us a index.html then server the folder statically
    if (fs.existsSync('./src/views/')) {
        if (mountFiles(path.resolve('./src/views/'), type, options, eventEmitter)){
            logger.info('[APPSERVICE:DEFAULT] - Views structures loaded')
        } else if (fs.existsSync('./src/views/index.html')) {
            app.use(options.baseUrl, express.static('./src/views/'));
            logger.info('[APPSERVICE:DEFAULT] - Views static data loaded on ' + options.baseUrl)
        }
    } 

    // Determine if activites folder and index file exists and load it
    if (fs.existsSync('./src/activities/index.js')) {
        if (mountFiles(path.resolve('./src/activities/'), type, options, eventEmitter)){
            logger.info('[APPSERVICE:DEFAULT] - activities structures loaded')
        }
    }

    // Determine if we have a public folder in the route and load the base styles
    if (fs.existsSync('./public/styles.css')) {
        app.use('/base.css', express.static('./public/styles.css'));
        logger.info('[APPSERVICE:DEFAULT] - base styles loaded')
    }
};
module.exports = createApplication;

/**
 * Mount the files
 * @param {string} path 
 * @param {*} name 
 * @param {*} app 
 * @param {*} serviceRegistry 
 * @param {*} eventEmitter 
 * @param {*} baseUrl 
 * @param {*} options 
 */
function mountFiles(servicepath, type, options, eventEmitter) {
    var filesMounted = false;
    const files = fs.readdirSync(servicepath);
    files.forEach(file => {
        if (path.extname(file) === '.js') {
            const MountedFile = require(path.join(servicepath ,file));
            MountedFile(type, options, eventEmitter);
            filesMounted = true;
        }
    });
    return filesMounted;
}


