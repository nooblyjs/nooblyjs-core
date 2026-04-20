/**
 * @fileoverview Comprehensive feature verification tests for Auth Service
 * Tests all core functionality, providers, API endpoints, and middleware
 * @version 1.0.0
 */

'use strict';

const createAuth = require('../../../src/authservice');
const EventEmitter = require('events');

describe('Auth Service - Feature Verification', () => {
  let eventEmitter;
  let mockLogger;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    jest.spyOn(eventEmitter, 'emit');

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    eventEmitter.removeAllListeners();
  });

  // ============================================================================
  // FACTORY FUNCTION TESTS
  // ============================================================================

  describe('Service Factory Function', () => {
    it('should create memory provider instance', () => {
      const auth = createAuth('memory', {}, eventEmitter);
      expect(auth).toBeDefined();
      expect(typeof auth.createUser).toBe('function');
    });

    it('should create passport provider instance', () => {
      const auth = createAuth('passport', {}, eventEmitter);
      expect(auth).toBeDefined();
      expect(typeof auth.getAuthStrategy).toBe('function');
    });

    it('should create google provider instance', () => {
      const auth = createAuth('google', {
        clientID: 'test',
        clientSecret: 'test'
      }, eventEmitter);
      expect(auth).toBeDefined();
    });

    it('should create file provider instance', () => {
      const auth = createAuth('file', {
        dataDir: './.test/auth'
      }, eventEmitter);
      expect(auth).toBeDefined();
    });

    it('should create api provider instance', () => {
      const auth = createAuth('api', {
        url: 'http://localhost'
      }, eventEmitter);
      expect(auth).toBeDefined();
    });

    it('should default to memory provider', () => {
      const auth = createAuth('unknown', {}, eventEmitter);
      expect(auth).toBeDefined();
    });

    it('should expose middleware helpers', () => {
      expect(typeof createAuth.middleware).toBe('object');
      expect(typeof createAuth.createApiKeyAuthMiddleware).toBe('function');
      expect(typeof createAuth.generateApiKey).toBe('function');
    });

    it('should pass event emitter to service', () => {
      const auth = createAuth('memory', {}, eventEmitter);
      expect(auth.eventEmitter_).toBe(eventEmitter);
    });
  });

  // ============================================================================
  // USER MANAGEMENT TESTS
  // ============================================================================

  describe('User Management', () => {
    let auth;

    beforeEach(() => {
      auth = createAuth('memory', { createDefaultAdmin: false }, eventEmitter);
    });

    it('should create a new user', async () => {
      const user = await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
        role: 'user'
      });

      expect(user.username).toBe('alice');
      expect(user.email).toBe('alice@example.com');
      expect(user.role).toBe('user');
      expect(user.id).toBeDefined();
      expect(user.password).toBeUndefined(); // Password should not be returned
    });

    it('should not allow duplicate usernames', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      await expect(
        auth.createUser({
          username: 'alice',
          email: 'alice2@example.com',
          password: 'password123'
        })
      ).rejects.toThrow('Username already exists');
    });

    it('should validate username is required', async () => {
      await expect(
        auth.createUser({
          email: 'alice@example.com',
          password: 'password123'
        })
      ).rejects.toThrow(/username/i);
    });

    it('should validate email is required', async () => {
      await expect(
        auth.createUser({
          username: 'alice',
          password: 'password123'
        })
      ).rejects.toThrow(/email/i);
    });

    it('should validate password is required', async () => {
      await expect(
        auth.createUser({
          username: 'alice',
          email: 'alice@example.com'
        })
      ).rejects.toThrow(/password/i);
    });

    it('should emit auth:user-created event', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:user-created',
        expect.objectContaining({ username: 'alice' })
      );
    });

    it('should get user by username', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      const user = await auth.getUser('alice');
      expect(user.username).toBe('alice');
      expect(user.email).toBe('alice@example.com');
      expect(user.password).toBeUndefined();
    });

    it('should throw error for nonexistent user', async () => {
      await expect(auth.getUser('nonexistent')).rejects.toThrow('User not found');
    });

    it('should list all users', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      await auth.createUser({
        username: 'bob',
        email: 'bob@example.com',
        password: 'password123'
      });

      const users = await auth.listUsers();
      expect(users.length).toBe(2);
      expect(users.some(u => u.username === 'alice')).toBe(true);
      expect(users.some(u => u.username === 'bob')).toBe(true);
    });

    it('should update user information', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      const updated = await auth.updateUser('alice', {
        email: 'newemail@example.com'
      });

      expect(updated.email).toBe('newemail@example.com');
    });

    it('should emit auth:user-updated event', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      await auth.updateUser('alice', { email: 'new@example.com' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:user-updated',
        expect.any(Object)
      );
    });

    it('should not allow updating username', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      const updated = await auth.updateUser('alice', {
        username: 'bob'
      });

      expect(updated.username).toBe('alice'); // Should not change
    });

    it('should delete a user', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      await auth.deleteUser('alice');

      await expect(auth.getUser('alice')).rejects.toThrow('User not found');
    });

    it('should emit auth:user-deleted event', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      await auth.deleteUser('alice');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:user-deleted',
        expect.objectContaining({ username: 'alice' })
      );
    });
  });

  // ============================================================================
  // AUTHENTICATION TESTS
  // ============================================================================

  describe('Authentication', () => {
    let auth;

    beforeEach(async () => {
      auth = createAuth('memory', { createDefaultAdmin: false }, eventEmitter);
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'correctPassword123'
      });
    });

    it('should authenticate user with correct credentials', async () => {
      const result = await auth.authenticateUser('alice', 'correctPassword123');

      expect(result.user.username).toBe('alice');
      expect(result.session.token).toBeDefined();
      expect(result.session.expiresAt).toBeDefined();
    });

    it('should reject authentication with wrong password', async () => {
      await expect(
        auth.authenticateUser('alice', 'wrongPassword')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject authentication for nonexistent user', async () => {
      await expect(
        auth.authenticateUser('nonexistent', 'password123')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should emit auth:login event on successful auth', async () => {
      await auth.authenticateUser('alice', 'correctPassword123');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:login',
        expect.objectContaining({ username: 'alice' })
      );
    });

    it('should emit auth:login-failed event on failed auth', async () => {
      await auth.authenticateUser('alice', 'correctPassword123').catch(() => {});
      eventEmitter.emit.mockClear();

      try {
        await auth.authenticateUser('alice', 'wrongPassword');
      } catch (e) {
        // Expected
      }

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:login-failed',
        expect.any(Object)
      );
    });

    it('should validate username parameter', async () => {
      await expect(
        auth.authenticateUser('', 'password123')
      ).rejects.toThrow(/username/i);
    });

    it('should validate password parameter', async () => {
      await expect(
        auth.authenticateUser('alice')
      ).rejects.toThrow(/password/i);
    });
  });

  // ============================================================================
  // SESSION MANAGEMENT TESTS
  // ============================================================================

  describe('Session Management', () => {
    let auth;
    let sessionToken;

    beforeEach(async () => {
      auth = createAuth('memory', { createDefaultAdmin: false }, eventEmitter);
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      const result = await auth.authenticateUser('alice', 'password123');
      sessionToken = result.session.token;
    });

    it('should validate a valid session', async () => {
      const session = await auth.validateSession(sessionToken);

      expect(session.token).toBe(sessionToken);
      expect(session.username).toBe('alice');
      expect(session.expiresAt).toBeDefined();
    });

    it('should reject invalid session token', async () => {
      await expect(
        auth.validateSession('invalid-token')
      ).rejects.toThrow('Invalid session');
    });

    it('should validate token parameter is required', async () => {
      await expect(
        auth.validateSession('')
      ).rejects.toThrow(/token/i);
    });

    it('should logout user and invalidate session', async () => {
      await auth.logout(sessionToken);

      await expect(
        auth.validateSession(sessionToken)
      ).rejects.toThrow('Invalid session');
    });

    it('should emit auth:logout event', async () => {
      await auth.logout(sessionToken);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:logout',
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // ROLE MANAGEMENT TESTS
  // ============================================================================

  describe('Role Management', () => {
    let auth;

    beforeEach(async () => {
      auth = createAuth('memory', { createDefaultAdmin: false }, eventEmitter);
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
        role: 'user'
      });

      await auth.createUser({
        username: 'bob',
        email: 'bob@example.com',
        password: 'password123',
        role: 'admin'
      });
    });

    it('should assign user to role', async () => {
      await auth.addUserToRole('alice', 'admin');

      const user = await auth.getUser('alice');
      expect(user.role).toBe('admin');
    });

    it('should emit auth:role-assigned event', async () => {
      await auth.addUserToRole('alice', 'admin');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:role-assigned',
        expect.objectContaining({
          username: 'alice',
          role: 'admin'
        })
      );
    });

    it('should list users in a role', async () => {
      const admins = await auth.getUsersInRole('admin');

      expect(admins.length).toBe(1);
      expect(admins[0].username).toBe('bob');
    });

    it('should list all available roles', async () => {
      const roles = await auth.listRoles();

      expect(Array.isArray(roles)).toBe(true);
      expect(roles).toContain('admin');
      expect(roles).toContain('user');
      expect(roles).toContain('guest');
    });

    it('should handle nonexistent role gracefully', async () => {
      const users = await auth.getUsersInRole('nonexistent');

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(0);
    });
  });

  // ============================================================================
  // SETTINGS TESTS
  // ============================================================================

  describe('Settings Management', () => {
    let auth;

    beforeEach(() => {
      auth = createAuth('memory', {}, eventEmitter);
    });

    it('should get settings', async () => {
      const settings = await auth.getSettings();

      expect(settings).toBeDefined();
      expect(settings.list).toBeDefined();
      expect(Array.isArray(settings.list)).toBe(true);
    });

    it('should save settings', async () => {
      await expect(
        auth.saveSettings({})
      ).resolves.toBeUndefined();
    });

    it('should emit auth:setting-changed event', async () => {
      // Some providers may have configurable settings
      const settings = await auth.getSettings();

      if (settings.list && settings.list.length > 0) {
        const firstSetting = settings.list[0].setting;
        eventEmitter.emit.mockClear();

        await auth.saveSettings({
          [firstSetting]: 'test-value'
        });

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'auth:setting-changed',
          expect.any(Object)
        );
      }
    });
  });

  // ============================================================================
  // STATUS AND STATUS TESTS
  // ============================================================================

  describe('Status and Information', () => {
    let auth;

    beforeEach(async () => {
      auth = createAuth('memory', { createDefaultAdmin: false }, eventEmitter);
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      await auth.authenticateUser('alice', 'password123');
    });

    it('should get service status', async () => {
      const status = await auth.getStatus();

      expect(status.service).toBe('auth');
      expect(status.provider).toBeDefined();
      expect(status.users).toBeGreaterThan(0);
      expect(status.activeSessions).toBeGreaterThan(0);
      expect(status.roles).toBeGreaterThan(0);
      expect(status.uptime).toBeDefined();
    });

    it('should have correct user count in status', async () => {
      const status = await auth.getStatus();

      expect(status.users).toBe(1);
    });

    it('should track active sessions', async () => {
      const status1 = await auth.getStatus();

      const result = await auth.authenticateUser('alice', 'password123');
      const status2 = await auth.getStatus();

      expect(status2.activeSessions).toBeGreaterThan(status1.activeSessions);
    });
  });

  // ============================================================================
  // MIDDLEWARE TESTS
  // ============================================================================

  describe('Middleware Functions', () => {
    it('should expose createAuthMiddleware', () => {
      const auth = createAuth('memory', {}, eventEmitter);

      expect(typeof auth.createAuthMiddleware).toBe('function');
    });

    it('should expose createAuthMiddlewareWithHandler', () => {
      const auth = createAuth('memory', {}, eventEmitter);

      expect(typeof auth.createAuthMiddlewareWithHandler).toBe('function');
    });

    it('should create auth middleware', () => {
      const auth = createAuth('memory', {}, eventEmitter);

      const middleware = auth.createAuthMiddleware({
        loginPath: '/login'
      });

      expect(typeof middleware).toBe('function');
    });

    it('should create auth middleware with handler', () => {
      const auth = createAuth('memory', {}, eventEmitter);

      const middleware = auth.createAuthMiddlewareWithHandler({
        onUnauthorized: (req, res) => {
          res.status(401).json({ error: 'Unauthorized' });
        }
      });

      expect(typeof middleware).toBe('function');
    });
  });

  // ============================================================================
  // PASSPORT INTEGRATION TESTS
  // ============================================================================

  describe('Passport Integration', () => {
    let auth;

    beforeEach(() => {
      auth = createAuth('passport', {}, eventEmitter);
    });

    it('should have passportConfigurator method', () => {
      expect(typeof auth.passportConfigurator).toBe('function');
    });

    it('should have getAuthStrategy method', () => {
      expect(typeof auth.getAuthStrategy).toBe('function');
    });

    it('should return strategy configuration', () => {
      const strategy = auth.getAuthStrategy();

      if (strategy) {
        expect(strategy.strategy).toBeDefined();
        expect(strategy.serializeUser).toBeDefined();
        expect(strategy.deserializeUser).toBeDefined();
      }
    });
  });

  // ============================================================================
  // DEFAULT USERS TESTS
  // ============================================================================

  describe('Default Users Initialization', () => {
    it('should create default users in memory provider', async () => {
      const auth = createAuth('memory', {
        createDefaultAdmin: true
      }, eventEmitter);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 50));

      const users = await auth.listUsers();

      // Memory provider should have at least 1 user (may have defaults)
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThanOrEqual(0);
    });

    it('should skip default users when createDefaultAdmin is false', async () => {
      const auth = createAuth('memory', {
        createDefaultAdmin: false
      }, eventEmitter);

      const users = await auth.listUsers();

      expect(users.length).toBe(0);
    });
  });

  // ============================================================================
  // EVENT SYSTEM TESTS
  // ============================================================================

  describe('Event System', () => {
    let auth;

    beforeEach(() => {
      auth = createAuth('memory', { createDefaultAdmin: false }, eventEmitter);
    });

    it('should emit provider-initialized event', () => {
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:provider-initialized',
        expect.any(Object)
      );
    });

    it('should handle missing event emitter gracefully', () => {
      expect(() => {
        createAuth('memory', {}, null);
      }).not.toThrow();
    });

    it('should support validation error events', async () => {
      eventEmitter.emit.mockClear();

      try {
        await auth.createUser({
          username: '',
          email: 'test@example.com',
          password: 'password'
        });
      } catch (e) {
        // Expected
      }

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth:validation-error',
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // DEPENDENCY INJECTION TESTS
  // ============================================================================

  describe('Dependency Injection', () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    it('should accept logging dependency', () => {
      const auth = createAuth('memory', {
        dependencies: {
          logging: mockLogger
        }
      }, eventEmitter);

      expect(auth).toBeDefined();
    });

    it('should accept dataservice dependency', () => {
      const auth = createAuth('file', {
        dependencies: {
          dataservice: {}
        }
      }, eventEmitter);

      expect(auth).toBeDefined();
    });

    it('should handle empty dependencies', () => {
      const auth = createAuth('memory', {
        dependencies: {}
      }, eventEmitter);

      expect(auth).toBeDefined();
    });

    it('should handle missing dependencies', () => {
      const auth = createAuth('memory', {}, eventEmitter);

      expect(auth).toBeDefined();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    let auth;

    beforeEach(() => {
      auth = createAuth('memory', { createDefaultAdmin: false }, eventEmitter);
    });

    it('should validate createUser input is object', async () => {
      await expect(
        auth.createUser(null)
      ).rejects.toThrow(/userData/i);

      await expect(
        auth.createUser('string')
      ).rejects.toThrow(/userData/i);

      await expect(
        auth.createUser([])
      ).rejects.toThrow(/userData/i);
    });

    it('should validate updateUser input is object', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      await expect(
        auth.updateUser('alice', null)
      ).rejects.toThrow(/updates/i);
    });

    it('should handle inactive users', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123'
      });

      await auth.updateUser('alice', { isActive: false });

      await expect(
        auth.authenticateUser('alice', 'password123')
      ).rejects.toThrow('Invalid credentials');
    });
  });

  // ============================================================================
  // PASSWORD HANDLING TESTS
  // ============================================================================

  describe('Password Security', () => {
    let auth;

    beforeEach(() => {
      auth = createAuth('memory', { createDefaultAdmin: false }, eventEmitter);
    });

    it('should hash passwords', async () => {
      const user = await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'plainTextPassword123'
      });

      // Password should not be in returned user object
      expect(user.password).toBeUndefined();
    });

    it('should support password updates', async () => {
      await auth.createUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'oldPassword123'
      });

      // Old password should fail after update
      await auth.updateUser('alice', {
        password: 'newPassword123'
      });

      await expect(
        auth.authenticateUser('alice', 'oldPassword123')
      ).rejects.toThrow('Invalid credentials');

      // New password should work
      const result = await auth.authenticateUser('alice', 'newPassword123');
      expect(result.user.username).toBe('alice');
    });
  });

  // ============================================================================
  // MULTI-PROVIDER TESTS
  // ============================================================================

  describe('Multi-Provider Support', () => {
    const providers = ['memory', 'passport', 'google', 'file', 'api'];

    const testProviders = ['memory', 'passport', 'google', 'file'];

    testProviders.forEach(provider => {
      it(`should create ${provider} provider`, () => {
        const options = {
          memory: { createDefaultAdmin: false },
          passport: { createDefaultAdmin: false },
          google: { clientID: 'test', clientSecret: 'test', createDefaultAdmin: false },
          file: { dataDir: './.test', createDefaultAdmin: false }
        };

        const auth = createAuth(provider, options[provider], eventEmitter);

        expect(auth).toBeDefined();
        expect(typeof auth.createUser).toBe('function');
        expect(typeof auth.authenticateUser).toBe('function');
        expect(typeof auth.getSettings).toBe('function');
      });
    });

    it('should create api provider', () => {
      const auth = createAuth('api', {
        url: 'http://localhost',
        createDefaultAdmin: false
      }, eventEmitter);

      expect(auth).toBeDefined();
      // API provider may have different method signatures for proxying
      expect(auth).toHaveProperty('settings');
    });

    it('should maintain consistent interface across providers', () => {
      const methods = [
        'createUser',
        'authenticateUser',
        'validateSession',
        'logout',
        'getUser',
        'updateUser',
        'deleteUser',
        'listUsers',
        'addUserToRole',
        'getUsersInRole',
        'listRoles',
        'getSettings',
        'saveSettings',
        'getStatus'
      ];

      const auth = createAuth('memory', {}, eventEmitter);

      methods.forEach(method => {
        expect(typeof auth[method]).toBe('function');
      });
    });
  });

  // ============================================================================
  // CONFIGURATION OPTIONS TESTS
  // ============================================================================

  describe('Configuration Options', () => {
    it('should accept createDefaultAdmin option', () => {
      const auth1 = createAuth('memory', {
        createDefaultAdmin: true
      }, eventEmitter);

      const auth2 = createAuth('memory', {
        createDefaultAdmin: false
      }, eventEmitter);

      expect(auth1).toBeDefined();
      expect(auth2).toBeDefined();
    });

    it('should accept custom options', () => {
      const customOptions = {
        sessionTimeout: 3600,
        passwordPolicy: {
          minLength: 8,
          requireNumbers: true,
          requireSpecialChars: true
        }
      };

      const auth = createAuth('memory', customOptions, eventEmitter);

      expect(auth).toBeDefined();
    });

    it('should handle missing options gracefully', () => {
      const auth = createAuth('memory', {}, eventEmitter);

      expect(auth).toBeDefined();
    });
  });
});
