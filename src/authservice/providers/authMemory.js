/**
 * @fileoverview Memory Authentication Provider
 * In-memory authentication provider for development and testing.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const AuthBase = require('./authBase');

/**
 * Memory-based authentication provider.
 * Stores all user data and sessions in memory.
 * @class
 * @extends {AuthBase}
 */
class AuthMemory extends AuthBase {
  /**
   * Initializes the memory authentication provider.
   * @param {Object=} options Configuration options.
   * @param {EventEmitter=} eventEmitter Optional event emitter for auth events.
   */
  constructor(options = {}, eventEmitter) {
    super(options, eventEmitter);

    // Create default admin user if specified in options
    if (options.createDefaultAdmin !== false) {
      this.initializeDefaultUsers_().catch(error => {
        console.error('Error initializing default users:', error);
      });
    }

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:provider-initialized', {
        provider: 'memory',
        message: 'Memory auth provider initialized'
      });
    }
  }

  /**
   * Creates default users for development/testing.
   * @private
   */
  async initializeDefaultUsers_() {
    try {
      // Create default admin user
      await this.createUser({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      });

      // Create default regular user
      await this.createUser({
        username: 'user',
        email: 'user@example.com',
        password: 'user123',
        role: 'user'
      });

      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:default-users-created', {
          message: 'Default admin and user accounts created'
        });
      }
    } catch (error) {
      // Users might already exist, ignore error
    }
  }

  /**
   * Gets service status with memory-specific information.
   * @return {Promise<Object>} Promise resolving to status object.
   */
  async getStatus() {
    const baseStatus = await super.getStatus();
    return {
      ...baseStatus,
      provider: 'memory',
      storage: 'in-memory',
      persistent: false
    };
  }
}

module.exports = AuthMemory;