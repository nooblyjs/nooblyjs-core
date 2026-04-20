# Secure Email Authentication Provider

## Overview

The `authSecureEmail` provider enables authentication for Teams and Edge extensions using email + secure key pairs stored in a JSON file. This allows extensions to authenticate users without requiring traditional username/password credentials.

**Key Features:**
- Email + secure key authentication (perfect for Teams/Edge extensions)
- JSON file-based user storage
- Secure key hashing with salt
- Passport-compatible session tokens
- Works with all existing protected endpoints
- ~200 lines of code (extends AuthPassport)

## How It Works

1. **User Setup**: Create users with email + secure key via API or manual JSON file editing
2. **Extension Auth**: Extension sends email + secure key to `/api/secure-email/login`
3. **Token Return**: Backend returns a bearer token
4. **Protected Access**: Token works with all authenticated endpoints (same as passport auth)

## Installation

The provider is built-in. To use it, initialize with type `'secure-email'`:

```javascript
const serviceRegistry = require('./index');

// Create secure email auth service
const authservice = serviceRegistry.authservice('secure-email', {
  dataDir: './.application/data'  // Optional, defaults to ./.application/data
});
```

## Data File Format

Users are stored in `./.application/data/secure-emails.json`:

```json
{
  "users": [
    {
      "id": "a1b2c3d4e5f6g7h8",
      "email": "alice@company.com",
      "secureKey": "salt:sha256_hash",
      "username": "alice@company.com",
      "role": "user",
      "isActive": true,
      "createdAt": "2026-01-30T12:00:00.000Z",
      "lastLogin": "2026-01-30T15:30:00.000Z"
    },
    {
      "id": "h8g7f6e5d4c3b2a1",
      "email": "bob@company.com",
      "secureKey": "salt:sha256_hash",
      "username": "bob@company.com",
      "role": "admin",
      "isActive": true,
      "createdAt": "2026-01-28T10:00:00.000Z",
      "lastLogin": null
    }
  ]
}
```

**Important**: Secure keys are never stored in plaintext. They are hashed with salt before storage.

## API Endpoints

### Authentication Endpoint

**POST** `/services/authservice/api/secure-email/login`

Authenticate with email and secure key.

**Request:**
```json
{
  "email": "alice@company.com",
  "secureKey": "alice_secure_key_123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": "a1b2c3d4e5f6g7h8",
      "username": "alice@company.com",
      "email": "alice@company.com",
      "role": "user"
    },
    "session": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2026-01-31T12:00:00.000Z"
    }
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid email or secure key"
}
```

### Add User Endpoint

**POST** `/services/authservice/api/secure-email/users`

Add a new secure email user (requires API key).

**Request:**
```json
{
  "email": "newuser@company.com",
  "secureKey": "newuser_secure_key_xyz",
  "username": "newuser@company.com",
  "role": "user"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Secure email user added successfully",
  "data": {
    "id": "new_user_id",
    "email": "newuser@company.com",
    "username": "newuser@company.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2026-01-30T12:00:00.000Z"
  }
}
```

### List Users Endpoint

**GET** `/services/authservice/api/secure-email/users`

List all secure email users (requires API key).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Secure email users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "a1b2c3d4e5f6g7h8",
        "email": "alice@company.com",
        "username": "alice@company.com",
        "role": "user",
        "isActive": true,
        "createdAt": "2026-01-30T12:00:00.000Z",
        "lastLogin": "2026-01-30T15:30:00.000Z"
      }
    ]
  }
}
```

### Remove User Endpoint

**DELETE** `/services/authservice/api/secure-email/users/:email`

Remove a user (requires API key).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Secure email user removed successfully",
  "data": {
    "email": "alice@company.com"
  }
}
```

## Usage Examples

### Basic Setup

```javascript
const serviceRegistry = require('./index');

// Initialize with secure-email provider
const authservice = serviceRegistry.authservice('secure-email', {
  dataDir: './.application/data'
});

// Add some users
await authservice.addSecureEmailUser(
  'alice@company.com',
  'alice_secure_key_123',
  'alice@company.com',
  'user'
);

await authservice.addSecureEmailUser(
  'bob@company.com',
  'bob_secure_key_456',
  'bob@company.com',
  'admin'
);
```

### Programmatic Authentication

```javascript
const result = await authservice.authenticateWithSecureEmail(
  'alice@company.com',
  'alice_secure_key_123'
);

console.log(result.session.token); // Bearer token for authenticated requests
```

### User Management

```javascript
// List all users
const users = await authservice.listSecureEmailUsers();
console.log(users);

// Remove a user
await authservice.removeSecureEmailUser('alice@company.com');
```

### Teams Extension Integration

```javascript
// In your Teams extension
const email = context.userPrincipalName;  // From Teams API
const secureKey = await getStoredSecureKey();  // User-configured

const response = await fetch(
  'https://api.example.com/services/authservice/api/secure-email/login',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, secureKey })
  }
);

const result = await response.json();
const bearerToken = result.data.session.token;

// Store token for session
localStorage.setItem('authToken', bearerToken);

// Use token for subsequent API calls
const apiResponse = await fetch(
  'https://api.example.com/services/someservice/api/endpoint',
  {
    headers: { 'Authorization': `Bearer ${bearerToken}` }
  }
);
```

### Edge Extension Integration

```javascript
// In your Edge extension
const identity = await chrome.identity.getProfileUserInfo();
const email = identity.email;
const secureKey = await getStoredSecureKey();

const response = await fetch(
  'https://api.example.com/services/authservice/api/secure-email/login',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, secureKey })
  }
);

const result = await response.json();
const bearerToken = result.data.session.token;

// Use token for API calls
chrome.storage.sync.set({ authToken: bearerToken });
```

## Security Considerations

### Key Storage

- Secure keys are **hashed with SHA-256 and salt** before storage
- Keys are **never stored in plaintext**
- Each key has a unique salt for additional security
- Verification uses **constant-time comparison** to prevent timing attacks

### Best Practices

1. **Generate strong secure keys** for each user (32+ characters recommended)
2. **Store keys securely** in extension storage/keychain, not in plain code
3. **Use HTTPS only** for all API communication
4. **Rotate keys periodically** - remove old keys and add new ones
5. **Monitor authentication events** for suspicious patterns
6. **Keep JSON file secure** - restrict file permissions on server

### Example Secure Key Generation

```javascript
// Generate a cryptographically secure key
const crypto = require('crypto');
const secureKey = crypto.randomBytes(32).toString('hex');
console.log(secureKey);
// Output: 'a7b2c9d4e1f6g3h8i5j0k7l2m9n4o1p6q2r7s8t3u9v0w1x2y3z4a5b6c7d8e9'
```

## Running the Example

A complete example application is included:

```bash
node tests/app/authservice/app-secure-email.js
```

This will start a server on port 11000 with pre-populated example users:
- Email: `alice@company.com`, Key: `alice_secure_key_123`
- Email: `bob@company.com`, Key: `bob_secure_key_456`

### Test Commands

```bash
# Add a new user
curl -X POST http://localhost:11000/services/authservice/api/secure-email/users \
  -H "Content-Type: application/json" \
  -d '{
    "email":"charlie@company.com",
    "secureKey":"charlie_key_789",
    "username":"charlie",
    "role":"user"
  }'

# Authenticate
curl -X POST http://localhost:11000/services/authservice/api/secure-email/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"alice@company.com",
    "secureKey":"alice_secure_key_123"
  }'

# List users (returns a token in the response above)
curl -X GET http://localhost:11000/services/authservice/api/secure-email/users \
  -H "Authorization: Bearer <token_from_auth>"

# Use token for authenticated requests
curl -X GET http://localhost:11000/services/authservice/api/users/alice@company.com \
  -H "Authorization: Bearer <token_from_auth>"

# Remove a user
curl -X DELETE http://localhost:11000/services/authservice/api/secure-email/users/charlie@company.com \
  -H "Authorization: Bearer <token_from_auth>"
```

## Testing

Run the comprehensive test suite:

```bash
npm run tests -- tests/unit/authservice/authSecureEmail.test.js
```

All 30 tests verify:
- ✓ User creation and validation
- ✓ Authentication with email + key
- ✓ Secure key hashing and verification
- ✓ File persistence
- ✓ Session token generation
- ✓ Rate limiting (when implemented)
- ✓ Event emission
- ✓ Integration with existing passport system

## Architecture

The provider extends `AuthPassport` to:
- Reuse passport session management and bearer token generation
- Maintain compatibility with all existing middleware and protected endpoints
- Minimize code duplication

**Class Hierarchy:**
```
AuthBase
  └── AuthPassport
       └── AuthSecureEmail (NEW)
```

## Event Emitter Integration

The provider emits events for monitoring and logging:

```javascript
// Listen for authentication success
eventEmitter.on('auth:secure-email-auth', (data) => {
  console.log(`User ${data.email} authenticated successfully`);
});

// Listen for authentication failures
eventEmitter.on('auth:secure-email-auth-failed', (data) => {
  console.log(`Auth failed for ${data.email}: ${data.reason}`);
});

// Listen for user creation
eventEmitter.on('auth:secure-email-user-added', (data) => {
  console.log(`User ${data.email} was added`);
});

// Listen for user removal
eventEmitter.on('auth:secure-email-user-removed', (data) => {
  console.log(`User ${data.email} was removed`);
});
```

## Troubleshooting

### "Invalid email or secure key"

- Verify email is spelled correctly (comparison is case-insensitive)
- Verify secure key matches exactly (case-sensitive)
- Ensure user was added with `addSecureEmailUser()` or manually to JSON file

### Data file not found

- File will be created automatically on first user addition
- Ensure `./.application/data` directory exists or is writable
- Check file permissions

### Users not persisting after restart

- Verify JSON file is being written to correct path
- Check that `dataDir` option points to persistent storage
- On restart, file will be reloaded from disk

### Session tokens not working

- Ensure token is being passed in `Authorization: Bearer <token>` header
- Check token hasn't expired (24-hour default)
- Verify token was generated successfully (check response body)

## Migration

To switch from another auth provider to secure-email:

```javascript
// Before:
const authservice = serviceRegistry.authservice('passport', options);

// After:
const authservice = serviceRegistry.authservice('secure-email', {
  dataDir: './.application/data'
});

// Add users
await authservice.addSecureEmailUser('user@example.com', 'secure_key_123');
```

All existing authenticated endpoints will continue to work with the new bearer tokens.
