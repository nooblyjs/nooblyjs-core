/**
 * @fileoverview Unit tests for the authentication service factory functionality.
 *
 * This test suite covers the core authentication service operations including
 * initialization, provider selection, and user management for multiple auth
 * providers (Passport, Google OAuth, Memory).
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const createAuthService = require('../../../src/authservice');
const EventEmitter = require('events');

/**
 * Test suite for authentication service factory operations.
 *
 * Tests the service factory functionality, provider initialization,
 * and authentication flow for different auth providers.
 */
describe('Authentication Service Factory', () => {
  /** @type {EventEmitter} Mock event emitter for testing auth service events */
  let mockEventEmitter;
  /** @type {Object} Mock options for auth service configuration */
  let mockOptions;

  /**
   * Set up test environment before each test case.
   * Creates fresh event emitter and options.
   */
  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    jest.spyOn(mockEventEmitter, 'emit');

    mockOptions = {
      'express-app': {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn()
      },
      sessionSecret: 'test-secret',
      googleClientId: 'test-google-client-id',
      googleClientSecret: 'test-google-client-secret'
    };
  });

  /**
   * Test Passport authentication service provider initialization.
   *
   * Verifies that the Passport provider can be initialized properly
   * and provides the expected authentication interface.
   */
  it('should create Passport auth service', () => {
    const authService = createAuthService('passport', mockOptions, mockEventEmitter);

    expect(authService).toBeDefined();
    expect(typeof authService.authenticateUser).toBe('function');
    expect(typeof authService.createUser).toBe('function');
    expect(typeof authService.logout).toBe('function');
  });

  /**
   * Test Google OAuth authentication service provider initialization.
   *
   * Verifies that the Google provider can be initialized properly
   * and provides the expected OAuth authentication interface.
   */
  it('should create Google OAuth auth service', () => {
    const authService = createAuthService('google', mockOptions, mockEventEmitter);

    expect(authService).toBeDefined();
    expect(typeof authService.authenticateUser).toBe('function');
    expect(typeof authService.createUser).toBe('function');
    expect(typeof authService.logout).toBe('function');
  });

  /**
   * Test Memory authentication service provider initialization.
   *
   * Verifies that the Memory provider can be initialized properly
   * and provides the expected in-memory authentication interface.
   */
  it('should create Memory auth service', () => {
    const authService = createAuthService('memory', mockOptions, mockEventEmitter);

    expect(authService).toBeDefined();
    expect(typeof authService.authenticateUser).toBe('function');
    expect(typeof authService.createUser).toBe('function');
    expect(typeof authService.logout).toBe('function');
    expect(typeof authService.getUser).toBe('function');
    expect(typeof authService.listUsers).toBe('function');
    expect(typeof authService.deleteUser).toBe('function');
  });

  /**
   * Test default provider fallback.
   *
   * Verifies that unknown provider types default to the Memory provider
   * and that the service is still functional.
   */
  it('should default to memory provider for unknown types', () => {
    const authService = createAuthService('unknown', mockOptions, mockEventEmitter);

    expect(authService).toBeDefined();
    expect(typeof authService.authenticateUser).toBe('function');
    expect(typeof authService.createUser).toBe('function');
    expect(typeof authService.logout).toBe('function');
  });

  /**
   * Test authentication service with minimal options.
   *
   * Verifies that the auth service can be initialized with
   * minimal configuration options.
   */
  it('should create auth service with minimal options', () => {
    const minimalOptions = {
      'express-app': {
        use: jest.fn(),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn()
      }
    };

    const authService = createAuthService('memory', minimalOptions, mockEventEmitter);

    expect(authService).toBeDefined();
    expect(typeof authService.authenticateUser).toBe('function');
  });

  /**
   * Test Memory provider user management functionality.
   *
   * Verifies that the Memory provider correctly handles user
   * registration, authentication, and management operations.
   */
  it('should handle user registration and authentication in memory provider', async () => {
    const authService = createAuthService('memory', mockOptions, mockEventEmitter);

    // Test user registration
    const user = await authService.createUser({
      username: 'testuser',
      password: 'password123',
      email: 'test@example.com',
      name: 'Test User'
    });

    expect(user).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.email).toBe('test@example.com');
    // Test user authentication
    const authResult = await authService.authenticateUser('testuser', 'password123');
    expect(authResult).toBeDefined();
    expect(authResult.user).toBeDefined();
    expect(authResult.session).toBeDefined();
    expect(authResult.user.username).toBe('testuser');
    expect(authResult.session.token).toBeDefined();

    // Test invalid authentication - should throw error
    await expect(authService.authenticateUser('testuser', 'wrongpassword')).rejects.toThrow('Invalid credentials');

    // Test user retrieval
    const retrievedUser = await authService.getUser('testuser');
    expect(retrievedUser).toBeDefined();
    expect(retrievedUser.username).toBe('testuser');

    // Test getting all users
    const allUsers = await authService.listUsers();
    expect(Array.isArray(allUsers)).toBe(true);
    expect(allUsers.length).toBeGreaterThanOrEqual(1); // May include default users
    expect(allUsers.find(u => u.username === 'testuser')).toBeDefined();
  });

  /**
   * Test Memory provider user deletion functionality.
   *
   * Verifies that users can be properly deleted from the
   * memory provider and are no longer accessible.
   */
  it('should handle user deletion in memory provider', async () => {
    const authService = createAuthService('memory', mockOptions, mockEventEmitter);

    // Register a user
    await authService.createUser({
      username: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    });

    // Verify user exists
    let user = await authService.getUser('testuser');
    expect(user).toBeDefined();

    // Delete user
    await authService.deleteUser('testuser');

    // Verify user no longer exists - should throw error
    await expect(authService.getUser('testuser')).rejects.toThrow('User not found');

    // Verify user is removed from users list
    const allUsers = await authService.listUsers();
    expect(allUsers.find(u => u.username === 'testuser')).toBeUndefined();
  });

  /**
   * Test user logout functionality.
   *
   * Verifies that the logout functionality works correctly
   * across all auth providers.
   */
  it('should handle user logout', async () => {
    const authService = createAuthService('memory', mockOptions, mockEventEmitter);

    // Register and login a user
    await authService.createUser({
      username: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    });

    const authResult = await authService.authenticateUser('testuser', 'password123');
    expect(authResult).toBeDefined();
    expect(authResult.session).toBeDefined();
    expect(authResult.session.token).toBeDefined();

    // Test logout
    await authService.logout(authResult.session.token);
  });

  /**
   * Test error handling for duplicate user registration.
   *
   * Verifies that attempting to register a user that already exists
   * is handled appropriately by the memory provider.
   */
  it('should handle duplicate user registration gracefully', async () => {
    const authService = createAuthService('memory', mockOptions, mockEventEmitter);

    // Register first user
    const user1 = await authService.createUser({
      username: 'testuser',
      password: 'password123',
      email: 'test@example.com'
    });
    expect(user1).toBeDefined();

    // Attempt to register duplicate user - should throw error
    await expect(authService.createUser({
      username: 'testuser',
      password: 'password456',
      email: 'test2@example.com'
    })).rejects.toThrow('Username already exists');
  });
});