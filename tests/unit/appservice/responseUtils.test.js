/**
 * Unit tests for responseUtils module
 * Tests all response envelope functions and error handling
 */

'use strict';

const responseUtils = require('../../../src/appservice/utils/responseUtils');

describe('Response Utils Module', () => {
  let mockRes;

  beforeEach(() => {
    // Mock Express response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  describe('sendSuccess()', () => {
    it('should send success response with data and default status 200', () => {
      const testData = { id: '123', name: 'Test' };

      responseUtils.sendSuccess(mockRes, testData);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testData,
          timestamp: expect.any(String)
        })
      );
    });

    it('should include message when provided', () => {
      const testData = { id: '123' };
      const message = 'Operation completed';

      responseUtils.sendSuccess(mockRes, testData, message);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testData,
          message,
          timestamp: expect.any(String)
        })
      );
    });

    it('should accept custom status code', () => {
      responseUtils.sendSuccess(mockRes, { data: 'test' }, 'Created', 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('should return timestamp in ISO-8601 format', () => {
      responseUtils.sendSuccess(mockRes, {});

      const call = mockRes.json.mock.calls[0][0];
      expect(call.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle various data types', () => {
      // Array
      responseUtils.sendSuccess(mockRes, [1, 2, 3]);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: [1, 2, 3] })
      );

      // String
      mockRes.json.mockClear();
      responseUtils.sendSuccess(mockRes, 'test string');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: 'test string' })
      );

      // Number
      mockRes.json.mockClear();
      responseUtils.sendSuccess(mockRes, 42);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: 42 })
      );
    });
  });

  describe('sendError()', () => {
    it('should send error response with error code', () => {
      responseUtils.sendError(mockRes, responseUtils.ERROR_CODES.NOT_FOUND, 'Resource not found');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: responseUtils.ERROR_CODES.NOT_FOUND,
            message: 'Resource not found'
          },
          timestamp: expect.any(String)
        })
      );
    });

    it('should include details when provided', () => {
      const details = { resourceId: '123' };

      responseUtils.sendError(
        mockRes,
        responseUtils.ERROR_CODES.NOT_FOUND,
        'Item not found',
        details
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: responseUtils.ERROR_CODES.NOT_FOUND,
            message: 'Item not found',
            details
          })
        })
      );
    });

    it('should use mapped status code for error code', () => {
      const testCases = [
        [responseUtils.ERROR_CODES.VALIDATION_ERROR, 400],
        [responseUtils.ERROR_CODES.NOT_FOUND, 404],
        [responseUtils.ERROR_CODES.CONFLICT, 409],
        [responseUtils.ERROR_CODES.UNAUTHORIZED, 401],
        [responseUtils.ERROR_CODES.FORBIDDEN, 403],
        [responseUtils.ERROR_CODES.RATE_LIMITED, 429],
        [responseUtils.ERROR_CODES.SERVICE_UNAVAILABLE, 503],
        [responseUtils.ERROR_CODES.TIMEOUT, 504]
      ];

      testCases.forEach(([code, expectedStatus]) => {
        mockRes.status.mockClear();
        responseUtils.sendError(mockRes, code, 'Error message');
        expect(mockRes.status).toHaveBeenCalledWith(expectedStatus);
      });
    });

    it('should allow custom status code override', () => {
      responseUtils.sendError(
        mockRes,
        responseUtils.ERROR_CODES.NOT_FOUND,
        'Custom error',
        undefined,
        418 // I'm a teapot
      );

      expect(mockRes.status).toHaveBeenCalledWith(418);
    });

    it('should default to 500 for unknown error code', () => {
      responseUtils.sendError(mockRes, 'UNKNOWN_CODE', 'Unknown error');

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('sendList()', () => {
    it('should send paginated list response', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const pagination = { page: 1, pageSize: 50, total: 150 };

      responseUtils.sendList(mockRes, items, pagination);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: items,
          pagination: expect.objectContaining({
            page: 1,
            pageSize: 50,
            total: 150
          }),
          timestamp: expect.any(String)
        })
      );
    });

    it('should calculate totalPages', () => {
      const pagination = { page: 1, pageSize: 50, total: 150 };

      responseUtils.sendList(mockRes, [], pagination);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.pagination.totalPages).toBe(3);
    });

    it('should use provided totalPages if supplied', () => {
      const pagination = { page: 1, pageSize: 50, total: 150, totalPages: 4 };

      responseUtils.sendList(mockRes, [], pagination);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.pagination.totalPages).toBe(4);
    });

    it('should include optional message', () => {
      responseUtils.sendList(mockRes, [], { page: 1, pageSize: 10, total: 0 }, 'No items found');

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No items found'
        })
      );
    });

    it('should accept custom status code', () => {
      responseUtils.sendList(
        mockRes,
        [],
        { page: 1, pageSize: 10, total: 0 },
        undefined,
        206
      );

      expect(mockRes.status).toHaveBeenCalledWith(206);
    });
  });

  describe('sendStatus()', () => {
    it('should send status response', () => {
      responseUtils.sendStatus(mockRes, 'service api running');

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'service api running',
          timestamp: expect.any(String)
        })
      );
    });

    it('should include metadata when provided', () => {
      const meta = { provider: 'memory', instanceCount: 1 };

      responseUtils.sendStatus(mockRes, 'running', meta);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: 'running',
          meta
        })
      );
    });

    it('should accept custom status code', () => {
      responseUtils.sendStatus(mockRes, 'running', {}, 503);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it('should not include meta if not provided', () => {
      responseUtils.sendStatus(mockRes, 'running');

      const response = mockRes.json.mock.calls[0][0];
      expect(response).not.toHaveProperty('meta');
    });
  });

  describe('handleError()', () => {
    it('should handle generic Error', () => {
      const err = new Error('Something went wrong');

      responseUtils.handleError(mockRes, err);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: responseUtils.ERROR_CODES.INTERNAL_ERROR,
            message: 'Something went wrong'
          })
        })
      );
    });

    it('should map ENOTFOUND to NOT_FOUND', () => {
      const err = new Error('ENOTFOUND');
      err.code = 'ENOTFOUND';

      responseUtils.handleError(mockRes, err);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: responseUtils.ERROR_CODES.NOT_FOUND
          })
        })
      );
    });

    it('should map ENOENT to NOT_FOUND', () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';

      responseUtils.handleError(mockRes, err);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should map EACCES to FORBIDDEN', () => {
      const err = new Error('Access denied');
      err.code = 'EACCES';

      responseUtils.handleError(mockRes, err);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: responseUtils.ERROR_CODES.FORBIDDEN
          })
        })
      );
    });

    it('should detect validation errors from message', () => {
      const err = new Error('Validation failed: email is required');

      responseUtils.handleError(mockRes, err);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: responseUtils.ERROR_CODES.VALIDATION_ERROR
          })
        })
      );
    });

    it('should detect not found errors from message', () => {
      const err = new Error('User not found');

      responseUtils.handleError(mockRes, err);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: responseUtils.ERROR_CODES.NOT_FOUND
          })
        })
      );
    });

    it('should detect conflict errors from message', () => {
      const err = new Error('User already exists');

      responseUtils.handleError(mockRes, err);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: responseUtils.ERROR_CODES.CONFLICT
          })
        })
      );
    });

    it('should include context when provided', () => {
      const err = new Error('Operation failed');

      responseUtils.handleError(mockRes, err, 'User service initialization');

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { context: 'User service initialization' }
          })
        })
      );
    });

    it('should map statusCode property on error', () => {
      const err = new Error('Unauthorized');
      err.statusCode = 401;

      responseUtils.handleError(mockRes, err);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: responseUtils.ERROR_CODES.UNAUTHORIZED
          })
        })
      );
    });
  });

  describe('ERROR_CODES constant', () => {
    it('should be frozen (immutable)', () => {
      expect(() => {
        responseUtils.ERROR_CODES.NEW_CODE = 'NEW_VALUE';
      }).toThrow();
    });

    it('should contain all expected error codes', () => {
      const expectedCodes = [
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'CONFLICT',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'RATE_LIMITED',
        'INTERNAL_ERROR',
        'SERVICE_UNAVAILABLE',
        'TIMEOUT',
        'INVALID_REQUEST',
        'RESOURCE_EXHAUSTED',
        'DUPLICATE_FOUND',
        'INVALID_STATE',
        'OPERATION_FAILED'
      ];

      expectedCodes.forEach(code => {
        expect(responseUtils.ERROR_CODES).toHaveProperty(code);
      });
    });
  });

  describe('ERROR_CODE_STATUS constant', () => {
    it('should be frozen (immutable)', () => {
      expect(() => {
        responseUtils.ERROR_CODE_STATUS.NEW_CODE = 999;
      }).toThrow();
    });

    it('should map all error codes to appropriate HTTP status codes', () => {
      const expected = {
        VALIDATION_ERROR: 400,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        RATE_LIMITED: 429,
        INTERNAL_ERROR: 500,
        SERVICE_UNAVAILABLE: 503,
        TIMEOUT: 504
      };

      Object.entries(expected).forEach(([code, status]) => {
        expect(responseUtils.ERROR_CODE_STATUS[code]).toBe(status);
      });
    });
  });

  describe('getTimestamp()', () => {
    it('should return ISO-8601 formatted timestamp', () => {
      const timestamp = responseUtils.getTimestamp();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return valid timestamp that can be parsed', () => {
      const timestamp = responseUtils.getTimestamp();
      const date = new Date(timestamp);

      expect(date instanceof Date).toBe(true);
      expect(isNaN(date.getTime())).toBe(false);
    });
  });

  describe('errorHandler middleware', () => {
    let mockReq;
    let nextFn;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        path: '/services/test/api/status'
      };
      nextFn = jest.fn();
    });

    it('should handle errors passed to middleware', () => {
      const err = new Error('Database connection failed');

      responseUtils.errorHandler(err, mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Database connection failed'
          })
        })
      );
    });

    it('should include request context in error details', () => {
      const err = new Error('Request failed');

      responseUtils.errorHandler(err, mockReq, mockRes, nextFn);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.details.context).toContain('GET');
      expect(response.error.details.context).toContain('/services/test/api/status');
    });
  });
});
