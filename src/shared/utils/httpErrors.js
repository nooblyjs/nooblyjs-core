/**
 * @fileoverview Client-safe HTTP errors.
 *
 * A ClientError carries a 4xx status and a message that is safe to show the
 * caller (validation failure, blocked request, payload too large, …). Anything
 * else is treated as a server fault: routes report a generic message and keep
 * the details in the logs. This follows the convention already used by the
 * workflow and scheduling manager routes (`err.statusCode` < 500 ⇒ expose).
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

/** Message returned to clients for any server-side (5xx) failure. */
const GENERIC_SERVER_MESSAGE = 'Internal Server Error';

/**
 * Error whose status and message may be returned to the client.
 */
class ClientError extends Error {
  /**
   * @param {number} statusCode - HTTP status in the 4xx range
   * @param {string} message - Client-safe message
   * @param {Object} [details] - Optional extra fields (e.g. { code })
   */
  constructor(statusCode, message, details = {}) {
    super(message);
    this.name = 'ClientError';
    this.statusCode = statusCode;
    this.expose = true;
    Object.assign(this, details);
  }
}

/**
 * Returns true when the error is a client error whose message may be exposed.
 *
 * @param {*} err - Any thrown value
 * @return {boolean} Whether the error is client-safe
 */
function isClientError(err) {
  return Boolean(err && err.expose === true
    && Number.isInteger(err.statusCode)
    && err.statusCode >= 400 && err.statusCode < 500);
}

/**
 * Maps any error to the status and message a route should send.
 *
 * @param {*} err - Any thrown value
 * @param {number} [fallbackStatus=500] - Status for non-client errors
 * @return {{status: number, message: string}} Client-safe response parts
 *
 * @example
 * } catch (error) {
 *   const { status, message } = toClientResponse(error);
 *   res.status(status).json({ success: false, error: message });
 * }
 */
function toClientResponse(err, fallbackStatus = 500) {
  if (isClientError(err)) {
    return { status: err.statusCode, message: err.message };
  }
  return { status: fallbackStatus, message: GENERIC_SERVER_MESSAGE };
}

module.exports = { ClientError, isClientError, toClientResponse, GENERIC_SERVER_MESSAGE };
