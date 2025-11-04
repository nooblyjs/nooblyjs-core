/**
 * @fileoverview In-memory DataService provider for storing and searching JSON objects
 * with container-based organization and event emission support.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * A class that implements an in-memory data storage provider.
 * Provides methods for creating containers and storing, retrieving, and searching JSON objects.
 * @class
 */
class InMemoryDataServiceProvider {
  /**
   * Initializes the in-memory data storage provider.
   * @param {Object=} options Configuration options (unused in this implementation).
   * @param {EventEmitter=} eventEmitter Optional event emitter for data operations.
   */
  constructor(options, eventEmitter) {

    this.containers = new Map(); // Map<containerName, Map<objectKey, object>>
    this.eventEmitter_ = eventEmitter;

    // Settings for data service
    this.settings = {};
    this.settings.description = "Configuration settings for the Data Service";
    this.settings.list = [
      {setting: "dataDir", type: "string", values: ['./.noobly-core/data']},
      {setting: "autoCreateContainers", type: "boolean", values: [true, false]},
      {setting: "persistData", type: "boolean", values: [true, false]}
    ];

    this.settings.dataDir = options.dataDir || this.settings.dataDir || './.noobly-core/data';
    this.settings.autoCreateContainers = options.autoCreateContainers !== undefined ? options.autoCreateContainers : true;
    this.settings.persistData = options.persistData !== undefined ? options.persistData : false;

  }

  /**
   * Get all settings
   */
  async getSettings(){
    return this.settings;
  }

  /**
   * Save/update settings
   */
  async saveSettings(settings){
    for (let i = 0; i < this.settings.list.length; i++){
      if (settings[this.settings.list[i].setting] != null){
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting];
        console.log(this.settings.list[i].setting + ' changed to: ' + settings[this.settings.list[i].setting]);
      }
    }
  }

  /**
   * Creates a new container for storing JSON objects.
   * @param {string} containerName The name of the container to create.
   * @return {Promise<void>} A promise that resolves when the container is created.
   * @throws {Error} When containerName is invalid or a container with the same name already exists.
   */
  async createContainer(containerName) {
    // Validate containerName parameter
    if (!containerName || typeof containerName !== 'string' || containerName.trim() === '') {
      const error = new Error('Invalid containerName: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'createContainer',
          error: error.message,
          containerName
        });
      }
      throw error;
    }

    if (this.containers.has(containerName)) {
      throw new Error(`Container '${containerName}' already exists.`);
    }
    this.containers.set(containerName, new Map());
    if (this.eventEmitter_)
      this.eventEmitter_.emit('api-dataservice-createContainer', { containerName });
  }

  /**
   * Adds a JSON object to the specified container.
   * @param {string} containerName The name of the container to add the object to.
   * @param {!Object} jsonObject The JSON object to store.
   * @return {Promise<string>} A promise that resolves to the unique key for the stored object.
   * @throws {Error} When containerName or jsonObject is invalid, or container does not exist.
   */
  async add(containerName, jsonObject) {
    // Validate containerName parameter
    if (!containerName || typeof containerName !== 'string' || containerName.trim() === '') {
      const error = new Error('Invalid containerName: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'add',
          error: error.message,
          containerName
        });
      }
      throw error;
    }

    // Validate jsonObject parameter
    if (!jsonObject || typeof jsonObject !== 'object' || Array.isArray(jsonObject)) {
      const error = new Error('Invalid jsonObject: must be a non-null object');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'add',
          error: error.message,
          containerName
        });
      }
      throw error;
    }

    if (!this.containers.has(containerName)) {
      throw new Error(`Container '${containerName}' does not exist.`);
    }
    const objectKey = uuidv4();
    this.containers.get(containerName).set(objectKey, jsonObject);
    if (this.eventEmitter_)
      this.eventEmitter_.emit('api-dataservice-add', {
        containerName,
        objectKey,
        jsonObject,
      });
    return objectKey;
  }

  /**
   * Gets a JSON object from the specified container by UUID.
   * @param {string} containerName The name of the container to retrieve the object from.
   * @param {string} objectKey The unique UUID of the object to retrieve.
   * @return {Promise<Object|null>} A promise that resolves to the object or null if not found.
   * @throws {Error} When containerName or objectKey is invalid.
   */
  async getByUuid(containerName, objectKey) {
    // Validate containerName parameter
    if (!containerName || typeof containerName !== 'string' || containerName.trim() === '') {
      const error = new Error('Invalid containerName: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'getByUuid',
          error: error.message,
          containerName
        });
      }
      throw error;
    }

    // Validate objectKey parameter
    if (!objectKey || typeof objectKey !== 'string' || objectKey.trim() === '') {
      const error = new Error('Invalid objectKey: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'getByUuid',
          error: error.message,
          containerName,
          objectKey
        });
      }
      throw error;
    }

    if (!this.containers.has(containerName)) {
      return null;
    }
    const obj = this.containers.get(containerName).get(objectKey);
    if (obj && this.eventEmitter_)
      this.eventEmitter_.emit('api-dataservice-getByUuid', { containerName, objectKey, obj });
    return obj || null;
  }

  /**
   * Removes a JSON object from the specified container.
   * @param {string} containerName The name of the container to remove the object from.
   * @param {string} objectKey The unique key of the object to remove.
   * @return {Promise<boolean>} A promise that resolves to true if the object was removed, false otherwise.
   * @throws {Error} When containerName or objectKey is invalid.
   */
  async remove(containerName, objectKey) {
    // Validate containerName parameter
    if (!containerName || typeof containerName !== 'string' || containerName.trim() === '') {
      const error = new Error('Invalid containerName: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'remove',
          error: error.message,
          containerName
        });
      }
      throw error;
    }

    // Validate objectKey parameter
    if (!objectKey || typeof objectKey !== 'string' || objectKey.trim() === '') {
      const error = new Error('Invalid objectKey: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'remove',
          error: error.message,
          containerName,
          objectKey
        });
      }
      throw error;
    }

    if (!this.containers.has(containerName)) {
      return false;
    }
    const removed = this.containers.get(containerName).delete(objectKey);
    if (removed && this.eventEmitter_)
      this.eventEmitter_.emit('api-dataservice-remove', { containerName, objectKey });
    return removed;
  }

  /**
   * Finds JSON objects in the specified container that contain the search term.
   * Performs a recursive search through all string values in the objects.
   * @param {string} containerName The name of the container to search in.
   * @param {string} searchTerm The term to search for (case-insensitive).
   * @return {Promise<Array<!Object>>} A promise that resolves to an array of matching objects.
   * @throws {Error} When containerName or searchTerm is invalid.
   */
  async find(containerName, searchTerm) {
    // Validate containerName parameter
    if (!containerName || typeof containerName !== 'string' || containerName.trim() === '') {
      const error = new Error('Invalid containerName: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'find',
          error: error.message,
          containerName
        });
      }
      throw error;
    }

    // Validate searchTerm parameter
    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
      const error = new Error('Invalid searchTerm: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('api-dataservice-validation-error', {
          method: 'find',
          error: error.message,
          containerName,
          searchTerm
        });
      }
      throw error;
    }

    if (!this.containers.has(containerName)) {
      if (this.eventEmitter_)
        this.eventEmitter_.emit('api-dataservice-find', {
          containerName,
          searchTerm,
          results: [],
        });
      return [];
    }
    const results = [];
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    for (const [key, obj] of this.containers.get(containerName).entries()) {
      let found = false;
      const searchInObject = (currentObj) => {
        for (const prop in currentObj) {
          if (Object.prototype.hasOwnProperty.call(currentObj, prop)) {
            const value = currentObj[prop];
            if (typeof value === 'string') {
              if (value.toLowerCase().includes(lowerCaseSearchTerm)) {
                found = true;
                return;
              }
            } else if (typeof value === 'object' && value !== null) {
              searchInObject(value);
              if (found) return;
            }
          }
        }
      };

      searchInObject(obj);
      if (found) {
        results.push(obj);
      }
    }
    if (this.eventEmitter_)
      this.eventEmitter_.emit('api-dataservice-find', {
        containerName,
        searchTerm,
        results,
      });
    return results;
  }

}

module.exports = InMemoryDataServiceProvider;
