/**
 * @fileoverview Google OAuth Authentication Provider
 * Google OAuth authentication provider using passport-google-oauth20.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const AuthBase = require('./authBase');

/**
 * Google OAuth authentication provider.
 * Integrates with passport Google OAuth2 strategy for authentication.
 * @class
 * @extends {AuthBase}
 */
class AuthGoogle extends AuthBase {
  /**
   * Initializes the Google OAuth authentication provider.
   * @param {Object=} options Configuration options.
   * @param {string} options.clientID Google OAuth client ID.
   * @param {string} options.clientSecret Google OAuth client secret.
   * @param {string} options.callbackURL Callback URL for OAuth flow.
   * @param {Object} options.express-app Express app instance for passport setup.
   * @param {EventEmitter=} eventEmitter Optional event emitter for auth events.
   */
  constructor(options = {}, eventEmitter) {
    super(options, eventEmitter);

    this.passport_ = null;
    this.GoogleStrategy_ = null;
    this.clientID_ = options.clientID;
    this.clientSecret_ = options.clientSecret;
    this.callbackURL_ = options.callbackURL || '/auth/google/callback';

    this.initializePassport_();

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:provider-initialized', {
        provider: 'google',
        message: 'Google OAuth auth provider initialized'
      });
    }
  }

  /**
   * Initializes passport with Google OAuth strategy.
   * @private
   */
  initializePassport_() {
    try {
      this.passport_ = require('passport');
      this.GoogleStrategy_ = require('passport-google-oauth20').Strategy;

      if (!this.clientID_ || !this.clientSecret_) {
        console.warn('Google OAuth credentials not provided');
        if (this.eventEmitter_) {
          this.eventEmitter_.emit('auth:google-config-missing', {
            message: 'Google OAuth client ID and secret required'
          });
        }
        return;
      }

      // Configure Google OAuth strategy
      this.passport_.use(new this.GoogleStrategy_(
        {
          clientID: this.clientID_,
          clientSecret: this.clientSecret_,
          callbackURL: this.callbackURL_
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const result = await this.handleGoogleAuth_(profile, accessToken, refreshToken);
            return done(null, result.user, { session: result.session });
          } catch (error) {
            return done(error, null);
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
      console.warn('Google OAuth strategy not available. Install passport-google-oauth20 package.');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('auth:google-unavailable', {
          message: 'passport-google-oauth20 package not installed',
          error: error.message
        });
      }
    }
  }

  /**
   * Handles Google OAuth authentication result.
   * @param {Object} profile Google profile object.
   * @param {string} accessToken OAuth access token.
   * @param {string} refreshToken OAuth refresh token.
   * @return {Promise<Object>} Promise resolving to authentication result.
   * @private
   */
  async handleGoogleAuth_(profile, accessToken, refreshToken) {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const username = profile.id; // Use Google ID as username
    const displayName = profile.displayName || email;

    let user;
    try {
      // Try to get existing user
      user = await this.getUser(username);
    } catch (error) {
      // User doesn't exist, create new one
      user = await this.createUser({
        username,
        email,
        password: Math.random().toString(36), // Random password for OAuth users
        role: 'user'
      });
    }

    // Update user with Google-specific data
    await this.updateUser(username, {
      email,
      displayName,
      googleId: profile.id,
      accessToken,
      refreshToken,
      lastLogin: new Date()
    });

    // Create session
    const sessionToken = this.generateSessionToken_();
    const session = {
      token: sessionToken,
      userId: user.id,
      username: user.username,
      role: user.role,
      provider: 'google',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
    };

    this.sessions_.set(sessionToken, session);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('auth:google-login', {
        username,
        email,
        role: user.role
      });
    }

    return {
      user: this.getSafeUser_(user),
      session: { token: sessionToken, expiresAt: session.expiresAt }
    };
  }

  /**
   * Initiates Google OAuth flow.
   * @param {Object} req Express request object.
   * @param {Object} res Express response object.
   * @param {Function} next Express next function.
   */
  initiateGoogleAuth(req, res, next) {
    if (!this.passport_) {
      throw new Error('Google OAuth not available');
    }

    this.passport_.authenticate('google', {
      scope: ['profile', 'email']
    })(req, res, next);
  }

  /**
   * Handles Google OAuth callback.
   * @param {Object} req Express request object.
   * @param {Object} res Express response object.
   * @param {Function} next Express next function.
   * @return {Promise<Object>} Promise resolving to authentication result.
   */
  async handleGoogleCallback(req, res, next) {
    if (!this.passport_) {
      throw new Error('Google OAuth not available');
    }

    return new Promise((resolve, reject) => {
      this.passport_.authenticate('google', (err, user, info) => {
        if (err) {
          return reject(err);
        }
        if (!user) {
          return reject(new Error('Google authentication failed'));
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
   * Middleware for protecting routes with Google OAuth.
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
   * Gets service status with Google OAuth-specific information.
   * @return {Promise<Object>} Promise resolving to status object.
   */
  async getStatus() {
    const baseStatus = await super.getStatus();
    return {
      ...baseStatus,
      provider: 'google',
      passportAvailable: !!this.passport_,
      strategy: 'google-oauth20',
      configured: !!(this.clientID_ && this.clientSecret_)
    };
  }
}

module.exports = AuthGoogle;