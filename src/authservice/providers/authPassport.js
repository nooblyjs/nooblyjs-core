/**
 * @fileoverview Passport Authentication Provider
 * Passport.js local strategy authentication provider.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const AuthBase = require('./authBase');

/**
 * Passport.js authentication provider.
 * Integrates with passport local strategy for authentication.
 * @class
 * @extends {AuthBase}
 */
class AuthPassport extends AuthBase {
  /**
   * Initializes the passport authentication provider.
   * @param {Object=} options Configuration options.
   * @param {Object} options.express-app Express app instance for passport setup.
   * @param {EventEmitter=} eventEmitter Optional event emitter for auth events.
   */
  constructor(options = {}, eventEmitter) {
    super(options, eventEmitter);

    this.passport_ = null;
    this.LocalStrategy_ = null;

    this.initializePassport_();

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:provider-initialized', {
        provider: 'passport',
        message: 'Passport auth provider initialized'
      });
    }
  }

  /**
   * Initializes passport with local strategy.
   * @private
   */
  initializePassport_() {
    try {
      this.passport_ = require('passport');
      this.LocalStrategy_ = require('passport-local').Strategy;

      // Configure local strategy
      this.passport_.use(new this.LocalStrategy_(
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
      ));

      // Serialize user for session
      this.passport_.serializeUser((user, done) => {
        done(null, user.username);
      });

      // Deserialize user from session
      this.passport_.deserializeUser(async (username, done) => {
        try {
          const user = await this.getUser(username);
          done(null, user);
        } catch (error) {
          done(error, null);
        }
      });

      // Initialize passport with express app if provided
      if (this.options_['express-app']) {
        const app = this.options_['express-app'];
        app.use(this.passport_.initialize());
        app.use(this.passport_.session());
      }

    } catch (error) {
      console.warn('Passport not available. Install passport and passport-local packages.');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:passport-unavailable', {
          message: 'Passport packages not installed',
          error: error.message
        });
      }
    }
  }

  /**
   * Authenticates using passport local strategy.
   * @param {Object} req Express request object.
   * @param {Object} res Express response object.
   * @param {Function} next Express next function.
   * @return {Promise<Object>} Promise resolving to authentication result.
   */
  async authenticateWithPassport(req, res, next) {
    if (!this.passport_) {
      throw new Error('Passport not available');
    }

    return new Promise((resolve, reject) => {
      this.passport_.authenticate('local', (err, user, info) => {
        if (err) {
          return reject(err);
        }
        if (!user) {
          return reject(new Error(info.message || 'Authentication failed'));
        }

        req.logIn(user, (err) => {
          if (err) {
            return reject(err);
          }
          resolve({ user, session: info.session });
        });
      })(req, res, next);
    });
  }

  /**
   * Middleware for protecting routes with passport.
   * @param {Object} req Express request object.
   * @param {Object} res Express response object.
   * @param {Function} next Express next function.
   */
  requireAuth(req, res, next) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  }

  /**
   * Middleware for role-based access control.
   * @param {string|Array<string>} roles Required roles.
   * @return {Function} Middleware function.
   */
  requireRole(roles) {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!requiredRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  /**
   * Gets passport instance.
   * @return {Object} Passport instance.
   */
  getPassport() {
    return this.passport_;
  }

  /**
   * Gets service status with passport-specific information.
   * @return {Promise<Object>} Promise resolving to status object.
   */
  async getStatus() {
    const baseStatus = await super.getStatus();
    return {
      ...baseStatus,
      provider: 'passport',
      passportAvailable: !!this.passport_,
      strategy: 'local'
    };
  }
}

module.exports = AuthPassport;