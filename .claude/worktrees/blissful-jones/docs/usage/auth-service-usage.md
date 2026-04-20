# Auth Service - Comprehensive Usage Guide

## Overview

The **Auth Service** is a comprehensive authentication and user management framework supporting multiple authentication strategies (Passport, Google OAuth, File, Memory, and API-based) with built-in role-based access control (RBAC), session management, and user analytics. The service provides both programmatic APIs and Express middleware for seamless integration into web applications.

**Key Features:**
- Multi-provider authentication (Passport Local, Google OAuth, File, Memory, API)
- User registration, login, and account management
- Role-based access control (RBAC) with default admin/user/guest roles
- Session management with token-based authentication
- Built-in analytics for login tracking and security monitoring
- Express middleware for route protection
- EventEmitter integration for cross-service communication
- Password hashing with salt (SHA-256 with salt, bcrypt recommended for production)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Architecture](#service-architecture)
3. [Creating and Configuring Auth Services](#creating-and-configuring-auth-services)
4. [Core Service Interface](#core-service-interface)
5. [Provider Reference](#provider-reference)
6. [REST API Endpoints](#rest-api-endpoints)
7. [Middleware Integration](#middleware-integration)
8. [Analytics Module](#analytics-module)
9. [Web UI and Scripts](#web-ui-and-scripts)
10. [Event System](#event-system)
11. [Error Handling](#error-handling)
12. [Security Best Practices](#security-best-practices)
13. [Examples](#examples)

---

## Quick Start

### Installation

```bash
npm install
```

### Basic Usage

```javascript
const createAuth = require('./src/authservice');
const EventEmitter = require('events');

// Create an auth service instance
const eventEmitter = new EventEmitter();

const authService = createAuth('memory', {
  createDefaultAdmin: true
}, eventEmitter);

// Register a user
const newUser = await authService.createUser({
  username: 'alice@example.com',
  email: 'alice@example.com',
  password: 'securePassword123',
  role: 'user'
});

// Authenticate a user
const result = await authService.authenticateUser('alice@example.com', 'securePassword123');
console.log('User:', result.user);
console.log('Session Token:', result.session.token);

// Validate session
const session = await authService.validateSession(result.session.token);
console.log('Session valid:', session.username);
```

---

## Service Architecture

### Core Hierarchy

```
AuthService (Factory)
├── Passport Provider (Local Strategy)
├── Google OAuth Provider
├── Memory Provider (In-memory storage)
├── File Provider (File-based persistence)
├── API Provider (Remote HTTP API proxy)
├── Analytics Module
├── Routes (Express REST API)
├── Views (HTML Templates & Static Files)
└── Middleware
    ├── API Key Authentication
    ├── Passport Configuration
    ├── Session-based Auth
    └── Service Authentication
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **AuthBase** | Base class with user management, roles, and sessions |
| **Providers** | Provider-specific implementations (Passport, Google, File, Memory, API) |
| **Analytics** | Login activity tracking and user statistics |
| **Routes** | Express.js REST API endpoints |
| **Views** | HTML UI (login, register, dashboard) |
| **Middleware** | Express middleware for auth protection |

---

## Creating and Configuring Auth Services

### Factory Function Signature

```javascript
createAuth(providerType, options, eventEmitter)
```

**Parameters:**
- `providerType` (string): One of `'passport'`, `'google'`, `'memory'`, `'file'`, `'api'`
- `options` (object): Provider-specific configuration
- `eventEmitter` (EventEmitter, optional): Event emitter for lifecycle events

**Returns:** Configured auth service instance with user management methods

### Memory Provider (Development)

```javascript
const authService = createAuth('memory', {
  createDefaultAdmin: true  // Create default admin user
}, eventEmitter);
```

---

### File Provider (Persistent)

```javascript
const authService = createAuth('file', {
  dataDir: './.application/data/auth',
  createDefaultAdmin: true
}, eventEmitter);
```

**Settings:**
- `dataDir`: Directory for storing user data (default: `./.application/data/auth`)
- `createDefaultAdmin`: Initialize with default users

---

### Passport Local Provider

```javascript
const authService = createAuth('passport', {
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
  dependencies: {
    logging: loggerInstance,
    caching: cachingInstance
  }
}, eventEmitter);
```

**Configuration:**
- `sessionSecret`: Secret for session encryption
- `dependencies.logging`: Optional logging service
- `dependencies.caching`: Optional caching service

---

### Google OAuth Provider

```javascript
const authService = createAuth('google', {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/google/callback',
  dependencies: {
    dataservice: datastoreInstance
  }
}, eventEmitter);
```

**Configuration:**
- `clientID`: Google OAuth client ID
- `clientSecret`: Google OAuth client secret
- `callbackURL`: OAuth callback URL
- `dependencies.dataservice`: DataService for user persistence

---

### API Provider

```javascript
const authService = createAuth('api', {
  url: 'http://remote-auth-service.com',
  apikey: 'auth-service-api-key',
  timeout: 30000
}, eventEmitter);
```

**Configuration:**
- `url`: Remote auth service base URL
- `apikey`: API key for authentication
- `timeout`: Request timeout (default: 5000ms)

---

## Core Service Interface

### User Management

#### `createUser(userData)`

Creates a new user account.

**Parameters:**
```javascript
{
  username: string,      // Unique username (required)
  email: string,         // Email address (required)
  password: string,      // Plain text password (required, will be hashed)
  role: string           // User role (default: 'user')
}
```

**Returns:**
```javascript
{
  id: string,            // Unique user ID
  username: string,
  email: string,
  role: string,
  createdAt: Date,
  lastLogin: null,
  isActive: true
}
```

**Example:**
```javascript
const user = await authService.createUser({
  username: 'john.doe',
  email: 'john@example.com',
  password: 'SecurePass123!',
  role: 'user'
});
```

---

#### `authenticateUser(username, password)`

Authenticates a user and creates a session.

**Parameters:**
- `username` (string): User's username
- `password` (string): User's password

**Returns:**
```javascript
{
  user: {
    id: string,
    username: string,
    email: string,
    role: string,
    createdAt: Date,
    lastLogin: Date,
    isActive: boolean
  },
  session: {
    token: string,           // Session token for subsequent requests
    expiresAt: Date          // Token expiration time (24 hours)
  }
}
```

**Example:**
```javascript
const result = await authService.authenticateUser('john.doe', 'SecurePass123!');
console.log('Login successful, token:', result.session.token);
```

---

#### `validateSession(token)`

Validates a session token and returns session information.

**Parameters:**
- `token` (string): Session token

**Returns:**
```javascript
{
  token: string,
  userId: string,
  username: string,
  role: string,
  createdAt: Date,
  expiresAt: Date
}
```

**Throws:**
- `Invalid session` - Token not found
- `Session expired` - Token has expired (24 hours)

**Example:**
```javascript
try {
  const session = await authService.validateSession(token);
  console.log('Authenticated as:', session.username);
} catch (error) {
  console.error('Invalid session:', error.message);
}
```

---

#### `logout(token)`

Invalidates a session token.

**Parameters:**
- `token` (string): Session token to invalidate

**Returns:** Promise resolving when logout is complete

**Example:**
```javascript
await authService.logout(sessionToken);
console.log('User logged out successfully');
```

---

### User Information

#### `getUser(username)`

Retrieves user information by username (excludes password).

**Returns:**
```javascript
{
  id: string,
  username: string,
  email: string,
  role: string,
  createdAt: Date,
  lastLogin: Date,
  isActive: boolean
}
```

---

#### `listUsers()`

Lists all registered users (excludes passwords).

**Returns:** Array of user objects

---

#### `updateUser(username, updates)`

Updates user information.

**Parameters:**
- `username` (string): Target username
- `updates` (object): Fields to update

**Updatable Fields:**
- `email`: User email address
- `password`: New password (will be hashed)
- `isActive`: Account active status

**Cannot Update:**
- `username`: Cannot change username
- `id`: Cannot change user ID

**Example:**
```javascript
await authService.updateUser('john.doe', {
  email: 'newemail@example.com',
  password: 'NewPassword456!'
});
```

---

#### `deleteUser(username)`

Deletes a user account and invalidates all their sessions.

**Parameters:**
- `username` (string): Username to delete

**Example:**
```javascript
await authService.deleteUser('john.doe');
```

---

### Role Management

#### `addUserToRole(username, role)`

Assigns a user to a role.

**Parameters:**
- `username` (string): Username
- `role` (string): Role name

**Example:**
```javascript
await authService.addUserToRole('john.doe', 'admin');
```

---

#### `getUsersInRole(role)`

Gets all users in a specific role.

**Parameters:**
- `role` (string): Role name

**Returns:** Array of user objects in that role

**Example:**
```javascript
const admins = await authService.getUsersInRole('admin');
console.log('Admins:', admins.length);
```

---

#### `listRoles()`

Lists all available roles.

**Default Roles:**
- `admin` - Administrator role
- `user` - Regular user role
- `guest` - Guest/anonymous role

**Returns:** Array of role names

---

### Settings and Status

#### `getSettings()`

Retrieves current authentication settings.

**Returns:**
```javascript
{
  description: string,
  list: [
    {
      setting: string,    // Setting name
      type: string,       // Data type
      values: any[]       // Available/example values
    }
  ],
  [setting]: any         // Current setting values
}
```

---

#### `saveSettings(settings)`

Updates authentication settings.

**Parameters:**
- `settings` (object): Settings to update

**Example:**
```javascript
await authService.saveSettings({
  sessionTimeout: 3600,
  requirePasswordReset: false
});
```

---

#### `getStatus()`

Gets service operational status.

**Returns:**
```javascript
{
  service: 'auth',
  provider: string,           // Provider class name
  users: number,              // Total users
  activeSessions: number,     // Current active sessions
  roles: number,              // Total roles
  uptime: number              // Process uptime in seconds
}
```

---

### Passport Integration

#### `passportConfigurator(customStrategyFactory)`

Creates a Passport configuration wrapper for strategy registration.

**Parameters:**
- `customStrategyFactory` (Function, optional): Custom strategy factory

**Returns:**
```javascript
{
  configurePassport(passportInstance) {
    // Configures passport with strategy
  }
}
```

**Example:**
```javascript
const configurator = authService.passportConfigurator();
const passportConfig = configurator.configurePassport(passport);
```

---

#### `getAuthStrategy()`

Returns Passport Local strategy configuration for manual setup.

**Returns:**
```javascript
{
  strategy: LocalStrategy,  // Configured Local Strategy
  serializeUser: Function,  // User serialization function
  deserializeUser: Function // User deserialization function
}
```

---

### Middleware Creation

#### `createAuthMiddleware(options)`

Creates Express middleware to protect routes.

**Parameters:**
```javascript
{
  loginPath: string,        // Path to login page (default: '/services/authservice/views/login.html')
  saveReferer: boolean      // Save original URL as referrer (default: true)
}
```

**Returns:** Express middleware function

**Example:**
```javascript
const requireAuth = authService.createAuthMiddleware({
  loginPath: '/login',
  saveReferer: true
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.send('Welcome to dashboard!');
});
```

---

#### `createAuthMiddlewareWithHandler(options)`

Creates middleware with custom response handling (e.g., for JSON APIs).

**Parameters:**
```javascript
{
  onUnauthorized: Function  // Custom handler for unauthorized requests
}
```

**Returns:** Express middleware function

**Example:**
```javascript
const requireAuthApi = authService.createAuthMiddlewareWithHandler({
  onUnauthorized: (req, res) => {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/api/protected', requireAuthApi, (req, res) => {
  res.json({ data: 'Protected data' });
});
```

---

## REST API Endpoints

### User Management

#### `POST /services/authservice/api/register`

Registers a new user account.

**Request Body:**
```json
{
  "username": "john.doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "user"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "abc123xyz",
    "username": "john.doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2025-11-23T10:30:00Z"
  }
}
```

---

#### `POST /services/authservice/api/login`

Authenticates a user and creates a session.

**Request Body:**
```json
{
  "username": "john.doe",
  "password": "SecurePass123!",
  "returnUrl": "/dashboard"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User authenticated",
  "data": {
    "user": {
      "id": "abc123xyz",
      "username": "john.doe",
      "email": "john@example.com",
      "role": "user",
      "lastLogin": "2025-11-23T10:35:00Z"
    },
    "session": {
      "token": "session-token-abc123",
      "expiresAt": "2025-11-24T10:35:00Z"
    }
  }
}
```

---

#### `POST /services/authservice/api/logout`

Logs out a user by invalidating their session.

**Request Body:**
```json
{
  "token": "session-token-abc123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### `GET /services/authservice/api/users`

Lists all registered users (requires authentication).

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "user1",
      "username": "alice",
      "email": "alice@example.com",
      "role": "admin",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "user2",
      "username": "bob",
      "email": "bob@example.com",
      "role": "user",
      "createdAt": "2025-06-15T08:30:00Z"
    }
  ]
}
```

---

#### `GET /services/authservice/api/user/:username`

Gets user information by username.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user1",
    "username": "alice",
    "email": "alice@example.com",
    "role": "admin",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

#### `PUT /services/authservice/api/user/:username`

Updates user information (requires authentication).

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "password": "NewPassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "user1",
    "username": "alice",
    "email": "newemail@example.com",
    "role": "admin",
    "updatedAt": "2025-11-23T11:00:00Z"
  }
}
```

---

#### `DELETE /services/authservice/api/user/:username`

Deletes a user account (requires admin role).

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### Role Management

#### `GET /services/authservice/api/roles`

Lists all available roles.

**Response (200):**
```json
{
  "success": true,
  "data": ["admin", "user", "guest"]
}
```

---

#### `GET /services/authservice/api/role/:role/users`

Lists users in a specific role.

**Response (200):**
```json
{
  "success": true,
  "role": "admin",
  "data": [
    {
      "id": "user1",
      "username": "alice",
      "email": "alice@example.com",
      "role": "admin"
    }
  ]
}
```

---

#### `POST /services/authservice/api/user/:username/role`

Assigns a user to a role (requires admin role).

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User assigned to role",
  "data": {
    "username": "bob",
    "role": "admin"
  }
}
```

---

### Status and Analytics

#### `GET /services/authservice/api/status`

Gets authentication service status.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "service": "auth",
    "provider": "AuthMemory",
    "users": 15,
    "activeSessions": 3,
    "roles": 3,
    "uptime": 3600.5
  }
}
```

---

#### `GET /services/authservice/api/analytics/overview`

Gets login activity overview.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalUsers": 15,
    "totalLogins": 87,
    "totalFailures": 5,
    "lastLoginAt": "2025-11-23T11:30:00Z",
    "generatedAt": "2025-11-23T11:35:00Z"
  }
}
```

---

#### `GET /services/authservice/api/analytics/top-users?limit=10`

Lists top users by login count.

**Query Parameters:**
- `limit` (number, optional): Max users to return (default: 10)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "username": "alice",
      "loginCount": 45,
      "failedCount": 1,
      "lastLogin": "2025-11-23T11:30:00Z"
    },
    {
      "username": "bob",
      "loginCount": 32,
      "failedCount": 0,
      "lastLogin": "2025-11-23T10:45:00Z"
    }
  ]
}
```

---

#### `GET /services/authservice/api/analytics/recent?limit=100`

Lists recent login activity.

**Query Parameters:**
- `limit` (number, optional): Max entries to return (default: 100)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "username": "alice",
      "loginCount": 45,
      "failedCount": 1,
      "lastLogin": "2025-11-23T11:30:00Z"
    }
  ]
}
```

---

## Middleware Integration

### API Key Authentication

```javascript
const createAuth = require('./src/authservice');

// Create auth service with middleware
const authService = createAuth('memory', {}, eventEmitter);

// Create API key middleware
const apiKeyMiddleware = createAuth.createApiKeyAuthMiddleware({
  apiKeys: ['key1', 'key2', 'key3']
});

// Apply to routes
app.use('/api/', apiKeyMiddleware);
```

---

### Services Middleware

Middleware for authenticating service-to-service requests:

```javascript
const servicesMiddleware = createAuth.createServicesAuthMiddleware({
  enabledServices: ['caching', 'logging', 'dataservice']
});

app.use('/services/', servicesMiddleware);
```

---

### Session-based Authentication

```javascript
// Express session setup
const session = require('express-session');

app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true
}));

// Passport middleware
app.use(authService.middleware.passport);

// Protected route
app.get('/dashboard', (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.send('Dashboard');
});
```

---

## Analytics Module

The Analytics module automatically tracks login activity through event emission.

### Methods

#### `recordLogin(username)`

Records a successful login attempt.

---

#### `recordFailure(username)`

Records a failed login attempt.

---

#### `getTopUsers(limit = 10)`

Returns users sorted by login count.

**Returns:**
```javascript
[
  {
    username: string,
    loginCount: number,
    failedCount: number,
    lastLogin: string   // ISO format
  }
]
```

---

#### `getTopByRecency(limit = 100)`

Returns users sorted by most recent login.

**Returns:** Same format as `getTopUsers()`

---

#### `getOverview()`

Returns aggregated login statistics.

**Returns:**
```javascript
{
  totalUsers: number,
  totalLogins: number,
  totalFailures: number,
  lastLoginAt: string|null,  // ISO format
  generatedAt: string        // ISO format
}
```

---

## Web UI and Scripts

### HTML Templates

The Auth Service includes three main HTML templates:

#### `login.html`

Login form for user authentication.

**Features:**
- Username/password input
- Remember me checkbox
- Registration link
- Password reset link

---

#### `register.html`

User registration form.

**Features:**
- Username input
- Email input
- Password input
- Confirm password input
- Role selection

---

#### `index.html`

Main authentication dashboard.

**Features:**
- User status display
- Session information
- Login history
- User management (for admins)
- Role management

---

### Client-side Functions

#### Authentication

```javascript
// Login
async function login(username, password) {
  const response = await fetch('/services/authservice/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return response.json();
}

// Register
async function register(username, email, password, role) {
  const response = await fetch('/services/authservice/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, role })
  });
  return response.json();
}

// Logout
async function logout(token) {
  const response = await fetch('/services/authservice/api/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  return response.json();
}
```

---

#### User Management

```javascript
// Get current user
async function getCurrentUser() {
  const response = await fetch('/services/authservice/api/user/me');
  return response.json();
}

// Update profile
async function updateProfile(username, updates) {
  const response = await fetch(
    `/services/authservice/api/user/${username}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }
  );
  return response.json();
}

// List users (admin)
async function listUsers() {
  const response = await fetch('/services/authservice/api/users');
  return response.json();
}
```

---

#### Analytics

```javascript
// Get login analytics
async function getAnalytics() {
  const overview = await fetch('/services/authservice/api/analytics/overview')
    .then(r => r.json());
  const topUsers = await fetch('/services/authservice/api/analytics/top-users')
    .then(r => r.json());
  return { overview, topUsers };
}
```

---

## Event System

The Auth Service emits the following events through EventEmitter:

### User Events

- `auth:user-created` - User account created
- `auth:user-updated` - User information updated
- `auth:user-deleted` - User account deleted
- `auth:role-assigned` - User assigned to role

### Authentication Events

- `auth:login` - Successful login
- `auth:login-failed` - Failed login attempt
- `auth:logout` - User logout
- `auth:login-api` - Login via API endpoint

### Validation Events

- `auth:validation-error` - Input validation error

### Settings Events

- `auth:setting-changed` - Authentication setting changed

### Provider Events

- `auth:provider-initialized` - Provider initialized
- `auth:initialization-error` - Provider initialization failed
- `auth:passport-error` - Passport-related error

---

## Error Handling

### Common Errors

#### Invalid Credentials

```javascript
try {
  await authService.authenticateUser('user', 'wrong-password');
} catch (error) {
  if (error.message === 'Invalid credentials') {
    // Handle authentication failure
  }
}
```

#### User Already Exists

```javascript
try {
  await authService.createUser({
    username: 'alice',
    email: 'alice@example.com',
    password: 'pass123'
  });
} catch (error) {
  if (error.message === 'Username already exists') {
    // Handle duplicate user
  }
}
```

#### Session Expired

```javascript
try {
  await authService.validateSession(token);
} catch (error) {
  if (error.message === 'Session expired') {
    // Redirect to login
  }
}
```

#### User Not Found

```javascript
try {
  await authService.getUser('nonexistent');
} catch (error) {
  if (error.message === 'User not found') {
    // Handle missing user
  }
}
```

---

## Security Best Practices

### Password Security

1. **Hash Passwords**: Passwords are automatically hashed with SHA-256 + salt
2. **Use HTTPS**: Always transmit credentials over HTTPS
3. **Strong Passwords**: Enforce minimum password complexity
4. **Password Reset**: Implement secure password reset flow

### Session Security

1. **Session Timeout**: Sessions expire after 24 hours
2. **Token Validation**: Always validate tokens before processing requests
3. **CSRF Protection**: Implement CSRF tokens for state-changing operations
4. **Secure Cookies**: Use secure, httpOnly cookies for session tokens

### API Security

1. **API Key Protection**: Never commit API keys to version control
2. **Rate Limiting**: Implement rate limiting on login/register endpoints
3. **Input Validation**: All inputs are validated server-side
4. **SQL Injection Prevention**: Use parameterized queries (File/API providers)

### Role-Based Access Control

1. **Default Roles**: Use admin, user, guest roles
2. **Custom Roles**: Create application-specific roles as needed
3. **Permission Checks**: Always verify user role before sensitive operations

---

## Examples

### Example 1: Full Authentication Flow

```javascript
const createAuth = require('./src/authservice');
const EventEmitter = require('events');

async function main() {
  const eventEmitter = new EventEmitter();

  // Create auth service
  const authService = createAuth('memory', {
    createDefaultAdmin: true
  }, eventEmitter);

  // Listen to events
  eventEmitter.on('auth:user-created', (data) => {
    console.log('User created:', data.username);
  });

  eventEmitter.on('auth:login', (data) => {
    console.log('User logged in:', data.username);
  });

  // Register a new user
  const newUser = await authService.createUser({
    username: 'john.doe',
    email: 'john@example.com',
    password: 'SecurePass123!',
    role: 'user'
  });
  console.log('Registered:', newUser.username);

  // Authenticate the user
  const authResult = await authService.authenticateUser(
    'john.doe',
    'SecurePass123!'
  );
  console.log('Session token:', authResult.session.token);

  // Validate session
  const session = await authService.validateSession(authResult.session.token);
  console.log('Validated user:', session.username);

  // Update user
  await authService.updateUser('john.doe', {
    email: 'newemail@example.com'
  });

  // Logout
  await authService.logout(authResult.session.token);
  console.log('User logged out');
}

main().catch(console.error);
```

---

### Example 2: Role-Based Access Control

```javascript
async function setupRoles(authService) {
  // Get all users
  const users = await authService.listUsers();
  console.log('Total users:', users.length);

  // Get users in admin role
  const admins = await authService.getUsersInRole('admin');
  console.log('Admins:', admins.map(u => u.username));

  // Assign user to admin role
  await authService.addUserToRole('john.doe', 'admin');
  console.log('John promoted to admin');

  // Verify role
  const updatedUser = await authService.getUser('john.doe');
  console.log('User role:', updatedUser.role);
}
```

---

### Example 3: Express Middleware Integration

```javascript
const express = require('express');
const createAuth = require('./src/authservice');

const app = express();
const authService = createAuth('memory', {
  createDefaultAdmin: true
}, eventEmitter);

// Protect dashboard
const protectedDashboard = authService.createAuthMiddleware({
  loginPath: '/login',
  saveReferer: true
});

app.get('/dashboard', protectedDashboard, (req, res) => {
  res.send(`Welcome ${req.user.username}!`);
});

// API route with JSON error handling
const protectedApi = authService.createAuthMiddlewareWithHandler({
  onUnauthorized: (req, res) => {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

app.get('/api/profile', protectedApi, (req, res) => {
  res.json({ user: req.user });
});
```

---

### Example 4: Analytics and Monitoring

```javascript
async function displayAnalytics(authService) {
  // Get overview
  const overview = await authService.getStatus();
  console.log(`Users: ${overview.users}, Active Sessions: ${overview.activeSessions}`);

  // Get analytics
  const analytics = await authService.getPromptAnalytics?.();
  if (analytics) {
    console.log('Total logins:', analytics.totalLogins);
    console.log('Failed attempts:', analytics.totalFailures);

    // Top users by login count
    const topUsers = await authService.getTopUsers(5);
    console.log('Top 5 users:');
    topUsers.forEach(user => {
      console.log(`  ${user.username}: ${user.loginCount} logins`);
    });
  }
}
```

---

## Dependencies

### Core Dependencies
- `express` - Web framework
- `events` - EventEmitter for inter-service communication
- `crypto` - Password hashing (built-in Node.js)

### Provider-Specific Dependencies
- `passport` - Authentication middleware
- `passport-local` - Local strategy
- `passport-google-oauth20` - Google OAuth
- `express-session` - Session management

### Development
- `jest` - Testing framework

---

## File Structure

```
src/authservice/
├── index.js              # Factory function
├── middleware/
│   ├── apiKey.js        # API key middleware
│   ├── authenticate.js  # Session auth middleware
│   ├── passport.js      # Passport configuration
│   ├── services.js      # Service-to-service auth
│   └── index.js         # Middleware exports
├── modules/
│   └── analytics.js     # Login analytics
├── providers/
│   ├── authBase.js      # Base class
│   ├── authMemory.js    # Memory provider
│   ├── authFile.js      # File provider
│   ├── authPassport.js  # Passport provider
│   ├── authGoogle.js    # Google OAuth provider
│   └── authApi.js       # API proxy provider
├── routes/
│   └── index.js         # REST API routes
└── views/
    ├── index.js         # View setup
    ├── index.html       # Dashboard
    ├── login.html       # Login form
    └── register.html    # Registration form
```

---

## Additional Resources

- [Express.js Documentation](https://expressjs.com)
- [Passport.js Documentation](http://www.passportjs.org)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)

---

**Document Version:** 1.0.0
**Last Updated:** November 23, 2025
**Service Version:** 1.0.0
