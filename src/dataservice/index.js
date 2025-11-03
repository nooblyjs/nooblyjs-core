/**
 * @fileoverview DataService Factory
 * Factory module for creating data service instances with multiple provider support.
 * Supports in-memory, file-based, and SimpleDB backends with routing and views.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

// Lazy load providers to avoid loading AWS SDK when not needed
const Routes = require('./routes');
const Views = require('./views');
const analytics = require('./modules/analytics');

/**
 * Helper function to get nested values from objects using dot notation.
 * Safely traverses object properties using a path string.
 * @param {Object} obj - The object to search in
 * @param {string} path - The path to the value (e.g., 'user.profile.name')
 * @return {*} The value at the specified path, or undefined if not found
 * @example
 * const user = { profile: { name: 'John', age: 30 } };
 * const name = getNestedValue(user, 'profile.name'); // 'John'
 * const missing = getNestedValue(user, 'profile.email'); // undefined
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Creates a data service instance with the specified provider and dependency injection.
 * Automatically configures routes and views for the data service.
 * @param {string} type - The data provider type ('memory', 'file', 'simpledb', 'mongodb', 'documentdb', 'api')
 * @param {Object} options - Provider-specific configuration options
 * @param {string} [options.dataDir] - Directory for file-based storage (file provider)
 * @param {string} [options.connectionString] - Database connection string (mongodb/documentdb providers)
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.filing - Filing service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {Object} Data service wrapper with provider and methods (add, remove, find, jsonFind, etc.)
 * @throws {Error} When unsupported data provider type is provided
 * @example
 * const dataService = createDataserviceService('memory', {
 *   dependencies: { logging, filing }
 * }, eventEmitter);
 *
 * // Add an object to a container
 * await dataService.add('users', { name: 'John Doe', email: 'john@example.com' });
 *
 * // Find objects in a container
 * const users = await dataService.find('users', 'John');
 *
 * // JSON search with predicate function
 * const activeUsers = await dataService.jsonFind('users', (user) => user.active === true);
 *
 * // JSON search by path
 * const johnUsers = await dataService.jsonFindByPath('users', 'name', 'John Doe');
 *
 * // JSON search with multiple criteria
 * const results = await dataService.jsonFindByCriteria('users', {
 *   'profile.age': 30,
 *   'profile.country': 'USA'
 * });
 *
 * // Remove an object
 * await dataService.remove('users', 'user-uuid-123');
 */
function createDataserviceService(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;
  const filing = dependencies.filing;

  let provider;

  // Create data service instance based on provider type (lazy load to avoid unnecessary AWS SDK imports)
  switch (type) {
    case 'file':
      const Dataservicefiles = require('./providers/dataservicefiles');
      provider = new Dataservicefiles(providerOptions, eventEmitter);
      break;
    case 'simpledb':
      const DataserviceSimpleDB = require('./providers/dataserviceSimpleDB');
      provider = new DataserviceSimpleDB(providerOptions, eventEmitter);
      break;
    case 'mongodb':
      const DataserviceMongoDB = require('./providers/dataserviceMongoDB');
      provider = new DataserviceMongoDB(providerOptions, eventEmitter);
      break;
    case 'documentdb':
      const DataserviceDocumentDB = require('./providers/dataserviceDocumentDB');
      provider = new DataserviceDocumentDB(providerOptions, eventEmitter);
      break;
    case 'api':
      const DataserviceApi = require('./providers/dataserviceApi');
      provider = new DataserviceApi(providerOptions, eventEmitter);
      break;
    case 'memory':
    default:
      const Dataservice = require('./providers/dataservice');
      provider = new Dataservice(providerOptions, eventEmitter);
      break;
  }

  // Remove legacy container creation - containers are created on demand

  // Create service object
  const service = {
    provider: provider,
    dependencies: dependencies,
    createContainer: (...args) => provider.createContainer(...args),
    add: async (containerName, ...args) => {
      analytics.trackAdd(containerName);
      return provider.add(containerName, ...args);
    },
    remove: async (containerName, ...args) => {
      analytics.trackRemove(containerName);
      return provider.remove(containerName, ...args);
    },
    find: async (containerName, ...args) => {
      analytics.trackFind(containerName);
      return provider.find(containerName, ...args);
    },
    
    // UUID-based retrieval for API routes
    getByUuid: async (containerName, uuid) => {
      try {
        return await provider.getByUuid(containerName, uuid);
      } catch (err) {
        return null;
      }
    },

    // JSON search functionality
    jsonFind: async (containerName, predicate) => {
      try {
        // Get all objects from the container
        const allObjects = await provider.find(containerName, '');
        
        // Apply the predicate function to find matching objects
        const results = allObjects.filter(predicate);
        
        return results;
      } catch (err) {
        throw new Error(`JSON search failed: ${err.message}`);
      }
    },

    // JSON search with path-based queries (e.g., find by specific property)
    jsonFindByPath: async (containerName, path, value) => {
      try {
        // Get all objects from the container
        const allObjects = await provider.find(containerName, '');
        
        // Search for objects where the specified path matches the value
        const results = allObjects.filter(obj => {
          try {
            const pathValue = getNestedValue(obj, path);
            return pathValue === value;
          } catch {
            return false;
          }
        });
        
        return results;
      } catch (err) {
        throw new Error(`JSON path search failed: ${err.message}`);
      }
    },

    // JSON search with multiple criteria
    jsonFindByCriteria: async (containerName, criteria) => {
      try {
        // Get all objects from the container
        const allObjects = await provider.find(containerName, '');
        
        // Search for objects that match all criteria
        const results = allObjects.filter(obj => {
          return Object.entries(criteria).every(([path, expectedValue]) => {
            try {
              const actualValue = getNestedValue(obj, path);
              return actualValue === expectedValue;
            } catch {
              return false;
            }
          });
        });
        
        return results;
      } catch (err) {
        throw new Error(`JSON criteria search failed: ${err.message}`);
      }
    }
  };

  // Inject logging dependency into dataservice service
  if (logger) {
    service.logger = logger;
    service.log = (level, message, meta = {}) => {
      if (typeof logger[level] === 'function') {
        logger[level](`[DATASERVICE:${type.toUpperCase()}] ${message}`, meta);
      }
    };

    // Log dataservice service initialization
    service.log('info', 'DataService service initialized', {
      provider: type,
      hasLogging: true,
      hasFiling: !!filing
    });
  }

  // Inject filing dependency if available
  if (filing) {
    service.filing = filing;
  }

  // Add settings methods from provider (save before overwriting)
  const providerGetSettings = provider.getSettings.bind(provider);
  const providerSaveSettings = provider.saveSettings.bind(provider);
  service.getSettings = providerGetSettings;
  service.saveSettings = providerSaveSettings;

  // Initialize routes and views for the data service with the complete service object
  Routes(options, eventEmitter, service);
  Views(options, eventEmitter, service);

  return service;
}

module.exports = createDataserviceService;
