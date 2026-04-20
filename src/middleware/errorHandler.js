/**
 * @fileoverview Global Express Error Handler
 * Centralizes error logging, monitoring, and response formatting.
 * Prevents sensitive information leakage in production.
 *
 * @author Digital Technologies Team
 * @version 1.0.1
 */

'use strict';

/**
 * HTTP status codes for common error scenarios
 */
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/**
 * Determines appropriate HTTP status code based on error type
 *
 * @param {Error} error - The error object
 * @return {number} HTTP status code
 *
 * @private
 */
function getStatusCode(error) {
  // Explicit status code set on error object
  if (error.status && typeof error.status === 'number') {
    return error.status;
  }

  if (error.statusCode && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  // Circuit breaker open - service unavailable
  if (error.message === 'CIRCUIT_BREAKER_OPEN') {
    return HTTP_STATUS.SERVICE_UNAVAILABLE;
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return HTTP_STATUS.UNPROCESSABLE_ENTITY;
  }

  // Authentication/Authorization errors
  if (error.name === 'UnauthorizedError' || error.code === 'UNAUTHORIZED') {
    return HTTP_STATUS.UNAUTHORIZED;
  }

  if (error.name === 'ForbiddenError' || error.code === 'FORBIDDEN') {
    return HTTP_STATUS.FORBIDDEN;
  }

  // Database connection errors
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connection')) {
    return HTTP_STATUS.SERVICE_UNAVAILABLE;
  }

  // Timeout errors
  if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
    return HTTP_STATUS.GATEWAY_TIMEOUT;
  }

  // Default to internal server error
  return HTTP_STATUS.INTERNAL_SERVER_ERROR;
}

/**
 * Creates error response object with appropriate details
 * Hides sensitive information in production
 *
 * @param {Error} error - The error object
 * @param {string} requestId - Unique request identifier for tracking
 * @param {boolean} isProduction - Whether running in production
 * @return {Object} Sanitized error response
 *
 * @private
 */
function createErrorResponse(error, requestId, isProduction) {
  const errorResponse = {
    error: {
      message: isProduction ? getProductionMessage(error) : error.message,
      requestId // For error tracking and support requests
    }
  };

  // Include additional details in development
  if (!isProduction) {
    errorResponse.error.name = error.name;
    errorResponse.error.stack = error.stack;
    errorResponse.error.timestamp = new Date().toISOString();

    // Include error-specific debugging info
    if (error.details) {
      errorResponse.error.details = error.details;
    }

    if (error.code) {
      errorResponse.error.code = error.code;
    }
  }

  return errorResponse;
}

/**
 * Returns a safe error message for production environment
 * Prevents information disclosure while remaining helpful
 *
 * @param {Error} error - The error object
 * @return {string} Safe error message
 *
 * @private
 */
function getProductionMessage(error) {
  // Map of error patterns to safe messages
  const safeMessages = {
    'CIRCUIT_BREAKER_OPEN': 'Service temporarily unavailable. Please try again later.',
    'ECONNREFUSED': 'Service unavailable. Please try again later.',
    'timeout': 'Request timeout. Please try again.',
    'ETIMEDOUT': 'Connection timeout. Please try again.',
    'ECONNRESET': 'Connection reset. Please try again.',
    'database': 'Database service unavailable.',
    'permission': 'You do not have permission to access this resource.',
    'unauthorized': 'Authentication required.'
  };

  // Check if error message matches any pattern
  const errorMsg = error.message?.toLowerCase() || '';
  for (const [pattern, safeMsg] of Object.entries(safeMessages)) {
    if (errorMsg.includes(pattern.toLowerCase())) {
      return safeMsg;
    }
  }

  // Default safe message
  return 'An error occurred processing your request. Please contact support with the request ID.';
}

/**
 * Global error handler middleware
 * Should be added as the last middleware in Express app
 *
 * @param {Error} error - Express error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @example
 * app.use(errorHandler);
 */
module.exports = (error, req, res, next) => {
  // Generate unique request ID for error tracking
  const requestId = req.id || req.headers['x-request-id'] || generateRequestId();

  // Get logger instance
  const logger = req.app?.get('logger');
  const isProduction = process.env.NODE_ENV === 'production';

  // Determine HTTP status code
  const statusCode = getStatusCode(error);

  // Log error with structured metadata for debugging and monitoring
  const errorContext = {
    requestId,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: req.query,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    error: error.message,
    errorName: error.name,
    errorCode: error.code,
    timestamp: new Date().toISOString()
  };

  if (logger) {
    // Log to structured logger service
    if (statusCode >= 500) {
      // Server errors - log with full stack trace
      logger.error(`[${error.name}] ${error.message}`, {
        ...errorContext,
        stack: error.stack,
        details: error.details
      });
    } else if (statusCode >= 400) {
      // Client errors - log without stack trace
      logger.warn(`[${error.name}] ${error.message}`, {
        ...errorContext
      });
    } else {
      // Informational
      logger.info(`[${error.name}] ${error.message}`, {
        ...errorContext
      });
    }
  } else {
    // Fallback to console (shouldn't happen in production with logger service)
    const logLine = `[${error.name}] ${error.message} (${requestId})`;
    if (statusCode >= 500) {
      console.error(logLine, errorContext);
      console.error(error.stack);
    } else {
      console.warn(logLine, errorContext);
    }
  }

  // Create sanitized error response
  const errorResponse = createErrorResponse(error, requestId, isProduction);

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Generates a unique request ID for tracking
 *
 * @return {string} Unique request identifier
 *
 * @private
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
