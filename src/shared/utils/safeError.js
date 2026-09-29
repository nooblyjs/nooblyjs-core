/**
 * @fileoverview Safe error responder for HTTP route handlers.
 *
 * Prevents information exposure through error messages (CWE-209): raw
 * `err.message` values often carry internal details — file-system paths, stack
 * frames, database driver text, upstream URLs — that must not reach API
 * consumers. This helper logs the full error server-side (via an optional event
 * emitter and/or logger) and sends only a generic, caller-safe message to the
 * client, preserving the intended HTTP status code.
 *
 * Usage in a route module (eventEmitter is passed to every route factory):
 *
 *   const { sendSafeError } = require('../../shared/utils/safeError');
 *   ...
 *   } catch (err) {
 *     return sendSafeError(res, err, {
 *       eventEmitter, operation: 'listUsers', clientMessage: 'Failed to list users'
 *     });
 *   }
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/** @const {string} Default message returned to clients on unexpected errors. */
const DEFAULT_CLIENT_MESSAGE = 'Internal Server Error';

/**
 * Logs an error server-side and sends a sanitized response to the client.
 *
 * The client never receives `err.message`; it receives `clientMessage` (a
 * fixed, non-sensitive string). The full error — including its message and
 * stack — is emitted on the event emitter and/or written to the logger so
 * operators retain full diagnostics.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {Error|*} err - The caught error (logged, never sent to the client).
 * @param {Object} [opts] - Options.
 * @param {number} [opts.status] - HTTP status to send. Defaults to
 *     `err.statusCode` when present and >= 400, otherwise 500.
 * @param {string} [opts.clientMessage] - Safe message for the client. Defaults
 *     to a generic "Internal Server Error".
 * @param {Object} [opts.eventEmitter] - Emits `error-response` with the full
 *     error details for server-side logging/monitoring.
 * @param {Object} [opts.logger] - Optional logger with an `error` method.
 * @param {string} [opts.operation] - Operation name for log context.
 * @param {('json'|'send')} [opts.format] - Response format. `json` (default)
 *     sends `{ error: clientMessage }`; `send` sends the plain string.
 * @return {import('express').Response} The response, for convenient `return`.
 */
function sendSafeError(res, err, opts = {}) {
  const {
    status,
    clientMessage = DEFAULT_CLIENT_MESSAGE,
    eventEmitter = null,
    logger = null,
    operation = undefined,
    format = 'json'
  } = opts;

  const resolvedStatus = Number.isInteger(status) && status >= 400
    ? status
    : (Number.isInteger(err && err.statusCode) && err.statusCode >= 400
      ? err.statusCode
      : 500);

  // Server-side diagnostics: retain the real error details out of band.
  const detail = {
    operation,
    status: resolvedStatus,
    error: err && err.message ? err.message : String(err),
    stack: err && err.stack
  };
  try {
    if (eventEmitter && typeof eventEmitter.emit === 'function') {
      eventEmitter.emit('error-response', detail);
    }
    if (logger && typeof logger.error === 'function') {
      logger.error(`[safeError] ${operation || 'request'} failed`, detail);
    }
  } catch (_loggingError) {
    // Never let logging failures mask the original response.
  }

  if (res.headersSent) {
    return res;
  }

  if (format === 'send') {
    return res.status(resolvedStatus).send(clientMessage);
  }
  return res.status(resolvedStatus).json({ error: clientMessage });
}

module.exports = { sendSafeError, DEFAULT_CLIENT_MESSAGE };
