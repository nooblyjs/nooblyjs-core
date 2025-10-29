/**
 * @fileoverview NooblyJS Core - Structuring
 * This enabler looks for a expected structure that will accelerate some development
 */
'use strict';

const fs = require('fs');
const path = require('path');

module.exports = {

    /**
     * This method will mount the application for use. 
     * The following is loaded
     *  - /src/services/index.js: These are application specific services that will be used
     *  - /src/data/index.js: This is application specific data accessors
     *  - /src/routes/index.js: These are application specific routes
     *  - /src/views/index.js: These are application specific views
     *  - /src/views/index.html: Should there not be a index file but rather an index.html file then the views folder will be shared as a static container
     *  - /src/activities/index.js: These are application specifc activities
     * 
     * @param {object} app -  The express application
     * @param {object} serviceRegistry  - The service registry
     * @param {object} serviceRegistry  - The service registry
     * @param {string} baseUrl - The base url that the views and apis will listen on e.g. /applications/wiki
     * @param {object} options - the options object
     */
    mount: function (app, serviceRegistry, eventEmitter, baseUrl, options) {

        // Create the middleware
        const servicesAuthMiddleware = serviceRegistry.servicesAuthMiddleware || ((req, res, next) => next());

        // Register routes and views
        options.app = app

        // Determine if the services folder and index file exists and load it
        if (fs.existsSync('./src/services/')) {
            this.mountFiles('./src/services/', app, serviceRegistry, eventEmitter, baseUrl, options)
            console.log('nooblysjs-core-structure: services structure loaded')
        }

        // Determine if the data folder and index file exists and load it
        if (fs.existsSync('./src/data/index.js')) {
            this.mountFiles('./src/data/', app, serviceRegistry, eventEmitter, baseUrl, options)
            console.log('nooblysjs-core-structure: data structures loaded')
        }

        // Determine if routes folder and index file exists and load it
        if (fs.existsSync('./src/routes/index.js')) {
            this.mountFiles('./src/routes/', app, serviceRegistry, eventEmitter, baseUrl, options)
            console.log('nooblysjs-core-structure: routes structures loaded')
        }

        // Determine if views folder and index file exists and load it
        if (fs.existsSync('./src/views/index.js')) {
            this.mountFiles('./src/views/', app, serviceRegistry, eventEmitter, baseUrl, options)
            console.log('nooblysjs-core-structure: views structures loaded')
        } else if (fs.existsSync('./src/views/index.html')) {
            // Serve static files from the views directory
            app.use(baseUrl, express.static('./src/views/'));
        }

        // Determine if activites folder and index file exists and load it
        if (fs.existsSync('./src/activities/index.js')) {
            this.mountFiles('./src/activities/', app, serviceRegistry, eventEmitter, baseUrl, options)
            console.log('nooblysjs-core-structure: activities structures loaded')
        }

        // Determine if we have a public folder in the route and load the base styles
        if (fs.existsSync('./public/styles.css')) {
            app.use('base.css', express.static('./public/styles.css'));
        }
    },

    /**
     * Mount the js files
     * @param {} path 
     */
    mountFiles: function(path, app, serviceRegistry, eventEmitter, baseUrl, options){
    const files = fs.readdirSync('./src/services/');
        files.forEach(file => {
            if (path.extname(file) === '.js') {
                const MountedFile = require(file);
                MountedFile(app, serviceRegistry, eventEmitter,baseUrl ,options);
            }
        });
    }

}
