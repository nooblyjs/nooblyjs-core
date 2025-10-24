# Login Success Redirect URL Feature

## Overview

The authservice now supports automatic capture and override of login success redirect URLs. This feature allows:

1. **Automatic Referrer Capture**: When a user is redirected to the login page due to authentication requirement, the original URL they were trying to access is automatically captured.
2. **Developer Override**: Developers can configure a fixed `loginSuccessRedirectUrl` in the options that will always be used instead of the captured referrer.
3. **Fallback Hierarchy**: The redirect URL is determined in this order:
   - Developer-configured `loginSuccessRedirectUrl` (highest priority)
   - Captured/requested `returnUrl` parameter
   - Default `/services` (lowest priority)

## Configuration

### Basic Setup

Add the `loginSuccessRedirectUrl` option when initializing the authservice:

```javascript
const serviceRegistry = require('./index.js');
const EventEmitter = require('events');
const express = require('express');

const app = express();
const eventEmitter = new EventEmitter();

const options = {
  'express-app': app,
  logDir: './logs',
  dataDir: './data',

  // NEW: Configure login success redirect URL
  loginSuccessRedirectUrl: '/dashboard', // Always redirect here after login
};

serviceRegistry.initialize(app, eventEmitter, options);
```

### Without Override (Default Behavior)

If you don't specify `loginSuccessRedirectUrl`, the system will:
1. Use the captured `returnUrl` from the original request
2. Fall back to `/services` if no `returnUrl` is provided

```javascript
const options = {
  'express-app': app,
  // loginSuccessRedirectUrl not specified - uses captured referrer
};
```

## How It Works

### Login Flow

1. **User tries to access protected resource** (e.g., `/services/admin`)
2. **Middleware redirects to login** with encoded original URL:
   ```
   /services/authservice/views/login.html?returnUrl=%2Fservices%2Fadmin
   ```

3. **User logs in successfully**
4. **Server returns redirect URL** in JSON response:
   ```json
   {
     "success": true,
     "redirectUrl": "/dashboard"  // or captured returnUrl
   }
   ```

5. **Frontend redirects user** to the returned URL

### Registration Flow

When users register through `/services/authservice/views/register.html?returnUrl=/path`:

1. **User fills in registration form**
2. **Account is created**
3. **User is redirected to login** with the original `returnUrl` preserved:
   ```
   /services/authservice/views/login.html?returnUrl=%2Fpath
   ```
4. **Login succeeds** with the same redirect behavior

## API Endpoints

### POST /services/authservice/api/login

**Request:**
```javascript
{
  "username": "john_doe",
  "password": "password123",
  "returnUrl": "/optional-explicit-return-url"  // Optional, overrides captured URL
}
```

**Response:**
```javascript
{
  "success": true,
  "message": "Login successful",
  "redirectUrl": "/dashboard",  // Determined by override > returnUrl > default
  "data": {
    "user": { /* user data */ },
    "session": { "token": "...", "expiresAt": "..." }
  }
}
```

### POST /services/authservice/api/passport/login

Same behavior as standard login endpoint, also supports `returnUrl` in request body.

### GET /services/authservice/api/google/callback

Google OAuth callback automatically includes `redirectUrl` in response when:
- Developer has configured `loginSuccessRedirectUrl`
- User was redirected from initial Google auth initiation with `?returnUrl=...`

## Frontend Implementation

### Login Page (login.html)

The login page automatically:
- Reads `returnUrl` from query parameters
- Passes it in the login request body
- Uses the `redirectUrl` from server response to redirect user

```javascript
// Automatic handling in login.html
const response = await fetch('/services/authservice/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'user',
    password: 'pass',
    returnUrl: returnUrl  // Captured from query param
  })
});

const result = await response.json();
window.location.href = result.redirectUrl;  // Use server-provided redirect
```

### Register Page (register.html)

The register page:
- Preserves `returnUrl` across registration flow
- Redirects to login with the original `returnUrl` intact
- Sign-in link includes `returnUrl` if present

```javascript
// Register form preserves returnUrl for login redirect
if (returnUrl) {
  loginUrl += '?returnUrl=' + encodeURIComponent(returnUrl);
}
```

### Services Middleware

The `/services` route protection automatically:
- Captures the original URL
- Redirects unauthenticated users to login with `returnUrl` parameter
- Returns client-side handling script that manages the redirect flow

## Use Cases

### 1. Force Dashboard After Login

```javascript
const options = {
  loginSuccessRedirectUrl: '/dashboard'
};
```

All users are redirected to `/dashboard` after login, regardless of their original destination.

### 2. Smart Redirect with Override

```javascript
const options = {
  loginSuccessRedirectUrl: process.env.LOGIN_REDIRECT_URL || null
};
```

Use environment variable to control redirect; if not set, use captured referrer.

### 3. Role-Based Redirect (Application Level)

The authservice returns user role in the session, allowing applications to implement role-based redirects:

```javascript
// In your application logic
if (user.role === 'admin') {
  redirectUrl = '/admin-dashboard';
} else {
  redirectUrl = result.redirectUrl;  // Use default redirect
}
```

## Backward Compatibility

This feature is **fully backward compatible**:

- Existing implementations without `loginSuccessRedirectUrl` continue to work
- The `returnUrl` query parameter is still captured automatically
- Default behavior redirects to `/services`
- All existing login flows are preserved

## Modified Files

The following files were updated to implement this feature:

1. **src/authservice/routes/index.js**
   - Added `returnUrl` parameter handling in login endpoint
   - Added `redirectUrl` to login responses
   - Updated Passport and Google OAuth endpoints

2. **src/authservice/views/login.html**
   - Passes `returnUrl` in login request body
   - Uses `redirectUrl` from server response

3. **src/authservice/views/register.html**
   - Preserves `returnUrl` through registration flow
   - Maintains `returnUrl` when redirecting to login

4. **src/authservice/providers/authGoogle.js**
   - Enhanced `handleGoogleAuth_()` to accept and return `returnUrl`
   - Updated `initiateGoogleAuth()` to store `returnUrl` in session
   - Enhanced `handleGoogleCallback()` to retrieve and pass `returnUrl`

## Testing

### Test Login with Override

```bash
curl -X POST http://localhost:3001/services/authservice/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "returnUrl": "/admin-panel"
  }'

# Response includes redirectUrl based on configuration
```

### Test Captured Referrer

1. Try accessing: `http://localhost:3001/services/admin-panel`
2. Get redirected to: `http://localhost:3001/services/authservice/views/login.html?returnUrl=%2Fservices%2Fadmin-panel`
3. After login, redirected back to: `/services/admin-panel` (or override if configured)

### Test Registration Flow

1. Access: `http://localhost:3001/services/authservice/views/register.html?returnUrl=/myapp`
2. Complete registration
3. Redirected to: `http://localhost:3001/services/authservice/views/login.html?returnUrl=%2Fmyapp`
4. After login, redirected to: `/myapp`

## Configuration Examples

### Example 1: Always Go to Dashboard

```javascript
const options = {
  'express-app': app,
  loginSuccessRedirectUrl: '/dashboard'
};
```

### Example 2: Environment-Based Redirect

```javascript
const options = {
  'express-app': app,
  loginSuccessRedirectUrl: process.env.LOGIN_REDIRECT || null
};
```

### Example 3: Production vs Development

```javascript
const isDevelopment = process.env.NODE_ENV === 'development';
const options = {
  'express-app': app,
  loginSuccessRedirectUrl: isDevelopment ? null : '/app/dashboard'
};
```

## Notes

- The `loginSuccessRedirectUrl` override takes precedence over all captured URLs
- Session-based OAuth flows automatically store the `returnUrl` for use in callbacks
- The system properly URL-encodes all redirect parameters
- Expired or invalid sessions are handled gracefully with default redirects
