/**
 * @fileoverview Standardized response utility for all API endpoints
 * Provides consistent response envelopes across all services.
 *
 * @author Noobly JS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Standardized error codes used across all services
 * @type {Object<string, string>}
 */
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
  DUPLICATE_FOUND: 'DUPLICATE_FOUND',
  INVALID_STATE: 'INVALID_STATE',
  OPERATION_FAILED: 'OPERATION_FAILED'
});

/**
 * Map error codes to HTTP status codes
 * @type {Object<string, number>}
 */
const ERROR_CODE_STATUS = Object.freeze({
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
  INVALID_REQUEST: 400,
  RESOURCE_EXHAUSTED: 429,
  DUPLICATE_FOUND: 409,
  INVALID_STATE: 422,
  OPERATION_FAILED: 500
});

/**
 * Gets current ISO-8601 timestamp
 * @return {string} ISO-8601 formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Sends a success response with standardized envelope
 * @param {Object} res - Express response object
 * @param {*} data - Response data (can be any JSON-serializable value)
 * @param {string} [message] - Optional success message
 * @param {number} [statusCode=200] - HTTP status code
 * @return {void}
 *
 * @example
 * sendSuccess(res, { id: '123', name: 'Alice' }, 'User retrieved');
 * // Responds with: { success: true, data: {...}, message: "...", timestamp: "..." }
 */
function sendSuccess(res, data, message, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    data,
    ...(message && { message }),
    timestamp: getTimestamp()
  });
}

/**
 * Sends an error response with standardized envelope and error code
 * @param {Object} res - Express response object
 * @param {string} code - Error code (from ERROR_CODES)
 * @param {string} message - Human-readable error message
 * @param {Object} [details] - Optional error details/context
 * @param {number} [statusCode] - HTTP status code (defaults based on error code)
 * @return {void}
 *
 * @example
 * sendError(res, ERROR_CODES.NOT_FOUND, 'User not found', { userId: '123' });
 * // Responds with 404: { success: false, error: { code, message, details }, timestamp }
 */
function sendError(res, code, message, details, statusCode) {
  const status = statusCode || ERROR_CODE_STATUS[code] || 500;
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details })
    },
    timestamp: getTimestamp()
  });
}

/**
 * Sends a paginated list response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination metadata
 * @param {number} pagination.page - Current page (1-indexed)
 * @param {number} pagination.pageSize - Items per page
 * @param {number} pagination.total - Total items across all pages
 * @param {number} [pagination.totalPages] - Total pages (auto-calculated if omitted)
 * @param {string} [message] - Optional message
 * @param {number} [statusCode=200] - HTTP status code
 * @return {void}
 *
 * @example
 * sendList(res, [item1, item2], { page: 1, pageSize: 50, total: 150 });
 * // Responds with: { success: true, data: [...], pagination: {...}, timestamp }
 */
function sendList(res, data, pagination, message, statusCode = 200) {
  const totalPages = pagination.totalPages || Math.ceil(pagination.total / pagination.pageSize);

  res.status(statusCode).json({
    success: true,
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages
    },
    ...(message && { message }),
    timestamp: getTimestamp()
  });
}

/**
 * Sends a status endpoint response
 * @param {Object} res - Express response object
 * @param {string} status - Status message (e.g., "service api running")
 * @param {Object} [meta] - Optional metadata (provider type, enabled, etc.)
 * @param {number} [statusCode=200] - HTTP status code
 * @return {void}
 *
 * @example
 * sendStatus(res, 'caching api running', { provider: 'memory', instanceCount: 3 });
 * // Responds with: { success: true, status: "...", meta: {...}, timestamp }
 */
function sendStatus(res, status, meta, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    status,
    ...(meta && { meta }),
    timestamp: getTimestamp()
  });
}

/**
 * Handles an unexpected error and sends standardized error response
 * Maps Node.js error types to appropriate error codes
 * @param {Object} res - Express response object
 * @param {Error} err - The error that occurred
 * @param {string} [context] - Optional context string for debugging
 * @return {void}
 *
 * @example
 * try {
 *   await service.operation();
 * } catch (err) {
 *   handleError(res, err, 'Failed to perform operation');
 * }
 */
function handleError(res, err, context) {
  let code = ERROR_CODES.INTERNAL_ERROR;
  let message = err.message || 'An unexpected error occurred';
  let statusCode = 500;

  // Determine error code based on error type or message
  if (err.code === 'ENOTFOUND' || err.code === 'ENOENT') {
    code = ERROR_CODES.NOT_FOUND;
    statusCode = 404;
  } else if (err.code === 'EACCES') {
    code = ERROR_CODES.FORBIDDEN;
    statusCode = 403;
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    if (err.statusCode === 401) code = ERROR_CODES.UNAUTHORIZED;
    if (err.statusCode === 403) code = ERROR_CODES.FORBIDDEN;
    if (err.statusCode === 404) code = ERROR_CODES.NOT_FOUND;
    if (err.statusCode === 409) code = ERROR_CODES.CONFLICT;
    if (err.statusCode === 429) code = ERROR_CODES.RATE_LIMITED;
    if (err.statusCode === 503) code = ERROR_CODES.SERVICE_UNAVAILABLE;
  } else if (message.includes('validation') || message.includes('required')) {
    code = ERROR_CODES.VALIDATION_ERROR;
    statusCode = 400;
  } else if (message.includes('not found') || message.includes('does not exist')) {
    code = ERROR_CODES.NOT_FOUND;
    statusCode = 404;
  } else if (message.includes('already exists') || message.includes('duplicate')) {
    code = ERROR_CODES.CONFLICT;
    statusCode = 409;
  }

  sendError(res, code, message, context ? { context } : undefined, statusCode);
}

/**
 * Express middleware for catching unhandled errors
 * @param {Error} err - The error
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 * @return {void}
 *
 * @example
 * app.use(errorHandler);
 */
function errorHandler(err, req, res, next) {
  handleError(res, err, `${req.method} ${req.path}`);
}

module.exports = {
  ERROR_CODES,
  ERROR_CODE_STATUS,
  sendSuccess,
  sendError,
  sendList,
  sendStatus,
  handleError,
  errorHandler,
  getTimestamp
};
