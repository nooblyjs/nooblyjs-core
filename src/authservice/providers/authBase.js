/**
 * @fileoverview Base Authentication Provider
 * Base class for authentication providers with user management and role-based access.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * bcrypt cost factor used for password hashing. Defaults to 12; override via
 * the BCRYPT_COST environment variable (e.g. lower it in test environments to
 * keep suites fast).
 * @const {number}
 */
const BCRYPT_COST = parseInt(process.env.BCRYPT_COST, 10) || 12;

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
    /**
     * Index of hashed API token -> owner, for O(1) token validation instead of
     * scanning every user on each request. Built lazily on first validation and
     * maintained incrementally on create/delete.
     * @protected {!Map<string, {email: string, tokenId: string}>}
     */
    this.tokenIndex_ = new Map();
    /** @protected {boolean} Whether tokenIndex_ has been fully built. */
    this.tokenIndexBuilt_ = false;
    /** @protected {number} Epoch ms of the last throttled token-usage persist. */
    this.lastTokenUsagePersistAt_ = 0;
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
    for (let i=0; i < this.settings.list.length; i++){
      if (settings[this.settings.list[i].setting] != null){
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting]
        if (this.eventEmitter_) {
          this.eventEmitter_.emit('auth:setting-changed', {
            setting: this.settings.list[i].setting,
            value: settings[this.settings.list[i].setting]
          });
        }
      }
    }
  }

  /**
   * Creates a new user account.
   * @param {Object} userData User data object.
   * @param {string} userData.email User email address (serves as the unique identity).
   * @param {string} userData.fullName User's full display name.
   * @param {string} userData.password User password (will be hashed).
   * @param {string=} userData.role User role (default: 'user').
   * @return {Promise<Object>} Promise resolving to user object.
   * @throws {Error} When userData is invalid or the email already exists.
   */
  async createUser(userData) {
    // Validate userData parameter
    if (!userData || typeof userData !== 'object' || Array.isArray(userData)) {
      const error = new Error('Invalid userData: must be a non-null object');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'createUser',
          error: error.message
        });
      }
      throw error;
    }

    const { email, fullName, password, role = 'user' } = userData;

    // Validate email (also serves as the unique account identity)
    if (!email || typeof email !== 'string' || email.trim() === '') {
      const error = new Error('Invalid email: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'createUser',
          error: error.message,
          email
        });
      }
      throw error;
    }

    // Validate fullName
    if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
      const error = new Error('Invalid fullName: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'createUser',
          error: error.message,
          email
        });
      }
      throw error;
    }

    // Validate password
    if (!password || typeof password !== 'string' || password.trim() === '') {
      const error = new Error('Invalid password: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'createUser',
          error: error.message,
          email
        });
      }
      throw error;
    }

    // Validate password strength
    const strength = await this.validatePasswordStrength(password);
    if (!strength.valid) {
      const error = new Error('Password does not meet strength requirements: ' + strength.errors.join(', '));
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'createUser',
          error: error.message,
          email
        });
      }
      throw error;
    }

    if (this.users_.has(email)) {
      throw new Error('Email already exists');
    }

    // Support both single role and multiple roles
    const roles = Array.isArray(role) ? role : [role];

    const user = {
      id: this.generateId_(),
      email,
      fullName,
      password: await this.hashPassword_(password),
      roles,
      createdAt: new Date(),
      lastLogin: null,
      isActive: true
    };

    this.users_.set(email, user);
    roles.forEach(r => this.addUserToRole_(email, r));

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:user-created', { email, fullName, roles });
    }

    // Return user without password
    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Authenticates a user with email and password.
   * @param {string} email User email address.
   * @param {string} password Password.
   * @return {Promise<Object>} Promise resolving to user object if authenticated.
   * @throws {Error} When email or password is invalid, or credentials are incorrect.
   */
  async authenticateUser(email, password) {
    // Validate email parameter
    if (!email || typeof email !== 'string' || email.trim() === '') {
      const error = new Error('Invalid email: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'authenticateUser',
          error: error.message,
          email
        });
      }
      throw error;
    }

    // Validate password parameter
    if (!password || typeof password !== 'string') {
      const error = new Error('Invalid password: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'authenticateUser',
          error: error.message,
          email
        });
      }
      throw error;
    }

    const user = this.users_.get(email);

    if (!user || !user.isActive) {
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:login-failed', { email });
      }
      throw new Error('Invalid credentials');
    }

    const isValid = await this.verifyPassword_(password, user.password);
    if (!isValid) {
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:login-failed', { email });
      }
      throw new Error('Invalid credentials');
    }

    // Transparently upgrade legacy password hashes to bcrypt on login.
    if (this.needsRehash_(user.password)) {
      try {
        user.password = await this.hashPassword_(password);
        if (typeof this.saveUsersToFile_ === 'function') {
          await this.saveUsersToFile_();
        }
      } catch (err) {
        this.logger?.warn?.(`[${this.constructor.name}] Password rehash failed`, {
          email,
          error: err?.message
        });
      }
    }

    // Update last login
    user.lastLogin = new Date();

    // Create session
    const sessionToken = this.generateSessionToken_();
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    const session = {
      token: sessionToken,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: userRoles,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
    };

    this.sessions_.set(sessionToken, session);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:login', { email, roles: userRoles });
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
   * @throws {Error} When token is invalid or session is expired.
   */
  async validateSession(token) {
    // Validate token parameter
    if (!token || typeof token !== 'string' || token.trim() === '') {
      const error = new Error('Invalid token: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'validateSession',
          error: error.message
        });
      }
      throw error;
    }

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
        this.eventEmitter_.emit('auth:logout', { email: session.email });
      }
    }
  }

  /**
   * Gets user by email.
   * @param {string} email User email address.
   * @return {Promise<Object>} Promise resolving to user object.
   */
  async getUser(email) {
    const user = this.users_.get(email);
    if (!user) {
      throw new Error('User not found');
    }
    return this.getSafeUser_(user);
  }

  /**
   * Updates user information.
   * @param {string} email User email address.
   * @param {Object} updates Object containing fields to update.
   * @return {Promise<Object>} Promise resolving to updated user object.
   * @throws {Error} When email or updates is invalid, or user not found.
   */
  async updateUser(email, updates) {
    // Validate email parameter
    if (!email || typeof email !== 'string' || email.trim() === '') {
      const error = new Error('Invalid email: must be a non-empty string');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'updateUser',
          error: error.message,
          email
        });
      }
      throw error;
    }

    // Validate updates parameter
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      const error = new Error('Invalid updates: must be a non-null object');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:validation-error', {
          method: 'updateUser',
          error: error.message,
          email
        });
      }
      throw error;
    }

    const user = this.users_.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Don't allow updating email (the identity) or id
    const { email: _, id: __, ...allowedUpdates } = updates;

    // Hash password if being updated
    if (allowedUpdates.password) {
      // Validate password strength
      const strength = await this.validatePasswordStrength(allowedUpdates.password);
      if (!strength.valid) {
        const error = new Error('Password does not meet strength requirements: ' + strength.errors.join(', '));
        if (this.eventEmitter_) {
          this.eventEmitter_.emit('auth:validation-error', {
            method: 'updateUser',
            error: error.message,
            email
          });
        }
        throw error;
      }
      allowedUpdates.password = await this.hashPassword_(allowedUpdates.password);
    }

    Object.assign(user, allowedUpdates);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:user-updated', { email, updates: Object.keys(allowedUpdates) });
    }

    return this.getSafeUser_(user);
  }

  /**
   * Deletes a user.
   * @param {string} email User email address.
   * @return {Promise<void>} Promise resolving when user is deleted.
   */
  async deleteUser(email) {
    const user = this.users_.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    this.users_.delete(email);
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || ''];
    userRoles.forEach(role => this.removeUserFromRole_(email, role));

    // Invalidate all sessions for this user
    for (const [token, session] of this.sessions_.entries()) {
      if (session.email === email) {
        this.sessions_.delete(token);
      }
    }

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:user-deleted', { email });
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
   * @param {string} email User email address.
   * @param {string} role Role name.
   * @return {Promise<void>} Promise resolving when user is added to role.
   */
  async addUserToRole(email, role) {
    const user = this.users_.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    this.addUserToRole_(email, role);
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    if (!userRoles.includes(role)) {
      userRoles.push(role);
      user.roles = userRoles;
    }

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:role-assigned', { email, role });
    }
  }

  /**
   * Gets users in a specific role.
   * @param {string} role Role name.
   * @return {Promise<Array<Object>>} Promise resolving to array of user objects.
   */
  async getUsersInRole(role) {
    const emails = this.roles_.get(role) || [];
    return emails.map(email => this.getSafeUser_(this.users_.get(email))).filter(Boolean);
  }

  /**
   * Lists all roles.
   * @return {Promise<Array<string>>} Promise resolving to array of role names.
   */
  async listRoles() {
    return Array.from(this.roles_.keys());
  }

  /**
   * Creates a new role.
   * @param {string} roleName Role name.
   * @return {Promise<string>} Promise resolving to the new role name.
   * @throws {Error} When role name is invalid or already exists.
   */
  async createRole(roleName) {
    if (!roleName || typeof roleName !== 'string' || roleName.trim() === '') {
      throw new Error('Role name must be a non-empty string');
    }

    if (this.roles_.has(roleName)) {
      throw new Error('Role already exists');
    }

    this.roles_.set(roleName, []);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:role-created', { roleName });
    }

    return roleName;
  }

  /**
   * Deletes a role.
   * @param {string} roleName Role name.
   * @return {Promise<void>} Promise resolving when role is deleted.
   * @throws {Error} When role not found or users still assigned.
   */
  async deleteRole(roleName) {
    if (!this.roles_.has(roleName)) {
      throw new Error('Role not found');
    }

    const users = this.roles_.get(roleName);
    if (users && users.length > 0) {
      throw new Error('Cannot delete role with assigned users. Reassign users first.');
    }

    this.roles_.delete(roleName);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:role-deleted', { roleName });
    }
  }

  /**
   * Batch creates or updates users from an array.
   * @param {Array<Object>} usersArray Array of user objects to create/update.
   * @return {Promise<Object>} Promise resolving to { created: [], updated: [], errors: [] }.
   */
  async batchCreateUpdateUsers(usersArray) {
    const results = {
      created: [],
      updated: [],
      errors: []
    };

    if (!Array.isArray(usersArray)) {
      throw new Error('Users array must be an array');
    }

    for (let i = 0; i < usersArray.length; i++) {
      try {
        const userData = usersArray[i];

        if (this.users_.has(userData.email)) {
          // Update existing user
          const updated = await this.updateUser(userData.email, userData);
          results.updated.push(updated);
        } else {
          // Create new user
          const created = await this.createUser(userData);
          results.created.push(created);
        }
      } catch (error) {
        results.errors.push({
          row: i + 1,
          email: usersArray[i].email,
          error: error.message
        });
      }
    }

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:batch-import', {
        created: results.created.length,
        updated: results.updated.length,
        errors: results.errors.length
      });
    }

    return results;
  }

  /**
   * Changes a user's password.
   * @param {string} email User email address.
   * @param {string} currentPassword Current password (for verification).
   * @param {string} newPassword New password.
   * @return {Promise<Object>} Promise resolving to updated user object.
   * @throws {Error} When credentials are invalid or password is weak.
   */
  async changePassword(email, currentPassword, newPassword) {
    if (!email || !currentPassword || !newPassword) {
      throw new Error('Email, current password, and new password are required');
    }

    const user = this.users_.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await this.verifyPassword_(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const strength = await this.validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error('New password does not meet strength requirements: ' + strength.errors.join(', '));
    }

    user.password = await this.hashPassword_(newPassword);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:password-changed', { email });
    }

    return this.getSafeUser_(user);
  }

  /**
   * Prefix carried by every issued personal access token. It is part of the
   * secret (and therefore part of what is hashed at rest) so that the auth
   * middleware can cheaply recognise a user token versus a static API key, and
   * so leaked tokens are greppable in logs and secret-scanners.
   * @const {string}
   */
  static get TOKEN_PREFIX() {
    return 'dtk_';
  }

  /**
   * Returns a display-safe view of a stored token (never the hashed secret).
   * @param {Object} t Stored token record.
   * @return {Object} Token metadata safe to return to callers.
   * @protected
   */
  getSafeToken_(t) {
    return {
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      createdAt: t.createdAt,
      lastUsed: t.lastUsed,
      expiresAt: t.expiresAt
    };
  }

  /**
   * (Re)builds the hashed-token -> owner index from the in-memory user map.
   * Called lazily on first validation so it picks up tokens loaded from disk.
   * @protected
   */
  buildTokenIndex_() {
    const index = new Map();
    for (const [email, user] of this.users_.entries()) {
      const tokens = Array.isArray(user.apiTokens) ? user.apiTokens : [];
      for (const t of tokens) {
        if (t && t.token) {
          index.set(t.token, { email, tokenId: t.id });
        }
      }
    }
    this.tokenIndex_ = index;
    this.tokenIndexBuilt_ = true;
  }

  /**
   * Persists token usage (lastUsed) at most once per minute. lastUsed is
   * telemetry, not security state, so writes are throttled and fire-and-forget
   * to avoid an I/O storm on hot API paths. No-op when the provider has no
   * file persistence.
   * @protected
   */
  persistTokenUsageThrottled_() {
    if (typeof this.saveUsersToFile_ !== 'function') {
      return;
    }
    const now = Date.now();
    if (this.lastTokenUsagePersistAt_ && (now - this.lastTokenUsagePersistAt_) < 60000) {
      return;
    }
    this.lastTokenUsagePersistAt_ = now;
    Promise.resolve()
      .then(() => this.saveUsersToFile_())
      .catch(() => { /* telemetry only — ignore persistence failures */ });
  }

  /**
   * Creates an API (personal access) token for a user. The raw secret is
   * returned exactly once; only its SHA-256 hash is stored.
   * @param {string} email User email address.
   * @param {string} tokenName Token name/label.
   * @param {Object=} options Token options.
   * @param {number=} options.expiresInDays Days until the token expires (omit for no expiry).
   * @param {(string|Date)=} options.expiresAt Explicit expiry timestamp (overrides expiresInDays).
   * @return {Promise<Object>} Promise resolving to { id, token, tokenPrefix, name, createdAt, expiresAt }.
   * @throws {Error} When email/tokenName are missing or the user does not exist.
   */
  async createApiToken(email, tokenName, options = {}) {
    if (!email || !tokenName) {
      throw new Error('Email and token name are required');
    }

    const user = this.users_.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.apiTokens) {
      user.apiTokens = [];
    }

    const tokenId = 'tok_' + crypto.randomBytes(9).toString('hex');
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const wireToken = AuthBase.TOKEN_PREFIX + rawSecret;
    const hashedToken = crypto.createHash('sha256').update(wireToken).digest('hex');
    const tokenPrefix = wireToken.substring(0, 12); // 'dtk_' + first 8 hex chars

    let expiresAt = null;
    if (options.expiresAt) {
      const parsed = new Date(options.expiresAt);
      if (!Number.isNaN(parsed.getTime())) {
        expiresAt = parsed;
      }
    } else if (options.expiresInDays != null && Number(options.expiresInDays) > 0) {
      expiresAt = new Date(Date.now() + Number(options.expiresInDays) * 24 * 60 * 60 * 1000);
    }

    const token = {
      id: tokenId,
      name: tokenName,
      token: hashedToken,
      tokenPrefix: tokenPrefix,
      createdAt: new Date(),
      lastUsed: null,
      expiresAt: expiresAt
    };

    user.apiTokens.push(token);

    // Keep the validation index current when it has already been built.
    if (this.tokenIndexBuilt_ && this.tokenIndex_) {
      this.tokenIndex_.set(hashedToken, { email, tokenId });
    }

    // Persist immediately so tokens survive a restart (file provider). Other
    // providers without saveUsersToFile_ keep tokens in memory only.
    if (typeof this.saveUsersToFile_ === 'function') {
      await this.saveUsersToFile_();
    }

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:api-token-created', { email, tokenName });
    }

    return {
      id: token.id,
      token: wireToken,
      tokenPrefix: token.tokenPrefix,
      name: token.name,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt
    };
  }

  /**
   * Lists API tokens for a user.
   * @param {string} email User email address.
   * @return {Promise<Array<Object>>} Promise resolving to array of tokens (without secret).
   */
  async listApiTokens(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    const user = this.users_.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    return (user.apiTokens || []).map(t => this.getSafeToken_(t));
  }

  /**
   * Deletes (revokes) an API token for a user.
   * @param {string} email User email address.
   * @param {string} tokenId Token ID.
   * @return {Promise<void>} Promise resolving when token is deleted.
   */
  async deleteApiToken(email, tokenId) {
    if (!email || !tokenId) {
      throw new Error('Email and token ID are required');
    }

    const user = this.users_.get(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.apiTokens) {
      throw new Error('Token not found');
    }

    const index = user.apiTokens.findIndex(t => t.id === tokenId);
    if (index === -1) {
      throw new Error('Token not found');
    }

    const [removed] = user.apiTokens.splice(index, 1);

    if (this.tokenIndex_ && removed && removed.token) {
      this.tokenIndex_.delete(removed.token);
    }

    if (typeof this.saveUsersToFile_ === 'function') {
      await this.saveUsersToFile_();
    }

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:api-token-deleted', { email, tokenId });
    }
  }

  /**
   * Validates a presented API token and returns the resolved identity. Roles
   * are resolved live from the owning user so that revoking a role or
   * deactivating an account immediately de-powers every token they issued.
   * Enforces expiry and active-account status, and records last-used.
   * @param {string} tokenValue The raw token value as presented by the caller.
   * @return {Promise<{email: string, roles: Array<string>, user: Object, token: Object}>}
   *     Resolves to the owner identity when the token is valid.
   * @throws {Error} When the token is missing, unknown, expired, or the owner is inactive.
   */
  async validateApiToken(tokenValue) {
    if (!tokenValue) {
      throw new Error('Token is required');
    }

    const hashedToken = crypto.createHash('sha256').update(tokenValue).digest('hex');

    if (!this.tokenIndexBuilt_) {
      this.buildTokenIndex_();
    }

    const entry = this.tokenIndex_.get(hashedToken);
    if (!entry) {
      throw new Error('Invalid API token');
    }

    const user = this.users_.get(entry.email);
    if (!user) {
      this.tokenIndex_.delete(hashedToken);
      throw new Error('Invalid API token');
    }

    const token = (user.apiTokens || []).find(t => t.id === entry.tokenId);
    if (!token) {
      this.tokenIndex_.delete(hashedToken);
      throw new Error('Invalid API token');
    }

    if (user.isActive === false) {
      throw new Error('User account is inactive');
    }

    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      throw new Error('API token expired');
    }

    token.lastUsed = new Date();
    this.persistTokenUsageThrottled_();

    const roles = Array.isArray(user.roles)
      ? user.roles
      : (user.role ? [user.role] : ['user']);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:api-token-used', { email: user.email, tokenId: token.id });
    }

    return {
      email: user.email,
      roles,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles,
        isActive: user.isActive !== false
      },
      token: this.getSafeToken_(token)
    };
  }

  /**
   * Requests an invitation for account creation.
   * @param {Object} data Invitation request data.
   * @param {string} data.name Full name.
   * @param {string} data.email Email address.
   * @param {string} data.mobile Mobile number (optional).
   * @return {Promise<Object>} Promise resolving to invitation object with code.
   */
  async requestInvitation(data) {
    const { name, email, mobile } = data;

    if (!name || !email) {
      throw new Error('Name and email are required');
    }

    if (!this.invitations_) {
      this.invitations_ = new Map();
    }

    const crypto = require('crypto');
    const code = 'INV-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    const now = new Date();
    const invitation = {
      code,
      name,
      email,
      mobile: mobile || null,
      // Auto-approved: invite codes are usable immediately on issue
      status: 'approved',
      createdAt: now,
      approvedAt: now,
      usedAt: null,
      expiresAt: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)) // 7 days
    };

    this.invitations_.set(code, invitation);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:invitation-requested', { email, code });
    }

    return { code, email, name, status: 'approved', expiresAt: invitation.expiresAt };
  }

  /**
   * Approves an invitation request.
   * @param {string} code Invitation code.
   * @return {Promise<Object>} Promise resolving to updated invitation.
   */
  async approveInvitation(code) {
    if (!code) {
      throw new Error('Invitation code is required');
    }

    if (!this.invitations_) {
      throw new Error('Invitation not found');
    }

    const invitation = this.invitations_.get(code);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Only pending invitations can be approved');
    }

    invitation.status = 'approved';
    invitation.approvedAt = new Date();
    invitation.expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:invitation-approved', { code, email: invitation.email });
    }

    return invitation;
  }

  /**
   * Redeems an invitation to create a new user account.
   * The new account's identity is the invited email and its full name is
   * taken from the invitation.
   * @param {string} code Invitation code.
   * @param {string} password Password for new account.
   * @return {Promise<Object>} Promise resolving to created user object.
   */
  async redeemInvitation(code, password) {
    if (!code || !password) {
      throw new Error('Invitation code and password are required');
    }

    if (!this.invitations_) {
      throw new Error('Invitation not found');
    }

    const invitation = this.invitations_.get(code);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status === 'used') {
      throw new Error('This invitation has already been used');
    }

    if (invitation.status !== 'approved') {
      throw new Error('Invitation has not been approved');
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Validate password strength
    const strength = await this.validatePasswordStrength(password);
    if (!strength.valid) {
      throw new Error('Password does not meet strength requirements: ' + strength.errors.join(', '));
    }

    // Create user from invitation. The email is the account identity and the
    // full name is carried over from the invitation.
    const user = await this.createUser({
      email: invitation.email,
      fullName: invitation.name,
      password: password,
      role: 'user'
    });

    // Mark invitation as used
    invitation.status = 'used';
    invitation.usedAt = new Date();

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:invitation-redeemed', { code, email: invitation.email });
    }

    return user;
  }

  /**
   * Batch creates invitations for multiple users.
   * Skips rows missing a name or email; collects per-row errors without aborting the batch.
   * @param {Array<{name: string, email: string}>} invites Array of invitee objects.
   * @return {Promise<{created: Array<Object>, errors: Array<{email: string, error: string}>}>}
   */
  async batchCreateInvitations(invites) {
    const created = [];
    const errors = [];

    for (const item of invites) {
      try {
        const invitation = await this.requestInvitation({ name: item.name, email: item.email });
        created.push(invitation);
      } catch (err) {
        errors.push({ email: item.email || '(missing)', error: err.message });
      }
    }

    return { created, errors };
  }

  /**
   * Recreates an invitation by generating a fresh code for the same invitee.
   * The old code is invalidated and a new 7-day expiry is set.
   * @param {string} oldCode Existing invitation code.
   * @return {Promise<Object>} Promise resolving to the new invitation object.
   */
  async recreateInvitation(oldCode) {
    if (!oldCode) {
      throw new Error('Invitation code is required');
    }

    if (!this.invitations_) {
      throw new Error('Invitation not found');
    }

    const existing = this.invitations_.get(oldCode);
    if (!existing) {
      throw new Error('Invitation not found');
    }

    if (existing.status === 'used') {
      throw new Error('Cannot recreate an invitation that has already been redeemed');
    }

    // Remove old code
    this.invitations_.delete(oldCode);

    const crypto = require('crypto');
    const newCode = 'INV-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const now = new Date();

    const invitation = {
      code: newCode,
      name: existing.name,
      email: existing.email,
      mobile: existing.mobile,
      status: 'approved',
      createdAt: now,
      approvedAt: now,
      usedAt: null,
      expiresAt: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000))
    };

    this.invitations_.set(newCode, invitation);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:invitation-recreated', { oldCode, newCode, email: invitation.email });
    }

    return { code: newCode, email: invitation.email, name: invitation.name, status: 'approved', expiresAt: invitation.expiresAt };
  }

  /**
   * Lists all invitations.
   * @return {Promise<Array<Object>>} Promise resolving to array of invitations.
   */
  async listInvitations() {
    if (!this.invitations_) {
      return [];
    }
    return Array.from(this.invitations_.values());
  }

  /**
   * Gets a specific invitation by code.
   * @param {string} code Invitation code.
   * @return {Promise<Object>} Promise resolving to invitation object.
   */
  async getInvitation(code) {
    if (!code) {
      throw new Error('Invitation code is required');
    }

    if (!this.invitations_) {
      throw new Error('Invitation not found');
    }

    const invitation = this.invitations_.get(code);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    return invitation;
  }

  /**
   * Creates a short-lived SSO session for email-based authentication.
   * @param {string} email User email address.
   * @param {number} ttlMinutes Time to live in minutes (default 5).
   * @return {Promise<Object>} Promise resolving to { token, expiresAt }.
   */
  async createSSOSession(email, ttlMinutes = 5) {
    if (!email) {
      throw new Error('Email is required');
    }

    const user = Array.from(this.users_.values()).find(u => u.email === email);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('User account is inactive');
    }

    if (!this.ssoSessions_) {
      this.ssoSessions_ = new Map();
    }

    const sessionToken = this.generateSessionToken_();
    const expiresAt = new Date(Date.now() + (ttlMinutes * 60 * 1000));

    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || 'user'];
    const session = {
      token: sessionToken,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: userRoles,
      createdAt: new Date(),
      expiresAt: expiresAt,
      isSSO: true
    };

    this.ssoSessions_.set(sessionToken, session);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:sso-session-created', { email });
    }

    return {
      token: sessionToken,
      expiresAt: expiresAt
    };
  }

  /**
   * Validates an SSO token (short-lived session).
   * @param {string} token SSO session token.
   * @return {Promise<Object>} Promise resolving to session object if valid.
   */
  async validateSSOToken(token) {
    if (!token) {
      throw new Error('Token is required');
    }

    if (!this.ssoSessions_) {
      throw new Error('Invalid SSO token');
    }

    const session = this.ssoSessions_.get(token);
    if (!session) {
      throw new Error('Invalid SSO token');
    }

    if (session.expiresAt < new Date()) {
      this.ssoSessions_.delete(token);
      throw new Error('SSO token expired');
    }

    return session;
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
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generates a cryptographically secure session token.
   * @return {string} Session token (256 bits of entropy, hex-encoded).
   * @private
   */
  generateSessionToken_() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hashes a password using bcrypt with a per-user salt.
   * @param {string} password Plain text password.
   * @return {Promise<string>} Promise resolving to the bcrypt hash.
   * @private
   */
  async hashPassword_(password) {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  /**
   * Verifies a password against a stored hash.
   * Supports transparent verification of legacy SHA-256 hashes so that
   * accounts created before the bcrypt migration can still authenticate;
   * callers should re-hash (see {@link AuthBase#needsRehash_}) on success.
   * @param {string} password Plain text password.
   * @param {string} hash Stored password hash.
   * @return {Promise<boolean>} Promise resolving to true if password is valid.
   * @private
   */
  async verifyPassword_(password, hash) {
    if (typeof hash !== 'string' || hash.length === 0) {
      return false;
    }

    // Modern bcrypt hashes are prefixed with $2a$/$2b$/$2y$.
    if (hash.startsWith('$2')) {
      return bcrypt.compare(password, hash);
    }

    // Legacy SHA-256 ("password" + static salt) hash — constant-time compare.
    const legacy = crypto.createHash('sha256').update(password + 'salt').digest('hex');
    const a = Buffer.from(legacy, 'utf8');
    const b = Buffer.from(hash, 'utf8');
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Determines whether a stored hash should be upgraded to bcrypt.
   * @param {string} hash Stored password hash.
   * @return {boolean} True if the hash is in a legacy (non-bcrypt) format.
   * @private
   */
  needsRehash_(hash) {
    return typeof hash !== 'string' || !hash.startsWith('$2');
  }

  /**
   * Validates password strength.
   * @param {string} password Password to validate.
   * @return {Promise<Object>} Promise resolving to { valid: boolean, errors: Array<string> }.
   */
  async validatePasswordStrength(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password must be a non-empty string');
      return { valid: false, errors };
    }

    if (password.length < 10) {
      errors.push('Password must be at least 10 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one digit');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generates a strong random password.
   * @return {string} A 16-character cryptographically secure random password.
   */
  generateStrongPassword() {
    const crypto = require('crypto');
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '!@#$%^&*()_+-=[]{};\'":\\|,.<>/?';

    const allChars = uppercase + lowercase + digits + special;
    let password = '';

    // Ensure at least one of each required type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining 12 characters randomly
    for (let i = 0; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }

    return passwordArray.join('');
  }

  /**
   * Adds user to role internal method.
   * @param {string} email User email address.
   * @param {string} role Role name.
   * @private
   */
  addUserToRole_(email, role) {
    if (!this.roles_.has(role)) {
      this.roles_.set(role, []);
    }
    const users = this.roles_.get(role);
    if (!users.includes(email)) {
      users.push(email);
    }
  }

  /**
   * Removes user from role internal method.
   * @param {string} email User email address.
   * @param {string} role Role name.
   * @private
   */
  removeUserFromRole_(email, role) {
    const users = this.roles_.get(role);
    if (users) {
      const index = users.indexOf(email);
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
        usernameField: 'email',
        passwordField: 'password'
      },
      async (email, password, done) => {
        try {
          const result = await this.authenticateUser(email, password);
          return done(null, result.user, { session: result.session });
        } catch (error) {
          // Return a generic failure message: the raw error can reveal
          // internal details or enable user enumeration (e.g. "user not
          // found" vs "wrong password"). The specific error stays server-side.
          return done(null, false, { message: 'Invalid credentials' });
        }
      }
    );

    return {
      strategy,
      serializeUser: (user, done) => {
        try {
          if (!user || !user.email) {
            return done(new Error('User object must have an email property'));
          }
          done(null, user.email);
        } catch (error) {
          done(error);
        }
      },
      deserializeUser: async (email, done) => {
        try {
          if (!email) {
            return done(new Error('Email is required for deserialization'));
          }
          const user = await this.getUser(email);
          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    };
  }
}

module.exports = AuthBase;
