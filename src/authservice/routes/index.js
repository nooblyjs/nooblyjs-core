/**
 * @fileoverview Authentication API routes for Express.js application.
 * Provides RESTful endpoints for user authentication, user management,
 * role management, and session handling.
 *
 * @author NooblyJS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Configures and registers authentication routes with the Express application.
 * Sets up endpoints for auth operations including login, logout, user management,
 * and role-based access control.
 *
 * @param {Object} options - Configuration options object
 * @param {Object} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for logging and notifications
 * @param {Object} auth - The authentication provider instance
 * @param {Object=} analytics - Analytics module instance for tracking auth activity
 * @return {void}
 */
module.exports = (options, eventEmitter, auth, analytics) => {
  if (options['express-app'] && auth) {
    const app = options['express-app'];
    const authMiddleware = options.authMiddleware;
    const requireAuthenticatedSession = createSessionAwareAuthGuard(auth, authMiddleware);

    // Helper function to handle async route errors
    const asyncHandler = (fn) => (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

    /**
     * POST /services/authservice/api/register
     * Creates a new user account.
     *
     * @param {express.Request} req - Express request object
     * @param {Object} req.body - User registration data
     * @param {string} req.body.username - Username
     * @param {string} req.body.email - Email address
     * @param {string} req.body.password - Password
     * @param {string} req.body.role - User role (optional, defaults to 'user')
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/authservice/api/register',
      authMiddleware || ((req, res, next) => next()),
      asyncHandler(async (req, res) => {
        const user = await auth.createUser(req.body);
        eventEmitter.emit('auth:user-registered', { username: user.username });
        res.status(201).json({
          success: true,
          message: 'User created successfully',
          data: user
        });
      })
    );

    /**
     * POST /services/authservice/api/login
     * Authenticates a user and creates a session.
     *
     * @param {express.Request} req - Express request object
     * @param {Object} req.body - Login credentials
     * @param {string} req.body.username - Username
     * @param {string} req.body.password - Password
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/authservice/api/login',
      asyncHandler(async (req, res) => {
        const { username, password } = req.body;
        const result = await auth.authenticateUser(username, password);
        eventEmitter.emit('auth:login-api', { username });
        res.status(200).json({
          success: true,
          message: 'Login successful',
          data: result
        });
      })
    );

    /**
     * POST /services/authservice/api/logout
     * Logs out a user by invalidating their session.
     *
     * @param {express.Request} req - Express request object
     * @param {Object} req.body - Logout data
     * @param {string} req.body.token - Session token
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/authservice/api/logout',
      asyncHandler(async (req, res) => {
        const { token } = req.body;
        await auth.logout(token);
        eventEmitter.emit('auth:logout-api', { token });
        res.status(200).json({
          success: true,
          message: 'Logout successful'
        });
      })
    );

    /**
     * POST /services/authservice/api/validate
     * Validates a session token.
     *
     * @param {express.Request} req - Express request object
     * @param {Object} req.body - Validation data
     * @param {string} req.body.token - Session token to validate
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/authservice/api/validate',
      asyncHandler(async (req, res) => {
        const { token } = req.body;

        try {
          const session = await auth.validateSession(token);
          res.status(200).json({
            success: true,
            message: 'Session valid',
            data: session
          });
        } catch (error) {
          // Return success: false for invalid/expired sessions
          res.status(200).json({
            success: false,
            message: error.message || 'Session invalid'
          });
        }
      })
    );

    /**
     * GET /services/authservice/api/users
     * Lists all users (admin only).
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/authservice/api/users',
      requireAuthenticatedSession,
      asyncHandler(async (req, res) => {
        const users = await auth.listUsers();
        res.status(200).json({
          success: true,
          data: users,
          total: users.length
        });
      })
    );

    /**
     * GET /services/authservice/api/users/:username
     * Gets a specific user by username.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.username - Username to retrieve
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/authservice/api/users/:username',
      requireAuthenticatedSession,
      asyncHandler(async (req, res) => {
        const user = await auth.getUser(req.params.username);
        res.status(200).json({
          success: true,
          data: user
        });
      })
    );

    /**
     * PUT /services/authservice/api/users/:username
     * Updates a user's information.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.username - Username to update
     * @param {Object} req.body - Update data
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.put(
      '/services/authservice/api/users/:username',
      requireAuthenticatedSession,
      asyncHandler(async (req, res) => {
        const user = await auth.updateUser(req.params.username, req.body);
        eventEmitter.emit('auth:user-updated-api', { username: req.params.username });
        res.status(200).json({
          success: true,
          message: 'User updated successfully',
          data: user
        });
      })
    );

    /**
     * DELETE /services/authservice/api/users/:username
     * Deletes a user account.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.username - Username to delete
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.delete(
      '/services/authservice/api/users/:username',
      requireAuthenticatedSession,
      asyncHandler(async (req, res) => {
        await auth.deleteUser(req.params.username);
        eventEmitter.emit('auth:user-deleted-api', { username: req.params.username });
        res.status(200).json({
          success: true,
          message: 'User deleted successfully'
        });
      })
    );

    /**
     * POST /services/authservice/api/users/:username/role
     * Assigns a role to a user.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.username - Username to assign role to
     * @param {Object} req.body - Role assignment data
     * @param {string} req.body.role - Role to assign
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post(
      '/services/authservice/api/users/:username/role',
      requireAuthenticatedSession,
      asyncHandler(async (req, res) => {
        const { role } = req.body;
        await auth.addUserToRole(req.params.username, role);
        eventEmitter.emit('auth:role-assigned-api', {
          username: req.params.username,
          role
        });
        res.status(200).json({
          success: true,
          message: 'Role assigned successfully'
        });
      })
    );

    /**
     * GET /services/authservice/api/roles
     * Lists all available roles.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/authservice/api/roles',
      requireAuthenticatedSession,
      asyncHandler(async (req, res) => {
        const roles = await auth.listRoles();
        res.status(200).json({
          success: true,
          data: roles,
          total: roles.length
        });
      })
    );

    /**
     * GET /services/authservice/api/roles/:role/users
     * Gets all users in a specific role.
     *
     * @param {express.Request} req - Express request object
     * @param {string} req.params.role - Role name
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get(
      '/services/authservice/api/roles/:role/users',
      requireAuthenticatedSession,
      asyncHandler(async (req, res) => {
        const users = await auth.getUsersInRole(req.params.role);
        res.status(200).json({
          success: true,
          data: users,
          total: users.length
        });
      })
    );

    /**
     * GET /services/authservice/api/status
     * Returns the operational status of the authentication service.
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/authservice/api/status', asyncHandler(async (req, res) => {
      const status = await auth.getStatus();
      eventEmitter.emit('api-auth-status', 'auth api running');
      res.status(200).json({
        success: true,
        data: status
      });
    }));

    // Passport-specific routes (if available)
    if (auth.authenticateWithPassport) {
      /**
       * POST /services/authservice/api/passport/login
       * Authenticates using passport local strategy.
       */
      app.post(
        '/services/authservice/api/passport/login',
        asyncHandler(async (req, res, next) => {
          const result = await auth.authenticateWithPassport(req, res, next);
          res.status(200).json({
            success: true,
            message: 'Passport login successful',
            data: result
          });
        })
      );
    }

    // Google OAuth routes (if available)
    if (auth.initiateGoogleAuth) {
      /**
       * GET /services/authservice/api/google
       * Initiates Google OAuth flow.
       */
      app.get('/services/authservice/api/google', (req, res, next) => {
        auth.initiateGoogleAuth(req, res, next);
      });

      /**
       * GET /services/authservice/api/google/callback
       * Handles Google OAuth callback.
       */
      app.get(
        '/services/authservice/api/google/callback',
        asyncHandler(async (req, res, next) => {
          const result = await auth.handleGoogleCallback(req, res, next);
          res.status(200).json({
            success: true,
            message: 'Google login successful',
            data: result
          });
        })
      );
    }

    if (analytics) {
      app.get(
        '/services/authservice/api/analytics',
        requireAuthenticatedSession,
        asyncHandler(async (req, res) => {
          const limit = parseInt(req.query.limit, 10);
          const recentLimit = parseInt(req.query.recentLimit, 10);
          res.status(200).json({
            overview: analytics.getOverview(),
            topUsers: analytics.getTopUsers(Number.isNaN(limit) ? 10 : limit),
            topRecent: analytics.getTopByRecency(Number.isNaN(recentLimit) ? 100 : recentLimit)
          });
        })
      );
    }

    // Error handling middleware
    app.use('/services/authservice/api', (error, req, res, next) => {
      eventEmitter.emit('auth:api-error', {
        error: error.message,
        path: req.path
      });

      res.status(error.status || 400).json({
        success: false,
        error: error.message || 'Authentication error'
      });
    });

        /**
     * GET /services/authservice/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.get('/services/authservice/api/settings', (req, res) => {
      try {
        const settings = auth.getSettings().then((settings)=> res.status(200).json(settings));
      } catch (err) {
        console.log(err);
        res.status(500).json({
          error: 'Failed to retrieve settings',
          message: err.message
        });
      }
    });

     /**
     * POST /services/authservice/api/settings
     * Retrieves the settings
     *
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @return {void}
     */
    app.post('/services/authservice/api/settings', (req, res) => {
      const message = req.body;
      if (message) {
        auth
          .saveSettings(message)
          .then(() => res.status(200).send('OK'))
          .catch((err) => res.status(500).send(err.message));
      } else {
        res.status(400).send('Bad Request: Missing settings');
      }
    });
  }
};

/**
 * Creates middleware that accepts either a valid session token issued by the auth
 * provider or a valid API key via the existing auth middleware.
 *
 * @param {Object} authProvider - Auth provider instance
 * @param {Function} apiKeyMiddleware - Middleware enforcing API keys
 * @returns {Function} Express middleware
 */
function createSessionAwareAuthGuard(authProvider, apiKeyMiddleware) {
  return async (req, res, next) => {
    const token = extractAuthToken(req);

    if (token) {
      try {
        const session = await authProvider.validateSession(token);
        req.authToken = token;
        req.authSession = session;
        if (!req.user) {
          req.user = {
            id: session.userId,
            username: session.username,
            role: session.role
          };
        }
        return next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired session token',
          message: error.message || 'Session validation failed'
        });
      }
    }

    if (typeof apiKeyMiddleware === 'function') {
      return apiKeyMiddleware(req, res, next);
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Provide a valid session token or API key.'
    });
  };
}

/**
 * Extracts a session token from the incoming request.
 *
 * @param {import('express').Request} req - Express request
 * @returns {?string} Session token if present
 */
function extractAuthToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (typeof authHeader === 'string') {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      return bearerMatch[1].trim();
    }

    const tokenMatch = authHeader.match(/^Token\s+(.+)$/i);
    if (tokenMatch) {
      return tokenMatch[1].trim();
    }
  }

  if (typeof req.headers['x-auth-token'] === 'string') {
    return req.headers['x-auth-token'].trim();
  }

  if (req.query && typeof req.query.authToken === 'string') {
    return req.query.authToken;
  }

  if (req.body && typeof req.body === 'object' && typeof req.body.authToken === 'string') {
    return req.body.authToken;
  }

  if (req.session && typeof req.session.authToken === 'string') {
    return req.session.authToken;
  }

  return null;
}
