/**
 * @fileoverview Example app demonstrating Secure Email Authentication
 * Shows how to use the authSecureEmail provider for Teams/Edge extensions.
 *
 * Usage:
 *   node tests/app/authservice/app-secure-email.js
 *
 * Then test with curl:
 *   # Add a user
 *   curl -X POST http://localhost:11000/services/authservice/api/secure-email/users \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"user@example.com","secureKey":"their_key_123","username":"user","role":"user"}'
 *
 *   # Authenticate
 *   curl -X POST http://localhost:11000/services/authservice/api/secure-email/login \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"user@example.com","secureKey":"their_key_123"}'
 *
 *   # List users
 *   curl -X GET http://localhost:11000/services/authservice/api/secure-email/users \
 *     -H "Authorization: Bearer YOUR_API_KEY"
 */

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { EventEmitter } = require('events');
const path = require('path');

// Get service registry
const serviceRegistry = require('../../../index');

const app = express();
const eventEmitter = new EventEmitter();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secure-email-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Create secure email auth service
const authservice = serviceRegistry.authservice('secure-email', {
  dataDir: path.join(__dirname, '../../../.application/data'),
  dependencies: {}
});

// Expose auth service for manual testing
global.auth = authservice;

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Secure Email Authentication Example',
    endpoints: {
      login: 'POST /services/authservice/api/secure-email/login',
      addUser: 'POST /services/authservice/api/secure-email/users',
      listUsers: 'GET /services/authservice/api/secure-email/users',
      removeUser: 'DELETE /services/authservice/api/secure-email/users/:email'
    },
    example: {
      addUser: {
        url: 'POST /services/authservice/api/secure-email/users',
        body: {
          email: 'user@example.com',
          secureKey: 'their_secure_key_123',
          username: 'user@example.com',
          role: 'user'
        }
      },
      authenticate: {
        url: 'POST /services/authservice/api/secure-email/login',
        body: {
          email: 'user@example.com',
          secureKey: 'their_secure_key_123'
        }
      }
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'secure-email-auth-example' });
});

// Start server
const PORT = process.env.PORT || 11000;

app.listen(PORT, async () => {
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║ Secure Email Auth Example Server                   ║`);
  console.log(`║ Running on port ${PORT}` + ' '.repeat(Math.max(0, 42 - PORT.toString().length)) + `║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);

  console.log('Quick start examples:\n');

  console.log('1. Add a user:');
  console.log(`   curl -X POST http://localhost:${PORT}/services/authservice/api/secure-email/users \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"email":"alice@company.com","secureKey":"alice_key_123","username":"alice","role":"user"}'\n`);

  console.log('2. Authenticate with email + secure key:');
  console.log(`   curl -X POST http://localhost:${PORT}/services/authservice/api/secure-email/login \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"email":"alice@company.com","secureKey":"alice_key_123"}'\n`);

  console.log('3. Use returned token for authenticated endpoints:');
  console.log(`   curl -X GET http://localhost:${PORT}/services/authservice/api/users/alice \\`);
  console.log(`     -H "Authorization: Bearer <token_from_step_2>"\n`);

  console.log('4. List all secure email users:');
  console.log(`   curl -X GET http://localhost:${PORT}/services/authservice/api/secure-email/users\n`);

  // Pre-populate with example users for convenience
  try {
    await authservice.addSecureEmailUser(
      'alice@company.com',
      'alice_secure_key_123',
      'alice@company.com',
      'user'
    );
    console.log('✓ Pre-added example user: alice@company.com with key: alice_secure_key_123\n');

    await authservice.addSecureEmailUser(
      'bob@company.com',
      'bob_secure_key_456',
      'bob@company.com',
      'admin'
    );
    console.log('✓ Pre-added example user: bob@company.com with key: bob_secure_key_456\n');
  } catch (error) {
    // Users might already exist
    console.log('✓ Example users already exist\n');
  }

  // Listen for auth events
  eventEmitter.on('auth:secure-email-auth', (data) => {
    console.log(`[AUTH] User authenticated: ${data.username} (${data.email})`);
  });

  eventEmitter.on('auth:secure-email-auth-failed', (data) => {
    console.log(`[AUTH FAILED] ${data.email} - Reason: ${data.reason}`);
  });

  eventEmitter.on('auth:secure-email-user-added', (data) => {
    console.log(`[USER ADDED] ${data.email} (${data.username})`);
  });

  eventEmitter.on('auth:secure-email-user-removed', (data) => {
    console.log(`[USER REMOVED] ${data.email}`);
  });

  console.log('Listening for auth events...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

module.exports = app;
