/**
 * @fileoverview Search Service Factory
 * Factory module for creating search service instances.
 * Provides full-text search, indexing, and query capabilities.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const SearchService = require('./providers/searching.js');
const SearchFileService = require('./providers/searchingFile.js');
const SearchingApi = require('./providers/searchingApi');

const Routes = require('./routes');
const Views = require('./views');

/**
 * Creates a search service instance with indexing and query capabilities.
 * Automatically configures routes and views for the search service.
 * @param {string} type - The search service type ('default', 'files', 'api')
 * @param {Object} options - Configuration options for the search service
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.caching - Caching service instance
 * @param {Object} options.dependencies.dataservice - DataService instance
 * @param {Object} options.dependencies.queueing - Queueing service instance
 * @param {Object} options.dependencies.working - Working service instance
 * @param {Object} options.dependencies.scheduling - Scheduling service instance
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {SearchService|SearchFileService|SearchingApi} Search service instance for indexing and querying
 * @throws {Error} When required dependencies are missing
 * @example
 * const searchService = createSearchService('default', {
 *   dependencies: { logging, caching, dataservice, queueing, working, scheduling }
 * }, eventEmitter);
 *
 * // Index an object for searching
 * await searchService.index('users', { id: 1, name: 'John Doe', email: 'john@example.com' });
 *
 * // Search for indexed objects
 * const results = await searchService.search('users', 'John');
 */
function createSearchService(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;

  // Emit service instantiation event
  eventEmitter.emit('Search Service Instantiated', {});

  // Create search service instance
  let searching;

  switch (type) {
    case 'api':
      searching = new SearchingApi(providerOptions, eventEmitter);
      break;
    case 'files':
      searching = new SearchFileService(providerOptions, eventEmitter, dependencies);
      break;
      case 'default':
    default:
      searching = new SearchService(providerOptions, eventEmitter, dependencies);
      break;
  }

  // Inject dependencies for logging
  if (dependencies.logging) {
    searching.logger = dependencies.logging;
    searching.log = (level, message, meta = {}) => {
      if (typeof dependencies.logging[level] === 'function') {
        dependencies.logging[level](`[SEARCHING:${type.toUpperCase()}] ${message}`, meta);
      }
    };

    // Log searching service initialization
    searching.log('info', 'Searching service initialized', {
      provider: type,
      hasLogging: true,
      hasCaching: !!dependencies.caching,
      hasDataService: !!dependencies.dataservice,
      hasQueueing: !!dependencies.queueing,
      hasWorking: !!dependencies.working,
      hasScheduling: !!dependencies.scheduling
    });
  }

  // Store all dependencies for potential use
  searching.dependencies = dependencies;

  // Initialize routes and views for the search service
  Routes(options, eventEmitter, searching);
  Views(options, eventEmitter, searching);

  return searching;
}

module.exports = createSearchService;
