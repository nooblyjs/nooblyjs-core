/**
 * @fileoverview Upload size and type enforcement for the filing API (P2-2).
 *
 * Uploads are limited by the provider's `maxFileSize` setting (falling back to
 * FILING_MAX_FILE_SIZE, then 10 MB) and, when `allowedTypes` is not '*', by an
 * allow-list of extensions and/or MIME types (e.g. ".pdf,.md,image/*").
 * Oversized uploads get 413, disallowed types 415.
 *
 * @author NooblyJS Team
 * @since 1.1.0
 */

'use strict';

const path = require('node:path');
const { Transform } = require('node:stream');
const multer = require('multer');
const { ClientError } = require('../../shared/utils/httpErrors');
const { sendSafeError } = require('../../shared/utils/safeError');

/** Default maximum upload size in bytes. */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowance for multipart boundaries and headers on top of the file itself. */
const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * Resolves the effective upload limits for a filing service instance.
 *
 * @param {Object} filingService - Filing service (wrapper exposing `.provider`) or provider
 * @return {{maxFileSize: number, allowedTypes: Array<string>}} Effective limits;
 *     an empty allowedTypes array means every type is allowed
 */
function resolveUploadLimits(filingService) {
  const settings = (filingService && (filingService.provider || filingService).settings) || {};
  const configured = Number(settings.maxFileSize);
  const envLimit = Number(process.env.FILING_MAX_FILE_SIZE);
  const maxFileSize = configured > 0 ? configured : (envLimit > 0 ? envLimit : DEFAULT_MAX_FILE_SIZE);

  const rawTypes = settings.allowedTypes === undefined ? '*' : settings.allowedTypes;
  const list = (Array.isArray(rawTypes) ? rawTypes : String(rawTypes).split(','))
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
  const allowedTypes = list.includes('*') ? [] : list;

  return { maxFileSize, allowedTypes };
}

/**
 * Checks a file name and optional MIME type against an allow-list.
 *
 * @param {Array<string>} allowedTypes - Extensions (".pdf"), MIME types
 *     ("application/pdf") or MIME wildcards ("image/*"); empty allows all
 * @param {string} fileName - File name or key
 * @param {string} [mimeType] - MIME type reported for the upload
 * @return {boolean} Whether the file is allowed
 */
function isTypeAllowed(allowedTypes, fileName, mimeType) {
  if (!allowedTypes.length) return true;
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  return allowedTypes.some((type) => {
    if (type.startsWith('.')) return ext === type;
    if (type.endsWith('/*')) return mime.startsWith(type.slice(0, -1));
    if (type.includes('/')) return mime === type;
    return ext === `.${type}`;
  });
}

/**
 * Formats a byte count for error messages.
 *
 * @param {number} bytes - Byte count
 * @return {string} Human-readable size
 */
function formatBytes(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/**
 * Builds the 413 error for an upload over the limit.
 *
 * @param {number} maxFileSize - Limit in bytes
 * @return {ClientError} Payload-too-large error
 */
function tooLarge(maxFileSize) {
  return new ClientError(413, `File exceeds the maximum upload size of ${formatBytes(maxFileSize)}`,
    { code: 'LIMIT_FILE_SIZE' });
}

/**
 * Creates Express middleware that parses a single multipart `file` field with
 * size and type limits enforced. Responds 413/415/400 itself on violation.
 *
 * @param {function(express.Request): Object} getFilingService - Resolves the
 *     filing service instance targeted by the request
 * @param {Object} [opts] - Options
 * @param {EventEmitter} [opts.eventEmitter] - For error-response events
 * @return {function(express.Request, express.Response, Function): void} Middleware
 *
 * @example
 * app.post('/services/filing/api/upload/*',
 *   createUploadMiddleware(() => filing, { eventEmitter }), handler);
 */
function createUploadMiddleware(getFilingService, { eventEmitter } = {}) {
  return (req, res, next) => {
    let limits;
    try {
      limits = resolveUploadLimits(getFilingService(req));
    } catch (err) {
      return sendSafeError(res, err, { status: 500, eventEmitter });
    }
    const { maxFileSize, allowedTypes } = limits;

    // Reject early from Content-Length so oversized bodies are never buffered.
    const declared = Number(req.headers['content-length']);
    if (declared > maxFileSize + MULTIPART_OVERHEAD) {
      return sendSafeError(res, tooLarge(maxFileSize), { eventEmitter });
    }

    const key = req.params && req.params[0];
    if (key && allowedTypes.length && path.extname(key) && !isTypeAllowed(allowedTypes, key)) {
      return sendSafeError(res, new ClientError(415, 'File type is not allowed'), { eventEmitter });
    }

    const parser = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxFileSize, files: 1, fields: 20, fieldSize: 1024 * 1024 },
      fileFilter: (fileReq, file, cb) => {
        if (isTypeAllowed(allowedTypes, file.originalname || key, file.mimetype)) return cb(null, true);
        return cb(new ClientError(415, 'File type is not allowed'));
      }
    }).single('file');

    return parser(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const clientErr = err.code === 'LIMIT_FILE_SIZE'
          ? tooLarge(maxFileSize)
          : new ClientError(400, `Invalid upload: ${err.message}`, { code: err.code });
        return sendSafeError(res, clientErr, { eventEmitter });
      }
      return sendSafeError(res, err, { status: 400, eventEmitter });
    });
  };
}

/**
 * Wraps a request stream so that it errors with 413 once more than
 * `maxFileSize` bytes have been read. Also rejects immediately when the
 * declared Content-Length is already too large.
 *
 * @param {import('stream').Readable & {headers?: Object}} source - Request stream
 * @param {number} maxFileSize - Limit in bytes
 * @return {import('stream').Readable} Size-limited stream
 * @throws {ClientError} 413 when Content-Length exceeds the limit
 */
function limitStream(source, maxFileSize) {
  const declared = Number(source.headers && source.headers['content-length']);
  if (declared > maxFileSize) throw tooLarge(maxFileSize);

  let received = 0;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      if (received > maxFileSize) {
        source.unpipe(limiter);
        source.resume();
        return callback(tooLarge(maxFileSize));
      }
      return callback(null, chunk);
    }
  });
  source.on('error', (err) => limiter.destroy(err));
  return source.pipe(limiter);
}

module.exports = {
  DEFAULT_MAX_FILE_SIZE,
  resolveUploadLimits,
  isTypeAllowed,
  createUploadMiddleware,
  limitStream
};
