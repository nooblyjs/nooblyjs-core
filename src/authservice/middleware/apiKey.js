'use strict';

/**
 * @fileoverview API Key Authentication Middleware
 * Provides secure API key validation for all NooblyJS service endpoints.
 *
 * @module authservice/middleware/apiKey
 */

/**
 * API Key Authentication Middleware
 *
 * Validates API keys supplied via headers or query parameters. Emits
 * auth events when an event emitter is provided through the service registry.
 *
 * @param {Object} [options] - Configuration options
 * @param {string[]} [options.apiKeys] - Array of valid API keys
 * @param {boolean} [options.requireApiKey=true] - Whether API key is required
 * @param {string[]} [options.excludePaths] - Paths to exclude from API key validation
 * @param {Object} [eventEmitter] - Event emitter for logging
 * @returns {Function} Express middleware function
 */
function createApiKeyAuthMiddleware(options = {}, eventEmitter = null) {
  const {
    apiKeys = [],
    requireApiKey = true,
    excludePaths = ['/services/*/status', '/services/', '/services/*/views/*']
  } = options;

  return (req, res, next) => {
    if (!requireApiKey) {
      return next();
    }

    const shouldExclude = excludePaths.some(pattern => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(req.path);
    });

    if (shouldExclude) {
      return next();
    }

    let apiKey = req.headers['x-api-key']
      || req.headers['api-key'];

    if (!apiKey && req.headers.authorization) {
      const authHeader = req.headers.authorization;

      if (authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }

      if (authHeader.startsWith('ApiKey ')) {
        apiKey = authHeader.substring(7);
      }
    }

    if (!apiKey) {
      apiKey = req.query.api_key;
    }

    if (!apiKey) {
      if (eventEmitter) {
        eventEmitter.emit('api-auth-failure', {
          reason: 'missing-api-key',
          ip: req.ip,
          path: req.path,
          method: req.method
        });
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key is required. Provide it via x-api-key header, Authorization header, or api_key query parameter.',
        code: 'MISSING_API_KEY'
      });
    }

    if (!apiKeys.includes(apiKey)) {
      if (eventEmitter) {
        eventEmitter.emit('api-auth-failure', {
          reason: 'invalid-api-key',
          ip: req.ip,
          path: req.path,
          method: req.method,
          providedKey: apiKey.substring(0, 8) + '...'
        });
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key provided.',
        code: 'INVALID_API_KEY'
      });
    }

    if (eventEmitter) {
      eventEmitter.emit('api-auth-success', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        keyPrefix: apiKey.substring(0, 8) + '...'
      });
    }

    req.apiKey = apiKey;

    next();
  };
}

/**
 * Generate a secure API key
 * @param {number} [length=32] - Length of the API key
 * @returns {string} Generated API key
 */
function generateApiKey(length = 32) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let apiKey = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    apiKey += charset[randomIndex];
  }

  return apiKey;
}

/**
 * Validate API key format
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} Whether the API key format is valid
 */
function isValidApiKeyFormat(apiKey) {
  if (typeof apiKey !== 'string') {
    return false;
  }

  return /^[A-Za-z0-9]{16,}$/.test(apiKey);
}

module.exports = {
  createApiKeyAuthMiddleware,
  generateApiKey,
  isValidApiKeyFormat
};
