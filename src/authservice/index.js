/**
 * @fileoverview Authentication Service Factory
 * Factory module for creating authentication service instances with multiple provider support.
 * Supports passport local strategy and Google OAuth with user management and role-based access.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const AuthPassport = require('./providers/authPassport');
const AuthGoogle = require('./providers/authGoogle');
const AuthMemory = require('./providers/authMemory');
const AuthFile = require('./providers/authFile');
const AuthApi = require('./providers/authApi');

const Routes = require('./routes');
const Views = require('./views');
const AuthAnalytics = require('./modules/analytics');
const middleware = require('./middleware');

/**
 * Creates a helper that curries the passport configuration with the provided
 * strategy configuration or factory. This is useful when consumers want a
 * composable interface instead of pulling middleware directly.
 *
 * @param {(Function|Object)} strategyFactoryOrConfig Strategy factory or config object
 * @returns {{configurePassport: function(Object=): Object}} Configurator wrapper
 */
function passportConfigurator(strategyFactoryOrConfig) {
  return {
    configurePassport(passportInstance) {
      return middleware.configurePassport(strategyFactoryOrConfig, passportInstance);
    }
  };
}

/**
 * Creates an authentication service instance with the specified provider.
 * Automatically configures routes and views for the auth service.
 * @param {string} type - The auth provider type ('passport', 'google', 'memory', 'file', 'api')
 * @param {Object} options - Provider-specific configuration options
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {AuthPassport|AuthGoogle|AuthMemory|AuthFile|AuthApi} Auth service instance with specified provider
 * @throws {Error} When unsupported auth type is provided
 */
function createAuth(type, options, eventEmitter) {
  let auth;
  const analytics = new AuthAnalytics(eventEmitter);

  // Create auth instance based on provider type
  switch (type) {
    case 'passport':
      auth = new AuthPassport(options, eventEmitter);
      break;
    case 'google':
      auth = new AuthGoogle(options, eventEmitter);
      break;
    case 'file':
      auth = new AuthFile(options, eventEmitter);
      break;
    case 'api':
      auth = new AuthApi(options, eventEmitter);
      break;
    case 'memory':
    default:
      auth = new AuthMemory(options, eventEmitter);
      break;
  }

  // Initialize routes and views for the auth service
  Routes(options, eventEmitter, auth, analytics);
  Views(options, eventEmitter, auth);

  // Attach passport configurator helper directly on the auth instance for convenience
  auth.passportConfigurator = function attachPassportConfigurator(customStrategyFactory) {
    const resolvedFactory =
      customStrategyFactory ||
      (typeof this.getAuthStrategy === 'function' ? this.getAuthStrategy : null);

    if (!resolvedFactory) {
      throw new Error('Passport configurator requested but no strategy factory available for this provider.');
    }

    return passportConfigurator(resolvedFactory);
  };

  return auth;
}

// Expose middleware helpers directly from authservice factory
createAuth.middleware = middleware;
createAuth.createApiKeyAuthMiddleware = middleware.createApiKeyAuthMiddleware;
createAuth.generateApiKey = middleware.generateApiKey;
createAuth.isValidApiKeyFormat = middleware.isValidApiKeyFormat;
createAuth.createServicesAuthMiddleware = middleware.createServicesAuthMiddleware;
createAuth.configurePassport = middleware.configurePassport;
createAuth.passportConfigurator = passportConfigurator;
createAuth.createAuthMiddleware = middleware.createAuthMiddleware;
createAuth.createAuthMiddlewareWithHandler = middleware.createAuthMiddlewareWithHandler;

module.exports = createAuth;
