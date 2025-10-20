/**
 * @fileoverview NooblyJS Core - Service Registry
 * This is the container of all the services. It manages the various dependancies of the services
 */
'use strict';

const EventEmitter = require('events');
const express = require('express');
const path = require('path');

// Retrieve the auth middleware
const {
  createApiKeyAuthMiddleware,
  createServicesAuthMiddleware,
  generateApiKey
} = require('./src/authservice/middleware');

// Implement monitoring
const systemMonitoring = require('./src/views/modules/monitoring');

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value.slice();
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
};

class ServiceRegistry {

  constructor() {
    this.services = new Map();
    this.serviceDependencies = new Map();
    this.initialized = false;
    this.eventEmitter = new EventEmitter();
    this.dependenciesInitialized = false;
  }

  /**
   * Initializes the service registry with an Express app
   * @param {Object} expressApp - Express application instance
   * @param {Object} eventEmitter - EventEmitter instance
   * @param {Object} globalOptions - Global configuration options
   */
  initialize(expressApp, eventEmitter, globalOptions = {}) {

    // Prevent re-initialization
    if (this.initialized) {
      return this;
    }

    // Assign the express app
    this.expressApp = expressApp;

    // Assign the Event Emitter if its passed
    if (eventEmitter) {
      this.eventEmitter = eventEmitter;    
    } 

    const {
      security: incomingSecurityConfig = {},
      ...legacyOptions
    } = globalOptions;

    const apiKeyAuthConfig = {
      ...(incomingSecurityConfig.apiKeyAuth || {})
    };

    const servicesAuthConfig = {
      ...(incomingSecurityConfig.servicesAuth || {})
    };

    const apiKeys = ensureArray(
      apiKeyAuthConfig.apiKeys !== undefined
        ? apiKeyAuthConfig.apiKeys
        : legacyOptions.apiKeys
    );

    const requireApiKey =
      typeof apiKeyAuthConfig.requireApiKey === 'boolean'
        ? apiKeyAuthConfig.requireApiKey
        : typeof legacyOptions.requireApiKey === 'boolean'
          ? legacyOptions.requireApiKey
          : apiKeys.length > 0;

    const hasCustomExcludePaths =
      apiKeyAuthConfig.excludePaths !== undefined ||
      legacyOptions.excludePaths !== undefined;

    const excludePaths = hasCustomExcludePaths
      ? ensureArray(
          apiKeyAuthConfig.excludePaths !== undefined
            ? apiKeyAuthConfig.excludePaths
            : legacyOptions.excludePaths
        )
      : undefined;

    const requireServicesLogin =
      typeof servicesAuthConfig.requireLogin === 'boolean'
        ? servicesAuthConfig.requireLogin
        : true;

    const normalizedSecurityConfig = {
      ...incomingSecurityConfig,
      apiKeyAuth: {
        ...apiKeyAuthConfig,
        apiKeys,
        requireApiKey,
        excludePaths
      },
      servicesAuth: {
        ...servicesAuthConfig,
        requireLogin: requireServicesLogin
      }
    };

    // Assign the passed global options
    this.globalOptions = {
      'express-app': expressApp,
      ...legacyOptions,
      security: normalizedSecurityConfig
    };

    this.globalOptions.apiKeys = apiKeys;
    this.globalOptions.requireApiKey = requireApiKey;

    if (hasCustomExcludePaths) {
      this.globalOptions.excludePaths = excludePaths;
    } else {
      delete this.globalOptions.excludePaths;
    }

    this.securityConfig = normalizedSecurityConfig;

    // Initialize service dependencies
    this.initializeServiceDependencies();

    // Setup API key authentication if configured
    if (apiKeys.length > 0 || requireApiKey === false) {
      const middlewareOptions = {
        apiKeys,
        requireApiKey
      };

      if (excludePaths) {
        middlewareOptions.excludePaths = excludePaths;
      }

      this.authMiddleware = createApiKeyAuthMiddleware(
        middlewareOptions,
        this.eventEmitter,
      );

      // Store auth config for services to use
      this.globalOptions.authMiddleware = this.authMiddleware;

      // Log API key authentication setup
      this.eventEmitter.emit('api-auth-setup', {
        message: 'API key authentication configured',
        keyCount: apiKeys.length,
        requireApiKey,
        excludePaths
      });
    } else {
      this.authMiddleware = null;
      delete this.globalOptions.authMiddleware;

      if (requireApiKey) {
        this.eventEmitter.emit('api-auth-warning', {
          message: 'API key authentication requested but no API keys provided',
          requireApiKey
        });
      }
    }

    // Initialize services auth middleware
    const servicesAuthRequired = normalizedSecurityConfig.servicesAuth.requireLogin !== false;

    if (servicesAuthRequired) {
      this.servicesAuthMiddleware = createServicesAuthMiddleware(this);
    } else {
      this.servicesAuthMiddleware = (req, res, next) => next();
      this.eventEmitter.emit('services-auth-disabled', {
        message: 'Services authentication disabled by configuration'
      });
    }

    // Serve the service registry landing page (protected) - MUST come before static middleware
    this.expressApp.get('/services/', this.servicesAuthMiddleware, (req, res) => {
      res.sendFile(path.join(__dirname, 'src/views', 'index.html'));
    });

    // Serve static files from the views directory for caching service (excluding index.html)
    expressApp.use(
      '/services/',
      (req, res, next) => {
        // Exclude index.html from static serving since it's handled by the protected route above
        if (req.path === '/' || req.path === '/index.html') {
          return next();
        }
        next();
      },
      express.static(path.join(__dirname, 'src/views')),
    );

    // Add system monitoring API endpoints
    this.expressApp.get('/services/api/monitoring/metrics', this.servicesAuthMiddleware, (req, res) => {
      try {
        const metrics = systemMonitoring.getMetrics();
        res.status(200).json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.expressApp.get('/services/api/monitoring/snapshot', this.servicesAuthMiddleware, (req, res) => {
      try {
        const snapshot = systemMonitoring.getCurrentSnapshot();
        res.status(200).json(snapshot);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.initialized = true;
    return this;
  }

  /**
   * Initialize service dependency definitions according to the architecture hierarchy
   * Level 0: Foundation Services (No Dependencies)
   * Level 1: Infrastructure Services (Use Foundation)
   * Level 2: Business Logic Services (Use Infrastructure)
   * Level 3: Application Services (Use Business Logic)
   * Level 4: Integration Services (Use Application)
   */
  initializeServiceDependencies() {

    if (this.dependenciesInitialized) {
      return;
    }

    // Level 0 services (Foundation - No dependencies)
    this.serviceDependencies.set('logging', []);

    // Level 1 services (Infrastructure - Use foundation services)
    this.serviceDependencies.set('filing', ['logging']);
    this.serviceDependencies.set('caching', ['logging']);
    this.serviceDependencies.set('queueing', ['logging']);

    // Level 2 services (Business Logic - Use infrastructure services)
    this.serviceDependencies.set('dataservice', ['logging', 'filing']);
    this.serviceDependencies.set('working', ['logging','queueing','caching']);
    this.serviceDependencies.set('measuring', ['logging','queueing','caching']);

    // Level 3 services (Application - Use business logic services)
    this.serviceDependencies.set('scheduling', ['logging', 'working']);
    this.serviceDependencies.set('searching', ['logging', 'caching', 'dataservice', 'queueing', 'working', 'scheduling']);
    this.serviceDependencies.set('workflow', ['logging', 'queueing', 'scheduling', 'measuring', 'working']);

    // Level 4 services (Integration - Use application services)
    this.serviceDependencies.set('notifying', ['logging', 'queueing', 'scheduling']);
    this.serviceDependencies.set('authservice', ['logging', 'caching', 'dataservice']);
    this.serviceDependencies.set('aiservice', ['logging', 'caching', 'workflow', 'queueing']);

    this.dependenciesInitialized = true;

    // Emit event for dependency system initialization
    this.eventEmitter.emit('dependencies:initialized', {
      message: 'Service dependency hierarchy initialized',
      dependencies: Object.fromEntries(this.serviceDependencies)
    });
    
  }

  /**
   * Gets or creates a service instance (singleton pattern with dependency injection)
   * @param {string} serviceName - Name of the service
   * @param {string} providerType - Type of provider to use
   * @param {Object} options - Service-specific options
   * @returns {Object} Service instance
   */
  getService(serviceName, providerType = 'memory', options = {}) {
    if (!this.initialized) {
      throw new Error(
        'ServiceRegistry must be initialized before getting services',
      );
    }

    const serviceKey = `${serviceName}:${providerType}`;

    if (this.services.has(serviceKey)) {
      return this.services.get(serviceKey);
    }

    // Get dependencies for this service
    const dependencies = this.resolveDependencies(serviceName, providerType);

    const mergedOptions = {
      ...this.globalOptions,
      ...options,
      dependencies
    };

    let service;
    try {
      const serviceFactory = require(`${__dirname}/src/${serviceName}`);
      service = serviceFactory(providerType, mergedOptions, this.eventEmitter);
    } catch (error) {
      throw new Error(
        `Failed to create service '${serviceName}' with provider '${providerType}': ${error.message}`,
      );
    }

    this.services.set(serviceKey, service);

    // Emit event for service creation with dependencies
    this.eventEmitter.emit('service:created', {
      serviceName,
      providerType,
      dependenciesCount: Object.keys(dependencies).length,
      dependencyNames: Object.keys(dependencies)
    });

    return service;
  }

  /**
   * Get the default provider type for a specific service
   * @param {string} serviceName - Name of the service
   * @returns {string} Default provider type for the service
   */
  getDefaultProviderType(serviceName) {
    const defaultProviders = {
      'logging': 'memory',
      'filing': 'local',
      'measuring': 'memory',
      'caching': 'memory',
      'dataservice': 'memory',
      'working': 'memory',
      'queueing': 'memory',
      'scheduling': 'memory',
      'searching': 'memory',
      'workflow': 'memory',
      'notifying': 'memory',
      'authservice': 'file',
      'aiservice': 'claude'
    };

    return defaultProviders[serviceName] || 'memory';
  }

  /**
   * Resolve dependencies for a service by creating dependent services first
   * @param {string} serviceName - Name of the service
   * @param {string} requestedProviderType - Provider type requested for the main service
   * @returns {Object} Object containing dependency service instances
   */
  resolveDependencies(serviceName, requestedProviderType = 'memory') {
    const dependencies = {};
    const requiredDependencies = this.serviceDependencies.get(serviceName) || [];

    for (const depServiceName of requiredDependencies) {
      const depProviderType = this.getDefaultProviderType(depServiceName);
      const depServiceKey = `${depServiceName}:${depProviderType}`;

      // Check if dependency is already created
      if (this.services.has(depServiceKey)) {
        dependencies[depServiceName] = this.services.get(depServiceKey);
      } else {
        // Recursively create dependency with appropriate provider type
        dependencies[depServiceName] = this.getService(depServiceName, depProviderType);
      }
    }

    return dependencies;
  }

  /**
   * Get service initialization order using topological sort
   * This ensures dependencies are initialized before services that depend on them
   * @returns {Array<string>} Array of service names in initialization order
   */
  getServiceInitializationOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (serviceName) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving service: ${serviceName}`);
      }

      if (!visited.has(serviceName)) {
        visiting.add(serviceName);

        const dependencies = this.serviceDependencies.get(serviceName) || [];
        for (const dependency of dependencies) {
          visit(dependency);
        }

        visiting.delete(serviceName);
        visited.add(serviceName);
        order.push(serviceName);
      }
    };

    // Visit all services
    for (const serviceName of this.serviceDependencies.keys()) {
      visit(serviceName);
    }

    return order;
  }

  /**
   * Validates that the dependency graph has no circular dependencies
   * @returns {boolean} True if dependency graph is valid
   * @throws {Error} If circular dependencies are detected
   */
  validateDependencies() {
    try {
      this.getServiceInitializationOrder();
      return true;
    } catch (error) {
      throw new Error(`Dependency validation failed: ${error.message}`);
    }
  }

  /**
   * Get the caching service
   * @param {string} providerType - 'memory', 'redis', or 'memcached'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Cache service instance
   */
  cache(providerType = 'memory', options = {}) {
    return this.getService('caching', providerType, options);
  }

  /**
   * Get the logging service
   * @param {string} providerType - 'memory' or 'file'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Logger service instance
   */
  logger(providerType = 'memory', options = {}) {
    return this.getService('logging', providerType, options);
  }

  /**
   * Get the data service
   * @param {string} providerType - 'memory', 'simpledb', 'file', 'mongodb', or 'documentdb'
   * @param {Object} options - Provider-specific options
   * @param {string} options.connectionString - MongoDB/DocumentDB connection string (for mongodb/documentdb provider)
   * @param {string} options.database - Database name (for mongodb/documentdb provider)
   * @param {string} options.host - DocumentDB host (for documentdb provider, defaults to '127.0.0.1')
   * @param {number} options.port - DocumentDB port (for documentdb provider, defaults to 10260)
   * @param {string} options.username - Username for authentication (for documentdb provider)
   * @param {string} options.password - Password for authentication (for documentdb provider)
   * @param {boolean} options.ssl - Enable SSL connection (for documentdb provider)
   * @returns {Object} DataService instance
   */
  dataService(providerType = 'memory', options = {}) {
    return this.getService('dataservice', providerType, options);
  }

  /**
   * Get the filing service
   * @param {string} providerType - 'local', 'ftp', 's3', 'git', or 'sync'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Filing service instance
   */
  filing(providerType = 'local', options = {}) {
    return this.getService('filing', providerType, options);
  }

  /**
   * Get the filer service (alias for filing service)
   * @param {string} providerType - 'local', 'ftp', 's3', 'git', or 'sync'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Filer service instance
   */
  filer(providerType = 'local', options = {}) {
    return this.getService('filing', providerType, options);
  }

  /**
   * Get the measuring service
   * @param {string} providerType - 'memory'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Measuring service instance
   */
  measuring(providerType = 'memory', options = {}) {
    return this.getService('measuring', providerType, options);
  }

  /**
   * Get the notifying service
   * @param {string} providerType - 'memory'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Notifying service instance
   */
  notifying(providerType = 'memory', options = {}) {
    return this.getService('notifying', providerType, options);
  }

  /**
   * Get the queueing service
   * @param {string} providerType - 'memory'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Queue service instance
   */
  queue(providerType = 'memory', options = {}) {
    return this.getService('queueing', providerType, options);
  }

  /**
   * Get the scheduling service
   * @param {string} providerType - 'memory'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Scheduling service instance
   */
  scheduling(providerType = 'memory', options = {}) {
    return this.getService('scheduling', providerType, options);
  }

  /**
   * Get the searching service
   * @param {string} providerType - 'memory'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Searching service instance
   */
  searching(providerType = 'memory', options = {}) {
    return this.getService('searching', providerType, options);
  }

  /**
   * Get the workflow service
   * @param {string} providerType - 'memory'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Workflow service instance
   */
  workflow(providerType = 'memory', options = {}) {
    return this.getService('workflow', providerType, options);
  }

  /**
   * Get the working service
   * @param {string} providerType - 'memory'
   * @param {Object} options - Provider-specific options
   * @returns {Object} Working service instance
   */
  working(providerType = 'memory', options = {}) {
    return this.getService('working', providerType, options);
  }

  /**
   * Get the AI service
   * @param {string} providerType - 'claude', 'chatgpt', or 'ollama'
   * @param {Object} options - Provider-specific options
   * @param {string} options.apiKey - API key for the provider (required for claude/chatgpt)
   * @param {string} options.model - Model to use (optional)
   * @returns {Object} AI service instance
   */
  aiservice(providerType = 'claude', options = {}) {
    return this.getService('aiservice', providerType, options);
  }

  /**
   * Get the authentication service
   * @param {string} providerType - 'file', 'memory', 'passport', or 'google'
   * @param {Object} options - Provider-specific options
   * @param {string} options.dataDir - Directory for user data files (for file provider)
   * @param {string} options.clientID - Google OAuth client ID (for google provider)
   * @param {string} options.clientSecret - Google OAuth client secret (for google provider)
   * @param {string} options.callbackURL - OAuth callback URL (for google provider)
   * @param {boolean} options.createDefaultAdmin - Create default admin user (for memory provider)
   * @returns {Object} Auth service instance
   */
  authservice(providerType, options = {}) {
    // If no provider type specified, return the first existing authservice instance
    if (!providerType) {
      for (const [key, service] of this.services.entries()) {
        if (key.startsWith('authservice:')) {
          return service;
        }
      }
      // If no instance exists, use the default provider
      providerType = this.getDefaultProviderType('authservice');
    }
    return this.getService('authservice', providerType, options);
  }

  /**
   * Get the event emitter for inter-service communication
   * @returns {EventEmitter} The global event emitter
   */
  getEventEmitter() {
    return this.eventEmitter;
  }

  /**
   * Lists all initialized services
   * @returns {Array} Array of service keys
   */
  listServices() {
    return Array.from(this.services.keys());
  }

  /**
   * Generate a new API key
   * @param {number} length - Length of the API key (default: 32)
   * @returns {string} Generated API key
   */
  generateApiKey(length = 32) {
    return generateApiKey(length);
  }

  /**
   * Clears all service instances (useful for testing)
   */
  reset() {
    this.services.clear();
    this.initialized = false;
  }

 debug_emitter(emitter, name) {
    var orig_emit = emitter.emit;
    emitter.emit = function() {
        var emitArgs = arguments;
        console.log(emitArgs);
        orig_emit.apply(emitter, arguments);
    }
  }
}

// Export singleton instance
const serviceRegistry = new ServiceRegistry();

module.exports = serviceRegistry;
