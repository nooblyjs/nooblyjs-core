/**
 * @fileoverview The Services class
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

class BaseClass {
  
  /**
   * Load the views object
   * @param {string} path 
   * @param {object} app // The express app to use   
   */
  constructor(app, serviceRegistry, eventEmitter,baseUrl ,options) {
    this.app = app;
    this.serviceRegistry = serviceRegistry;
    this.eventEmitter = eventEmitter;
    this.baseUrl = baseUrl;
    this.options = options;
  }
}

module.exports = BaseClass;