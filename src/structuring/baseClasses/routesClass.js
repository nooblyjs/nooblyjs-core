/**
 * @fileoverview The View class
 * This class takes the advantage of a standard nooblyjs project structure to accelerate some engineering
 * Provides message queuing, task scheduling, and job management capabilities.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */
'use strict';

const fs = require('fs');
const path = require('path');
const BaseClass = require('./baseClass')

class ViewClass extends BaseClass {

  /**
   * Load the views object
   * @param {string} path 
   * @param {object} app // The express app to use   
   */
  constructor() {
    super(app, serviceRegistry, eventEmitter,baseUrl ,options)

    app.get(`${baseUrl}/api/status`, (req, res) => {
      eventEmitter.emit('application-status', 'caching api running');
      res.status(200).json('caching api running');
    });

  }
}

module.exports = ViewClass;