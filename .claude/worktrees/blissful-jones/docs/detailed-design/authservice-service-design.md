# AuthService (`src/authservice/`)

**Dependency level:** 4 – Integration
**Dependencies:** `logging`, `caching`, `dataservice`

Provides user authentication and authorization. Supports multiple strategies: local file/memory storage, Passport.js, Google OAuth, and secure email (magic link). Also exposes middleware helpers for API key protection and session-based route guarding.

---

## Factory (`src/authservice/index.js`)

```javascript
const auth = registry.authservice('file', { dataDir: './.application/data' });
const googleAuth = registry.authservice('google', {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
});
```

### `createAuth(type, options, eventEmitter)` → auth instance

| `type` value | Provider class | Description |
|---|---|---|
| `'memory'` (default) | `AuthMemory` | In-memory user store |
| `'file'` | `AuthFile` | JSON file-backed user store |
| `'passport'` | `AuthPassport` | Passport.js local strategy |
| `'google'` | `AuthGoogle` | Google OAuth 2.0 via Passport |
| `'api'` | `AuthApi` | Delegates to remote auth API |
| `'secure-email'` | `AuthSecureEmail` | Email magic-link authentication |

**After creating the provider:**
1. Creates `AuthAnalytics` instance.
2. Registers REST routes and dashboard view.
3. Attaches `auth.passportConfigurator(customStrategyFactory?)` helper method.

**Static exports on `createAuth`:**
- `createAuth.middleware` – the full middleware module
- `createAuth.createApiKeyAuthMiddleware` – API key middleware factory
- `createAuth.generateApiKey` – API key generator
- `createAuth.isValidApiKeyFormat` – key format validator
- `createAuth.createServicesAuthMiddleware` – services dashboard auth factory
- `createAuth.configurePassport` – Passport configuration helper
- `createAuth.passportConfigurator` – curried configurator factory
- `createAuth.createAuthMiddleware` – generic auth middleware
- `createAuth.createAuthMiddlewareWithHandler` – auth middleware with custom handler

---

## Middleware (`src/authservice/middleware/`)

### `createApiKeyAuthMiddleware(options, eventEmitter)` → Express middleware

Protects routes with API key authentication.

**Options:**
- `apiKeys` – array of valid key strings.
- `requireApiKey` – boolean (default: `true` when keys are provided).
- `excludePaths` – array of path patterns to skip (supports `*` glob).

**Behaviour:**
- Reads key from `x-api-key` header, `Authorization: Bearer <key>` header, or `?api_key=` query parameter.
- Returns `401` if key is required but missing/invalid.
- Calls `next()` if valid or path is excluded.

### `createServicesAuthMiddleware(registry)` → Express middleware

Protects the `/services/` dashboard routes with session-based login. Redirects to the auth service login page if no authenticated session is found.

### `generateApiKey(length)` → `string`

Generates a cryptographically random API key using `crypto.randomBytes`. Default length: 32 characters (hex).

### `isValidApiKeyFormat(key)` → `boolean`

Validates that a key matches the expected format.

### `configurePassport(strategyFactoryOrConfig, passportInstance?)` → Passport instance

Configures Passport.js with the given strategy. Called during auth setup.

### `authenticate(options)` → Express middleware

Generic authentication middleware wrapping Passport.

---

## Auth Providers

### `AuthMemory` (`providers/authMemory.js`)

Stores users and roles in a JavaScript Map. Not persistent – data is lost on restart.

**Key option:** `createDefaultAdmin` – if `true`, creates an `admin` user on initialization.

### `AuthFile` (`providers/authFile.js`)

Stores users and roles in JSON files on disk.

**Key option:** `dataDir` – directory for user/role JSON files.

Data files:
- `<dataDir>/auth/users.json`
- `<dataDir>/auth/roles.json`

### `AuthPassport` (`providers/authPassport.js`)

Integrates Passport.js local strategy. Handles `serializeUser` and `deserializeUser` for session persistence.

### `AuthGoogle` (`providers/authGoogle.js`)

Uses `passport-google-oauth20`. Handles the OAuth 2.0 flow:
1. Redirect to Google login.
2. Google redirects back with auth code.
3. Exchange code for tokens.
4. Store/retrieve user profile.

**Required options:** `clientID`, `clientSecret`, `callbackURL`

### `AuthSecureEmail` (`providers/authSecureEmail.js`)

Implements email-based magic link authentication:
1. User requests a login link via email.
2. A signed token is generated and emailed.
3. User clicks the link and the token is verified.
4. Session is established.

### `AuthApi` (`providers/authApi.js`)

Delegates all auth operations to a remote HTTP API endpoint. Useful for federated authentication in a microservice setup.

---

## Auth Base Class (`providers/authBase.js`)

Shared interface for all auth providers. Common methods:

#### `async register(email, password, userData)` → `Object`

Creates a new user account. Returns the created user object.

#### `async authenticate(email, password)` → `Object | null`

Verifies credentials. Returns user object on success, `null` on failure.

#### `async getUser(userId)` → `Object | null`

Retrieves a user by ID.

#### `async updateUser(userId, updates)` → `Object`

Updates user profile data.

#### `async deleteUser(userId)` → `boolean`

Removes a user account.

#### `async listUsers()` → `Object[]`

Returns all users (without passwords).

#### `hasPermission(user, role)` → `boolean`

Checks if a user has a specific role.

#### `async getSettings()` / `async saveSettings(settings)`

Standard settings management.

---

## Analytics (`src/authservice/modules/analytics.js`)

Tracks:
- Login attempts (success / failure)
- Registration events
- Active sessions

---

## Routes

Mounted at `/services/authservice/api/`:

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/services/authservice/api/login` | No | Authenticate user |
| `POST` | `/services/authservice/api/register` | No | Register new user |
| `POST` | `/services/authservice/api/logout` | Yes | End session |
| `GET` | `/services/authservice/api/user` | Yes | Get current user |
| `GET` | `/services/authservice/api/users` | Yes (admin) | List all users |
| `PUT` | `/services/authservice/api/user/:id` | Yes | Update user |
| `DELETE` | `/services/authservice/api/user/:id` | Yes (admin) | Delete user |
| `GET` | `/services/authservice/api/status` | No | Service status |
| `POST` | `/services/authservice/api/settings` | Yes | Update settings |

Google OAuth routes (when using google provider):
- `GET /services/authservice/api/auth/google` – initiates OAuth flow
- `GET /services/authservice/api/auth/google/callback` – OAuth callback

---

## Usage

```javascript
// Register a user
const user = await auth.register('alice@example.com', 'SecurePass123', {
  name: 'Alice Smith',
  role: 'user'
});

// Authenticate
const authenticated = await auth.authenticate('alice@example.com', 'SecurePass123');
if (authenticated) {
  console.log('Login successful:', authenticated.id);
}

// Check permission
const canEdit = auth.hasPermission(authenticated, 'editor');
```

---

## Protecting Custom Routes

```javascript
const { createAuthMiddleware } = require('./src/authservice/middleware');

const requireLogin = createAuthMiddleware({ redirectTo: '/login' });

app.get('/admin', requireLogin, (req, res) => {
  res.send('Admin panel');
});
```
