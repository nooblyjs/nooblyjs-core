/**
 * @fileoverview Unit tests for the API-based auth service functionality.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.14
 */

'use strict';

const createAuthService = require('../../../src/authservice');
const EventEmitter = require('events');
const nock = require('nock');

describe('AuthService API Provider', () => {
  let authService;
  let mockEventEmitter;
  const apiRoot = 'http://backend.example.com';
  const apiKey = 'test-api-key-12345';

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    jest.spyOn(mockEventEmitter, 'emit');
    authService = createAuthService('api', {
      apiRoot,
      apiKey
    }, mockEventEmitter);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should register a user via API', async () => {
    const userData = {
      username: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    };
    const expectedResponse = { id: 'user-123', username: 'testuser' };

    nock(apiRoot)
      .post('/services/authservice/api/register', userData)
      .matchHeader('X-API-Key', apiKey)
      .reply(200, expectedResponse);

    const result = await authService.register(userData);

    expect(result).toEqual(expectedResponse);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('auth:register', {
      user: expectedResponse
    });
  });

  it('should login a user via API', async () => {
    const credentials = { username: 'testuser', password: 'password123' };
    const expectedResponse = {
      user: { id: 'user-123', username: 'testuser' },
      token: 'jwt-token-12345'
    };

    nock(apiRoot)
      .post('/services/authservice/api/login', credentials)
      .matchHeader('X-API-Key', apiKey)
      .reply(200, expectedResponse);

    const result = await authService.login(credentials);

    expect(result).toEqual(expectedResponse);
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('auth:login', {
      user: expectedResponse
    });
  });

  it('should validate a token via API', async () => {
    const token = 'jwt-token-12345';
    const expectedResponse = { valid: true, userId: 'user-123' };

    nock(apiRoot)
      .post('/services/authservice/api/validate', { token })
      .matchHeader('X-API-Key', apiKey)
      .reply(200, expectedResponse);

    const result = await authService.validateToken(token);

    expect(result).toEqual(expectedResponse);
  });

  it('should get user by ID via API', async () => {
    const userId = 'user-123';
    const expectedUser = { id: userId, username: 'testuser', email: 'test@example.com' };

    nock(apiRoot)
      .get(`/services/authservice/api/user/${userId}`)
      .matchHeader('X-API-Key', apiKey)
      .reply(200, expectedUser);

    const result = await authService.getUser(userId);

    expect(result).toEqual(expectedUser);
  });

  it('should update user via API', async () => {
    const userId = 'user-123';
    const updates = { email: 'newemail@example.com' };
    const expectedResponse = { id: userId, email: 'newemail@example.com' };

    nock(apiRoot)
      .put(`/services/authservice/api/user/${userId}`, updates)
      .matchHeader('X-API-Key', apiKey)
      .reply(200, expectedResponse);

    const result = await authService.updateUser(userId, updates);

    expect(result).toEqual(expectedResponse);
  });

  it('should delete user via API', async () => {
    const userId = 'user-123';

    nock(apiRoot)
      .delete(`/services/authservice/api/user/${userId}`)
      .matchHeader('X-API-Key', apiKey)
      .reply(200);

    await authService.deleteUser(userId);

    expect(mockEventEmitter.emit).toHaveBeenCalledWith('auth:delete', {
      userId
    });
  });

  it('should list all users via API', async () => {
    const expectedUsers = [
      { id: 'user-1', username: 'user1' },
      { id: 'user-2', username: 'user2' }
    ];

    nock(apiRoot)
      .get('/services/authservice/api/users')
      .matchHeader('X-API-Key', apiKey)
      .reply(200, expectedUsers);

    const result = await authService.listUsers();

    expect(result).toEqual(expectedUsers);
  });

  it('should handle authentication errors properly', async () => {
    const credentials = { username: 'wronguser', password: 'wrongpass' };

    nock(apiRoot)
      .post('/services/authservice/api/login', credentials)
      .matchHeader('X-API-Key', apiKey)
      .reply(401, 'Unauthorized');

    await expect(authService.login(credentials)).rejects.toThrow();

    expect(mockEventEmitter.emit).toHaveBeenCalledWith('auth:error',
      expect.objectContaining({
        operation: 'login'
      })
    );
  });
});
