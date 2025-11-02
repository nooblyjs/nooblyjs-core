/**
 * @fileoverview Base Authentication Provider
 * Base class for authentication providers with user management and role-based access.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Base authentication provider class with common functionality.
 * Provides user management, role-based access, and session handling.
 * @class
 */
class AuthBase {
  /**
   * Initializes the authentication provider.
   * @param {Object=} options Configuration options.
   * @param {EventEmitter=} eventEmitter Optional event emitter for auth events.
   */
  constructor(options = {}, eventEmitter) {
    /** @protected @const {!Map<string, Object>} */
    this.users_ = new Map();
    /** @protected @const {!Map<string, Object>} */
    this.sessions_ = new Map();
    /** @protected @const {!Map<string, Array<string>>} */
    this.roles_ = new Map();
    this.eventEmitter_ = eventEmitter;
    this.options_ = options;

    // Initialize default roles
    this.roles_.set('admin', []);
    this.roles_.set('user', []);
    this.roles_.set('guest', []);

    this.getAuthStrategy = this.getAuthStrategy.bind(this);
  }

  /**
   * Get all our settings
   */
  async getSettings(){
    return this.settings;
  }

  /**
   * Set all our settings
   */
  async saveSettings(settings){
    for (var i=0; i < this.settings.list.length; i++){
      if (settings[this.settings.list[i].setting] != null){
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting] 
        console.log(this.settings.list[i].setting + ' changed to :' + settings[this.settings.list[i].setting]  )
      }
    }
  }

  /**
   * Creates a new user account.
   * @param {Object} userData User data object.
   * @param {string} userData.username Unique username.
   * @param {string} userData.email User email address.
   * @param {string} userData.password User password (will be hashed).
   * @param {string=} userData.role User role (default: 'user').
   * @return {Promise<Object>} Promise resolving to user object.
   */
  async createUser(userData) {
    const { username, email, password, role = 'user' } = userData;

    if (this.users_.has(username)) {
      throw new Error('Username already exists');
    }

    const user = {
      id: this.generateId_(),
      username,
      email,
      password: await this.hashPassword_(password),
      role,
      createdAt: new Date(),
      lastLogin: null,
      isActive: true
    };

    this.users_.set(username, user);
    this.addUserToRole_(username, role);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:user-created', { username, email, role });
    }

    // Return user without password
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Authenticates a user with username and password.
   * @param {string} username Username.
   * @param {string} password Password.
   * @return {Promise<Object>} Promise resolving to user object if authenticated.
   */
  async authenticateUser(username, password) {
    const user = this.users_.get(username);

    if (!user || !user.isActive) {
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:login-failed', { username });
      }
      throw new Error('Invalid credentials');
    }

    const isValid = await this.verifyPassword_(password, user.password);
    if (!isValid) {
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:login-failed', { username });
      }
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();

    // Create session
    const sessionToken = this.generateSessionToken_();
    const session = {
      token: sessionToken,
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
    };

    this.sessions_.set(sessionToken, session);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:login', { username, role: user.role });
    }

    return {
      user: this.getSafeUser_(user),
      session: { token: sessionToken, expiresAt: session.expiresAt }
    };
  }

  /**
   * Validates a session token.
   * @param {string} token Session token.
   * @return {Promise<Object>} Promise resolving to session object if valid.
   */
  async validateSession(token) {
    const session = this.sessions_.get(token);

    if (!session) {
      throw new Error('Invalid session');
    }

    if (session.expiresAt < new Date()) {
      this.sessions_.delete(token);
      throw new Error('Session expired');
    }

    return session;
  }

  /**
   * Logs out a user by invalidating their session.
   * @param {string} token Session token.
   * @return {Promise<void>} Promise resolving when logged out.
   */
  async logout(token) {
    const session = this.sessions_.get(token);
    if (session) {
      this.sessions_.delete(token);
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:logout', { username: session.username });
      }
    }
  }

  /**
   * Gets user by username.
   * @param {string} username Username.
   * @return {Promise<Object>} Promise resolving to user object.
   */
  async getUser(username) {
    const user = this.users_.get(username);
    if (!user) {
      throw new Error('User not found');
    }
    return this.getSafeUser_(user);
  }

  /**
   * Updates user information.
   * @param {string} username Username.
   * @param {Object} updates Object containing fields to update.
   * @return {Promise<Object>} Promise resolving to updated user object.
   */
  async updateUser(username, updates) {
    const user = this.users_.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    // Don't allow updating username or id
    const { username: _, id: __, ...allowedUpdates } = updates;

    // Hash password if being updated
    if (allowedUpdates.password) {
      allowedUpdates.password = await this.hashPassword_(allowedUpdates.password);
    }

    Object.assign(user, allowedUpdates);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:user-updated', { username, updates: Object.keys(allowedUpdates) });
    }

    return this.getSafeUser_(user);
  }

  /**
   * Deletes a user.
   * @param {string} username Username.
   * @return {Promise<void>} Promise resolving when user is deleted.
   */
  async deleteUser(username) {
    const user = this.users_.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    this.users_.delete(username);
    this.removeUserFromRole_(username, user.role);

    // Invalidate all sessions for this user
    for (const [token, session] of this.sessions_.entries()) {
      if (session.username === username) {
        this.sessions_.delete(token);
      }
    }

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:user-deleted', { username });
    }
  }

  /**
   * Lists all users.
   * @return {Promise<Array<Object>>} Promise resolving to array of user objects.
   */
  async listUsers() {
    return Array.from(this.users_.values()).map(user => this.getSafeUser_(user));
  }

  /**
   * Adds a user to a role.
   * @param {string} username Username.
   * @param {string} role Role name.
   * @return {Promise<void>} Promise resolving when user is added to role.
   */
  async addUserToRole(username, role) {
    const user = this.users_.get(username);
    if (!user) {
      throw new Error('User not found');
    }

    this.addUserToRole_(username, role);
    user.role = role;

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:role-assigned', { username, role });
    }
  }

  /**
   * Gets users in a specific role.
   * @param {string} role Role name.
   * @return {Promise<Array<Object>>} Promise resolving to array of user objects.
   */
  async getUsersInRole(role) {
    const usernames = this.roles_.get(role) || [];
    return usernames.map(username => this.getSafeUser_(this.users_.get(username))).filter(Boolean);
  }

  /**
   * Lists all roles.
   * @return {Promise<Array<string>>} Promise resolving to array of role names.
   */
  async listRoles() {
    return Array.from(this.roles_.keys());
  }

  /**
   * Gets service status.
   * @return {Promise<Object>} Promise resolving to status object.
   */
  async getStatus() {
    return {
      service: 'auth',
      provider: this.constructor.name,
      users: this.users_.size,
      activeSessions: this.sessions_.size,
      roles: this.roles_.size,
      uptime: process.uptime()
    };
  }

  /**
   * Generates a unique ID.
   * @return {string} Unique identifier.
   * @private
   */
  generateId_() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Generates a session token.
   * @return {string} Session token.
   * @private
   */
  generateSessionToken_() {
    return Math.random().toString(36).substr(2, 15) + Date.now().toString(36);
  }

  /**
   * Hashes a password.
   * @param {string} password Plain text password.
   * @return {Promise<string>} Promise resolving to hashed password.
   * @private
   */
  async hashPassword_(password) {
    // Simple hash for demo - in production use bcrypt or similar
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(password + 'salt').digest('hex');
  }

  /**
   * Verifies a password against a hash.
   * @param {string} password Plain text password.
   * @param {string} hash Hashed password.
   * @return {Promise<boolean>} Promise resolving to true if password is valid.
   * @private
   */
  async verifyPassword_(password, hash) {
    const hashedPassword = await this.hashPassword_(password);
    return hashedPassword === hash;
  }

  /**
   * Adds user to role internal method.
   * @param {string} username Username.
   * @param {string} role Role name.
   * @private
   */
  addUserToRole_(username, role) {
    if (!this.roles_.has(role)) {
      this.roles_.set(role, []);
    }
    const users = this.roles_.get(role);
    if (!users.includes(username)) {
      users.push(username);
    }
  }

  /**
   * Removes user from role internal method.
   * @param {string} username Username.
   * @param {string} role Role name.
   * @private
   */
  removeUserFromRole_(username, role) {
    const users = this.roles_.get(role);
    if (users) {
      const index = users.indexOf(username);
      if (index > -1) {
        users.splice(index, 1);
      }
    }
  }

  /**
   * Returns user object without sensitive information.
   * @param {Object} user User object.
   * @return {Object} Safe user object.
   * @private
   */
  getSafeUser_(user) {
    const { password, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Creates authentication middleware for protecting routes.
   * Automatically handles login redirects with optional referrer tracking.
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.loginPath='/services/authservice/views/login.html'] - Path to login page
   * @param {boolean} [options.saveReferer=true] - Whether to save original URL as referrer
   * @returns {Function} Express middleware function
   * @example
   * const requireAuth = authservice.createAuthMiddleware();
   * app.use('/app', requireAuth, express.static(__dirname + '/public/app'));
   */
  createAuthMiddleware(options = {}) {
    const { createAuthMiddleware } = require('../middleware/authenticate');
    return createAuthMiddleware(options);
  }

  /**
   * Creates authentication middleware with custom response handling.
   * Allows custom logic for unauthorized requests (e.g., JSON responses for APIs).
   * @param {Object} [options={}] - Configuration options
   * @param {Function} [options.onUnauthorized] - Custom handler for unauthenticated requests
   * @returns {Function} Express middleware function
   * @example
   * const requireAuthApi = authservice.createAuthMiddlewareWithHandler({
   *   onUnauthorized: (req, res) => res.status(401).json({ error: 'Unauthorized' })
   * });
   * app.get('/api/protected', requireAuthApi, handler);
   */
  createAuthMiddlewareWithHandler(options = {}) {
    const { createAuthMiddlewareWithHandler } = require('../middleware/authenticate');
    return createAuthMiddlewareWithHandler(options);
  }

  /**
   * Returns a passport strategy factory when supported by the provider.
   * Providers that do not integrate with passport should override this method.
   * @return {?Function} Strategy factory or null if unsupported.
   */
  getAuthStrategy() {
    let LocalStrategy;
    try {
      ({ Strategy: LocalStrategy } = require('passport-local'));
    } catch (error) {
      return null;
    }

    const strategy = new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password'
      },
      async (username, password, done) => {
        try {
          const result = await this.authenticateUser(username, password);
          return done(null, result.user, { session: result.session });
        } catch (error) {
          return done(null, false, { message: error.message });
        }
      }
    );

    return {
      strategy,
      serializeUser: (user, done) => {
        try {
          if (!user || !user.username) {
            return done(new Error('User object must have a username property'));
          }
          done(null, user.username);
        } catch (error) {
          done(error);
        }
      },
      deserializeUser: async (username, done) => {
        try {
          if (!username) {
            return done(new Error('Username is required for deserialization'));
          }
          const user = await this.getUser(username);
          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    };
  }
}

module.exports = AuthBase;
