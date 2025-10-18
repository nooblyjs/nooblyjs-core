/**
 * @fileoverview File-based Authentication Provider
 * File-based authentication provider with persistent storage and secure password handling.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const AuthBase = require('./authBase');

/**
 * File-based authentication provider.
 * Stores all user data and sessions in JSON files with secure password generation.
 * @class
 * @extends {AuthBase}
 */
class AuthFile extends AuthBase {
  /**
   * Initializes the file authentication provider.
   * @param {Object=} options Configuration options.
   * @param {string=} options.dataDir Directory to store user data files (default: './data/auth')
   * @param {EventEmitter=} eventEmitter Optional event emitter for auth events.
   */
  constructor(options = {}, eventEmitter) {
    super(options, eventEmitter);

    this.settings = {};
    this.settings.desciption = "This provider exposes the nooblyjs file implementation settings"
    this.settings.list = [
      {setting: "datadir", type: "string", values : ['/data/']}
    ]

    this.dataDir_ = options.dataDir || this.settings.datadir || path.join(process.cwd(), 'data', 'auth');
    this.usersFile_ = path.join(this.dataDir_, 'users.json');
    this.rolesFile_ = path.join(this.dataDir_, 'roles.json');
    this.sessionsFile_ = path.join(this.dataDir_, 'sessions.json');

    // Initialize file storage
    this.initializeFileStorage_().catch(error => {
      console.error('Error initializing file storage:', error);
    });

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:provider-initialized', {
        provider: 'file',
        message: 'File auth provider initialized'
      });
    }
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
   * Generates a cryptographically secure random password.
   * @param {number} length Password length (default: 16)
   * @return {string} Generated password
   * @private
   */
  generateSecurePassword_(length = 16) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';

    // Ensure at least one character from each category
    const categories = [
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz',
      '0123456789',
      '!@#$%^&*()_+-=[]{}|;:,.<>?'
    ];

    // Add one character from each category
    for (const category of categories) {
      const randomIndex = crypto.randomInt(category.length);
      password += category[randomIndex];
    }

    // Fill remaining length with random characters
    for (let i = password.length; i < length; i++) {
      const randomIndex = crypto.randomInt(charset.length);
      password += charset[randomIndex];
    }

    // Shuffle the password to avoid predictable patterns
    return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
  }

  /**
   * Initializes file storage and creates default admin user if needed.
   * @private
   */
  async initializeFileStorage_() {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir_, { recursive: true });

      // Load existing data or create new files
      await this.loadUsersFromFile_();
      await this.loadRolesFromFile_();
      await this.loadSessionsFromFile_();

      // Create default admin user if no users exist
      if (this.users_.size === 0) {
        await this.createDefaultAdmin_();
      }

      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:file-storage-initialized', {
          message: 'File storage initialized successfully',
          usersCount: this.users_.size,
          dataDir: this.dataDir_
        });
      }
    } catch (error) {
      console.error('Failed to initialize file storage:', error);
      throw error;
    }
  }

  /**
   * Creates a default admin user with a secure generated password.
   * @private
   */
  async createDefaultAdmin_() {
    const adminPassword = this.generateSecurePassword_(20);

    console.log('\n' + '='.repeat(80));
    console.log('🔐 DEFAULT ADMIN USER CREATED');
    console.log('='.repeat(80));
    console.log('Username: administrator');
    console.log('Email: admin@localhost');
    console.log(`Password: ${adminPassword}`);
    console.log('='.repeat(80));
    console.log('⚠️  IMPORTANT: Save this password immediately!');
    console.log('   This password will be hashed and cannot be recovered.');
    console.log('   Change it after first login for security.');
    console.log('='.repeat(80) + '\n');

    try {
      await this.createUser({
        username: 'administrator',
        email: 'admin@localhost',
        password: adminPassword,
        role: 'admin'
      });

      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:default-admin-created', {
          message: 'Default admin user created with secure password',
          username: 'admin'
        });
      }
    } catch (error) {
      console.error('Failed to create default admin user:', error);
      throw error;
    }
  }

  /**
   * Loads users from file.
   * @private
   */
  async loadUsersFromFile_() {
    try {
      const data = await fs.readFile(this.usersFile_, 'utf8');
      const users = JSON.parse(data);
      this.users_ = new Map(Object.entries(users));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, start with empty users
      this.users_ = new Map();
    }
  }

  /**
   * Saves users to file.
   * @private
   */
  async saveUsersToFile_() {
    const users = Object.fromEntries(this.users_);
    await fs.writeFile(this.usersFile_, JSON.stringify(users, null, 2), 'utf8');
  }

  /**
   * Loads roles from file.
   * @private
   */
  async loadRolesFromFile_() {
    try {
      const data = await fs.readFile(this.rolesFile_, 'utf8');
      const roles = JSON.parse(data);
      this.roles_ = new Map(Object.entries(roles));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, initialize with default roles
      this.roles_ = new Map();
      this.roles_.set('admin', []);
      this.roles_.set('user', []);
      this.roles_.set('guest', []);
      await this.saveRolesToFile_();
    }
  }

  /**
   * Saves roles to file.
   * @private
   */
  async saveRolesToFile_() {
    const roles = Object.fromEntries(this.roles_);
    await fs.writeFile(this.rolesFile_, JSON.stringify(roles, null, 2), 'utf8');
  }

  /**
   * Loads sessions from file.
   * @private
   */
  async loadSessionsFromFile_() {
    try {
      const data = await fs.readFile(this.sessionsFile_, 'utf8');
      const sessions = JSON.parse(data);

      // Clean up expired sessions while loading and convert date strings to Date objects
      const now = new Date();
      const validSessions = {};

      for (const [token, session] of Object.entries(sessions)) {
        // Convert date strings to Date objects
        session.createdAt = new Date(session.createdAt);
        session.expiresAt = new Date(session.expiresAt);

        if (session.expiresAt > now) {
          validSessions[token] = session;
        }
      }

      this.sessions_ = new Map(Object.entries(validSessions));

      // Save cleaned sessions back to file
      if (Object.keys(validSessions).length !== Object.keys(sessions).length) {
        await this.saveSessionsToFile_();
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, start with empty sessions
      this.sessions_ = new Map();
    }
  }

  /**
   * Saves sessions to file.
   * @private
   */
  async saveSessionsToFile_() {
    const sessions = Object.fromEntries(this.sessions_);
    await fs.writeFile(this.sessionsFile_, JSON.stringify(sessions, null, 2), 'utf8');
  }

  /**
   * Creates a new user account and persists to file.
   * @param {Object} userData User data object.
   * @return {Promise<Object>} Promise resolving to user object.
   * @override
   */
  async createUser(userData) {
    const user = await super.createUser(userData);
    await this.saveUsersToFile_();
    return user;
  }

  /**
   * Updates user information and persists to file.
   * @param {string} username Username to update.
   * @param {Object} updateData Data to update.
   * @return {Promise<Object>} Promise resolving to updated user object.
   * @override
   */
  async updateUser(username, updateData) {
    const user = await super.updateUser(username, updateData);
    await this.saveUsersToFile_();
    return user;
  }

  /**
   * Deletes a user account and persists changes to file.
   * @param {string} username Username to delete.
   * @return {Promise<void>} Promise resolving when user is deleted.
   * @override
   */
  async deleteUser(username) {
    await super.deleteUser(username);
    await this.saveUsersToFile_();
  }

  /**
   * Authenticates a user and creates a session, persisting to file.
   * @param {string} username Username.
   * @param {string} password Password.
   * @return {Promise<Object>} Promise resolving to auth result.
   * @override
   */
  async authenticateUser(username, password) {
    const result = await super.authenticateUser(username, password);
    await this.saveSessionsToFile_();
    return result;
  }

  /**
   * Validates a session token and persists any session cleanup to file.
   * @param {string} token Session token.
   * @return {Promise<Object>} Promise resolving to session object if valid.
   * @override
   */
  async validateSession(token) {
    const session = this.sessions_.get(token);

    if (!session) {
      throw new Error('Invalid session');
    }

    if (session.expiresAt < new Date()) {
      this.sessions_.delete(token);
      // Persist the session deletion to file
      await this.saveSessionsToFile_();
      throw new Error('Session expired');
    }

    return session;
  }

  /**
   * Logs out a user and persists session changes to file.
   * @param {string} token Session token.
   * @return {Promise<void>} Promise resolving when logged out.
   * @override
   */
  async logout(token) {
    await super.logout(token);
    await this.saveSessionsToFile_();
  }

  /**
   * Gets service status with file-specific information.
   * @return {Promise<Object>} Promise resolving to status object.
   * @override
   */
  async getStatus() {
    const baseStatus = await super.getStatus();

    // Check file system status
    let filesStatus = 'unknown';
    try {
      await fs.access(this.dataDir_);
      filesStatus = 'accessible';
    } catch (error) {
      filesStatus = 'inaccessible';
    }

    return {
      ...baseStatus,
      provider: 'file',
      storage: 'file-based',
      persistent: true,
      dataDirectory: this.dataDir_,
      filesStatus,
      files: {
        users: this.usersFile_,
        roles: this.rolesFile_,
        sessions: this.sessionsFile_
      }
    };
  }
}

module.exports = AuthFile;