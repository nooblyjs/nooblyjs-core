/**
 * @fileoverview Audit Logging Middleware
 * Express middleware for automatically recording all API operations for audit purposes.
 * Captures request/response details and records them to the audit log.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Creates audit logging middleware for Express applications.
 * Automatically records all HTTP operations to the audit log.
 *
 * @param {AuditLog} auditLog - Audit log instance to record entries
 * @param {Object} [options={}] - Middleware configuration options
 * @param {Array<string>} [options.excludePaths=[]] - Paths to exclude from auditing
 * @param {boolean} [options.captureBody=true] - Whether to capture request body
 * @param {boolean} [options.captureResponse=true] - Whether to capture response body
 * @return {Function} Express middleware function
 *
 * @example
 * const AuditLog = require('../modules/auditLog');
 * const createAuditMiddleware = require('../middleware/auditMiddleware');
 *
 * const auditLog = new AuditLog();
 * const auditMiddleware = createAuditMiddleware(auditLog, {
 *   excludePaths: ['/status', '/health']
 * });
 *
 * app.use(auditMiddleware);
 */
function createAuditMiddleware(auditLog, options = {}) {
  const {
    excludePaths = ['/status', '/health', '/ping'],
    captureBody = true,
    captureResponse = true
  } = options;

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const originalSend = res.send;
    let responseBody = null;
    let responseSent = false;

    // Intercept response
    res.send = function(data) {
      if (!responseSent) {
        responseSent = true;
        if (captureResponse) {
          try {
            if (typeof data === 'string') {
              responseBody = data.length < 1000 ? data : data.substring(0, 1000);
            } else if (typeof data === 'object') {
              responseBody = data;
            }
          } catch (err) {
            // Silently fail on response capture
          }
        }
      }
      return originalSend.call(this, data);
    };

    // Handle res.json() calls
    const originalJson = res.json;
    res.json = function(data) {
      if (!responseSent) {
        responseSent = true;
        if (captureResponse) {
          responseBody = data;
        }
      }
      return originalJson.call(this, data);
    };

    // Wait for response to finish
    res.on('finish', () => {
      recordAuditEntry(
        req, res, startTime, captureBody, responseBody, auditLog
      );
    });

    next();
  };
}

/**
 * Records an audit entry for the completed request.
 * @private
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {number} startTime - Request start time in milliseconds
 * @param {boolean} captureBody - Whether to include request body
 * @param {*} responseBody - Captured response body
 * @param {AuditLog} auditLog - Audit log instance
 * @return {void}
 */
function recordAuditEntry(req, res, startTime, captureBody, responseBody, auditLog) {
  try {
    const duration = Date.now() - startTime;

    // Determine operation type from HTTP method
    const operation = getOperationType(req.method);

    // Extract service and resource type from path
    const pathParts = req.path.split('/').filter(p => p);
    const service = pathParts[1] || 'unknown';
    const resourceType = pathParts[3] || 'unknown';
    const resourceId = pathParts[4] || req.params.id || null;

    // Get user info
    const userId = req.user?.id || req.session?.userId || 'anonymous';
    const apiKey = req.headers['x-api-key'] || null;

    // Get status and determine if successful
    const status = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
    const errorMessage = status === 'FAILURE'
      ? getErrorMessage(responseBody)
      : null;

    // Record the audit entry
    auditLog.record({
      operation,
      service,
      resourceType,
      resourceId,
      userId,
      apiKey,
      before: null, // Would need to be captured separately if needed
      after: captureBody ? captureBody(req, responseBody) : null,
      status,
      errorMessage,
      duration,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    });
  } catch (err) {
    // Silently fail to prevent middleware from breaking the response
  }
}

/**
 * Maps HTTP method to audit operation type.
 * @private
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @return {string} Audit operation type (CREATE, READ, UPDATE, DELETE)
 */
function getOperationType(method) {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    case 'GET':
    case 'HEAD':
    case 'OPTIONS':
    default:
      return 'READ';
  }
}

/**
 * Extracts error message from response body.
 * @private
 * @param {*} responseBody - Response body to extract error from
 * @return {string|null} Error message if found
 */
function getErrorMessage(responseBody) {
  if (!responseBody) {
    return null;
  }

  if (typeof responseBody === 'string') {
    return responseBody;
  }

  if (typeof responseBody === 'object') {
    if (responseBody.error && typeof responseBody.error === 'string') {
      return responseBody.error;
    }
    if (responseBody.error?.message) {
      return responseBody.error.message;
    }
    if (responseBody.message) {
      return responseBody.message;
    }
  }

  return null;
}

/**
 * Gets the client's IP address from the request.
 * @private
 * @param {express.Request} req - Express request object
 * @return {string} Client IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         req.connection?.remoteAddress ||
         'unknown';
}

/**
 * Creates a body capture function for audit logging.
 * Captures relevant data while excluding sensitive fields.
 * @param {express.Request} req - Express request object
 * @param {*} responseBody - Response body
 * @return {Object|null} Captured audit data
 */
function captureBody(req, responseBody) {
  const captured = {};

  // Capture request body (excluding sensitive fields)
  if (req.body) {
    captured.requestBody = {
      ...req.body
    };
    // Remove sensitive fields
    delete captured.requestBody.password;
    delete captured.requestBody.token;
    delete captured.requestBody.apiKey;
  }

  // Capture response body (excluding sensitive fields)
  if (responseBody && typeof responseBody === 'object') {
    captured.responseBody = { ...responseBody };
    if (captured.responseBody.data) {
      captured.responseBody.data = typeof responseBody.data === 'object'
        ? Object.keys(responseBody.data).slice(0, 10)
        : responseBody.data;
    }
  }

  return Object.keys(captured).length > 0 ? captured : null;
}

module.exports = createAuditMiddleware;
