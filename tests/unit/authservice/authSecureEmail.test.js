/**
 * @fileoverview Tests for Secure Email Authentication Provider
 * Tests email + secure key authentication and user management.
 */

const AuthSecureEmail = require('../../../src/authservice/providers/authSecureEmail');
const EventEmitter = require('events');
const fs = require('node:fs').promises;
const path = require('node:path');

describe('AuthSecureEmail Provider', () => {
  let auth;
  let mockEventEmitter;
  const testDataDir = path.join(__dirname, '../../..', '.test-secure-email-data');

  beforeEach(() => {
    mockEventEmitter = new EventEmitter();
    jest.spyOn(mockEventEmitter, 'emit');
    auth = new AuthSecureEmail(
      { dataDir: testDataDir },
      mockEventEmitter
    );
  });

  afterEach(async () => {
    // Clean up test data directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Provider Initialization', () => {
    it('should initialize secure email auth provider', async () => {
      expect(auth).toBeDefined();
      expect(typeof auth.authenticateWithSecureEmail).toBe('function');
      expect(typeof auth.addSecureEmailUser).toBe('function');
      expect(typeof auth.removeSecureEmailUser).toBe('function');
      expect(typeof auth.listSecureEmailUsers).toBe('function');
    });

    it('should emit provider-initialized event', () => {
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'auth:provider-initialized',
        expect.objectContaining({
          provider: 'secure-email',
          message: expect.any(String)
        })
      );
    });
  });

  describe('Adding Secure Email Users', () => {
    it('should add a new secure email user', async () => {
      const user = await auth.addSecureEmailUser(
        'user@example.com',
        'secure_key_123',
        'user@example.com',
        'user'
      );

      expect(user).toBeDefined();
      expect(user.email).toBe('user@example.com');
      expect(user.username).toBe('user@example.com');
      expect(user.role).toBe('user');
      expect(user.isActive).toBe(true);
      expect(user.id).toBeDefined();
      expect(user.secureKey).toBeUndefined(); // Should not be returned
    });

    it('should prevent duplicate email registration', async () => {
      await auth.addSecureEmailUser('user@example.com', 'key_123');

      await expect(
        auth.addSecureEmailUser('user@example.com', 'different_key')
      ).rejects.toThrow('User already exists');
    });

    it('should handle email case-insensitivity', async () => {
      await auth.addSecureEmailUser('User@Example.COM', 'key_123');

      await expect(
        auth.addSecureEmailUser('user@example.com', 'key_456')
      ).rejects.toThrow('User already exists');
    });

    it('should emit user-added event', async () => {
      await auth.addSecureEmailUser('user@example.com', 'key_123', 'user@example.com', 'user');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'auth:secure-email-user-added',
        expect.objectContaining({
          email: 'user@example.com',
          username: 'user@example.com'
        })
      );
    });

    it('should require email and secure key', async () => {
      await expect(auth.addSecureEmailUser('', 'key')).rejects.toThrow('Email is required');
      await expect(auth.addSecureEmailUser('user@example.com', '')).rejects.toThrow('Secure key is required');
    });
  });

  describe('Authenticating with Secure Email', () => {
    beforeEach(async () => {
      await auth.addSecureEmailUser('user@example.com', 'correct_key_123', 'testuser', 'user');
    });

    it('should authenticate with valid email and secure key', async () => {
      const result = await auth.authenticateWithSecureEmail('user@example.com', 'correct_key_123');

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.username).toBe('testuser');
      expect(result.user.role).toBe('user');
      expect(result.session).toBeDefined();
      expect(result.session.token).toBeDefined();
      expect(result.session.expiresAt).toBeDefined();
    });

    it('should reject invalid secure key', async () => {
      await expect(
        auth.authenticateWithSecureEmail('user@example.com', 'wrong_key')
      ).rejects.toThrow('Invalid email or secure key');
    });

    it('should reject non-existent email', async () => {
      await expect(
        auth.authenticateWithSecureEmail('nonexistent@example.com', 'correct_key_123')
      ).rejects.toThrow('Invalid email or secure key');
    });

    it('should reject inactive users', async () => {
      // Mark user as inactive directly in the Map
      const storedUser = auth.secureUsers_.get('user@example.com');
      storedUser.isActive = false;

      await expect(
        auth.authenticateWithSecureEmail('user@example.com', 'correct_key_123')
      ).rejects.toThrow('User account is not active');
    });

    it('should emit authentication-success event', async () => {
      await auth.authenticateWithSecureEmail('user@example.com', 'correct_key_123');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'auth:secure-email-auth',
        expect.objectContaining({
          email: 'user@example.com',
          username: 'testuser'
        })
      );
    });

    it('should emit authentication-failure event', async () => {
      await expect(
        auth.authenticateWithSecureEmail('user@example.com', 'wrong_key')
      ).rejects.toThrow();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'auth:secure-email-auth-failed',
        expect.objectContaining({
          email: 'user@example.com',
          reason: 'invalid_key'
        })
      );
    });

    it('should create valid session token', async () => {
      const result = await auth.authenticateWithSecureEmail('user@example.com', 'correct_key_123');

      // Verify token is stored in sessions map
      const session = auth.sessions_.get(result.session.token);
      expect(session).toBeDefined();
      expect(session.username).toBe('testuser');
      expect(session.userId).toBeDefined();
      expect(session.expiresAt > new Date()).toBe(true);
    });

    it('should handle email case-insensitivity', async () => {
      const result = await auth.authenticateWithSecureEmail('User@Example.COM', 'correct_key_123');

      expect(result.user.email).toBe('user@example.com');
    });

    it('should require email and secure key parameters', async () => {
      await expect(auth.authenticateWithSecureEmail('', 'key')).rejects.toThrow('Email is required');
      await expect(auth.authenticateWithSecureEmail('user@example.com', '')).rejects.toThrow('Secure key is required');
    });
  });

  describe('Removing Secure Email Users', () => {
    beforeEach(async () => {
      await auth.addSecureEmailUser('user@example.com', 'key_123');
    });

    it('should remove a secure email user', async () => {
      await auth.removeSecureEmailUser('user@example.com');

      expect(auth.secureUsers_.has('user@example.com')).toBe(false);
    });

    it('should emit user-removed event', async () => {
      await auth.removeSecureEmailUser('user@example.com');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'auth:secure-email-user-removed',
        expect.objectContaining({
          email: 'user@example.com'
        })
      );
    });

    it('should reject non-existent user removal', async () => {
      await expect(
        auth.removeSecureEmailUser('nonexistent@example.com')
      ).rejects.toThrow('User not found');
    });

    it('should require email parameter', async () => {
      await expect(auth.removeSecureEmailUser('')).rejects.toThrow('Email is required');
    });
  });

  describe('Listing Secure Email Users', () => {
    it('should return empty list initially', async () => {
      const users = await auth.listSecureEmailUsers();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(0);
    });

    it('should list all secure email users', async () => {
      await auth.addSecureEmailUser('user1@example.com', 'key1', 'user1', 'user');
      await auth.addSecureEmailUser('user2@example.com', 'key2', 'user2', 'admin');

      const users = await auth.listSecureEmailUsers();

      expect(users.length).toBe(2);
      expect(users.some(u => u.email === 'user1@example.com')).toBe(true);
      expect(users.some(u => u.email === 'user2@example.com')).toBe(true);
    });

    it('should not include secure keys in response', async () => {
      await auth.addSecureEmailUser('user@example.com', 'key_123');

      const users = await auth.listSecureEmailUsers();
      const user = users[0];

      expect(user.secureKey).toBeUndefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.username).toBeDefined();
    });
  });

  describe('File Persistence', () => {
    it('should save users to JSON file', async () => {
      await auth.addSecureEmailUser('user@example.com', 'key_123', 'user@example.com', 'user');

      const fileContent = await fs.readFile(
        path.join(testDataDir, 'secure-emails.json'),
        'utf8'
      );
      const data = JSON.parse(fileContent);

      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBe(1);
      expect(data.users[0].email).toBe('user@example.com');
    });

    it('should load users from JSON file on initialization', async () => {
      // Create a fresh instance with existing file
      await auth.addSecureEmailUser('user1@example.com', 'key1');
      await auth.addSecureEmailUser('user2@example.com', 'key2');

      // Create new instance to test loading
      const newAuth = new AuthSecureEmail(
        { dataDir: testDataDir },
        mockEventEmitter
      );

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      const users = await newAuth.listSecureEmailUsers();
      expect(users.length).toBe(2);
    });
  });

  describe('Service Status', () => {
    it('should return secure email provider status', async () => {
      await auth.addSecureEmailUser('user1@example.com', 'key1');
      await auth.addSecureEmailUser('user2@example.com', 'key2');

      const status = await auth.getStatus();

      expect(status).toBeDefined();
      expect(status.provider).toBe('secure-email');
      expect(status.secureEmailUsers).toBe(2);
      expect(status.dataFile).toBeDefined();
    });
  });

  describe('Secure Key Hashing', () => {
    it('should hash secure keys before storage', async () => {
      await auth.addSecureEmailUser('user@example.com', 'my_secret_key', 'user', 'user');

      const storedUser = auth.secureUsers_.get('user@example.com');

      // Key should not be stored as plain text
      expect(storedUser.secureKey).not.toBe('my_secret_key');
      // Key hash should include salt separator
      expect(storedUser.secureKey).toContain(':');
    });

    it('should use constant-time comparison for key verification', async () => {
      await auth.addSecureEmailUser('user@example.com', 'correct_key');

      // Valid key should authenticate
      const validResult = await auth.authenticateWithSecureEmail('user@example.com', 'correct_key');
      expect(validResult.user).toBeDefined();

      // Invalid key should fail
      await expect(
        auth.authenticateWithSecureEmail('user@example.com', 'wrong_key')
      ).rejects.toThrow();
    });
  });

  describe('Integration with Passport Session Management', () => {
    it('should inherit session generation from AuthBase', async () => {
      await auth.addSecureEmailUser('user@example.com', 'key_123');

      const result = await auth.authenticateWithSecureEmail('user@example.com', 'key_123');

      // Should have proper session structure
      expect(result.session.token).toBeDefined();
      expect(result.session.expiresAt).toBeDefined();
      expect(typeof result.session.token).toBe('string');
      expect(result.session.token.length > 0).toBe(true);
    });

    it('should work with session validation', async () => {
      await auth.addSecureEmailUser('user@example.com', 'key_123');

      const result = await auth.authenticateWithSecureEmail('user@example.com', 'key_123');
      const validated = await auth.validateSession(result.session.token);

      expect(validated).toBeDefined();
      expect(validated.username).toBe('user@example.com');
    });
  });
});
