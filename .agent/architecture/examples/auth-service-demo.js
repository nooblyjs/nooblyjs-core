/**
 * @fileoverview Authentication Service Demo
 * Example showing how to use the NooblyJS Auth Service
 * @author NooblyJS Team
 * @version 1.0.0
 */

const express = require('express');
const serviceRegistry = require('../index');

const app = express();

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the service registry
const eventEmitter = require('events');
const globalEventEmitter = new eventEmitter();

serviceRegistry.initialize(app, globalEventEmitter, {
  // Optional API key authentication
  // apiKeys: ['your-api-key-here'],
  // requireApiKey: false
});

// Example 1: Using memory auth provider (default)
const memoryAuth = serviceRegistry.authservice('memory', {
  createDefaultAdmin: true // Creates admin/admin123 and user/user123
});

// Example 2: Using passport local strategy
const passportAuth = serviceRegistry.authservice('passport', {
  'express-app': app
});

// Example 3: Using Google OAuth (requires client credentials)
/*
const googleAuth = serviceRegistry.authservice('google', {
  'express-app': app,
  clientID: 'your-google-client-id',
  clientSecret: 'your-google-client-secret',
  callbackURL: '/auth/google/callback'
});
*/

// Custom middleware using auth service
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const session = await memoryAuth.validateSession(token);
    req.user = session;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Example protected routes
app.get('/protected', requireAuth, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user.username,
    role: req.user.role
  });
});

app.get('/admin-only', requireAuth, requireRole('admin'), (req, res) => {
  res.json({
    message: 'Admin only content',
    adminUser: req.user.username
  });
});

// Event listeners
globalEventEmitter.on('auth:login', (data) => {
  console.log(`User logged in: ${data.username} (${data.role})`);
});

globalEventEmitter.on('auth:user-created', (data) => {
  console.log(`New user created: ${data.username} (${data.role})`);
});

globalEventEmitter.on('auth:logout', (data) => {
  console.log(`User logged out: ${data.username}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🔐 Auth Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Auth Interface: http://localhost:3000/services/authservice/');
  console.log('- Swagger API Docs: http://localhost:3000/services/authservice/swagger');
  console.log('- Service Status: http://localhost:3000/services/authservice/api/status');
  console.log('- Protected Route: http://localhost:3000/protected (requires Bearer token)');
  console.log('- Admin Route: http://localhost:3000/admin-only (requires admin Bearer token)');
  console.log('\nDefault users:');
  console.log('- Username: admin, Password: admin123 (Admin role)');
  console.log('- Username: user, Password: user123 (User role)');
  console.log('\nTo get a token, POST to: http://localhost:3000/services/authservice/api/login');
  console.log('Example: { "username": "admin", "password": "admin123" }');
});