/**
 * @fileoverview The Base class
 * This base class takes the advantage of a standard nooblyjs project structure to accelerate some engineering
 * 
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';

/**
 * The Base Class
 */
class BaseClass {
  
  /**
   * This is our base class that all classes inherit from
   * @param {string} name - The name of the application for logging and viewing perspective
   * @param {*} app - The express app for exposing services
   * @param {*} serviceRegistry - The service registry containing the core servies
   * @param {*} eventEmitter - The event emitter for raising events to the calling system 
   * @param {*} baseUrl - The base url that the application runs on
   * @param {*} options - Any optional parameters to be passed
   */
  constructor(name, app, serviceRegistry, eventEmitter,baseUrl ,options) {
    this.name = name
    this.app = app;
    this.serviceRegistry = serviceRegistry;
    this.eventEmitter = eventEmitter;
    this.baseUrl = baseUrl;
    this.options = options;
  }
}

module.exports = BaseClass;