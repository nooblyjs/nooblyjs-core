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

/**
 * Create the route
 * @param {} type 
 * @param {*} options 
 * @param {*} eventEmitter 
 */
function createRoutes(type, options, eventEmitter)   {
 
    const app = options['express-app'];
    if (!options.baseUrl.endsWith('/')){
      options.baseUrl = options.baseUrl + '/';
    }    
    /**
     * GET /services/caching/api/status
     * Returns the operational status of the caching service.
     * 
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(`${options.baseUrl}api/status`, (req, res) => {
      eventEmitter.emit(`${options.name}-application-status`, `${options.name} api running`);
      res.status(200).json(`${options.name} api running`);
    });

};
module.exports = createRoutes;
