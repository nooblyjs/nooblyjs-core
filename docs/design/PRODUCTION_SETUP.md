# Production Setup Guide

This guide provides step-by-step instructions for securely deploying Noobly JS Core to production.

## Table of Contents

1. [Security Configuration](#security-configuration)
2. [Environment Variables](#environment-variables)
3. [API Key Management](#api-key-management)
4. [Session Management](#session-management)
5. [Error Handling](#error-handling)
6. [Monitoring & Logging](#monitoring--logging)
7. [Deployment Checklist](#deployment-checklist)

## Security Configuration

### Node.js Version

- **Minimum**: Node.js 18.x (LTS)
- **Recommended**: Node.js 20.x or latest LTS
- **Deprecated**: Node.js < 18 is no longer supported for security updates

Update the Dockerfile:

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 11000
CMD ["node", "app.js"]
```

### Environment Setup

Create a `.env` file (excluded from version control) with:

```bash
# Node environment
NODE_ENV=production

# Server port
PORT=11000

# Session management (REQUIRED - generate a strong random value)
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# API key authentication (REQUIRED - provide secure keys)
API_KEYS=key1,key2,key3

# Database configuration (if using external databases)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
MONGODB_USER=your_user
MONGODB_PASSWORD=your_password

# Redis/Cache configuration
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# AI Service configuration
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# Logging configuration
LOG_LEVEL=info
```

### Never Store in .env

These should ALWAYS be managed by your deployment platform (AWS Secrets Manager, Azure Key Vault, etc.):

- `SESSION_SECRET`
- `API_KEYS`
- `API_KEY`
- Database credentials
- Third-party API keys

## Environment Variables

### Required Variables

| Variable | Description | Example | Notes |
|----------|-------------|---------|-------|
| `NODE_ENV` | Execution environment | `production` | Enables production optimizations and security checks |
| `SESSION_SECRET` | Session encryption key | 64-char hex string | Use `openssl rand -hex 32` to generate |
| `API_KEYS` | Valid API authentication keys | `key1,key2,key3` | Comma-separated, minimum 32 chars each |
| `PORT` | Server listen port | `11000` | Use 443 with reverse proxy for HTTPS |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging verbosity | `info` |
| `MONGODB_URI` | MongoDB connection string | (memory storage used) |
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |

## API Key Management

### Generating Secure API Keys

**Using OpenSSL:**

```bash
# Generate a 32-byte (256-bit) key in hex format
openssl rand -hex 32
# Output: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

**Using Node.js:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Key Rotation Strategy

1. **Generate new keys** using the methods above
2. **Add new keys** to `API_KEYS` environment variable (comma-separated)
3. **Deploy** the updated configuration
4. **Wait** for all clients to migrate to new keys
5. **Remove** old keys from configuration
6. **Redeploy** the service

Example transition:

```bash
# Step 1: Add new key
API_KEYS=old_key_1,old_key_2,new_key_1,new_key_2

# Step 2-4: Monitor usage, allow migration period

# Step 5-6: Remove old keys
API_KEYS=new_key_1,new_key_2
```

### API Key Best Practices

- **Minimum length**: 32 characters
- **Character set**: Alphanumeric (uppercase, lowercase, numbers)
- **Rotation frequency**: Every 90 days
- **Storage**: Use your deployment platform's secrets management (AWS Secrets Manager, Azure Key Vault, Kubernetes Secrets)
- **Access control**: Limit key access to authorized services only
- **Monitoring**: Log and alert on failed authentication attempts

## Session Management

### Session Secret Configuration

The session secret is used to encrypt session cookies. It MUST be:

1. **Cryptographically random**: Generated using `openssl rand` or `crypto.randomBytes()`
2. **Long enough**: At least 32 bytes (256 bits) of entropy
3. **Unique per environment**: Different values for dev, staging, and production
4. **Rotated periodically**: Every 6 months or after security incidents

### Secure Session Configuration

The application automatically configures sessions securely in production:

```javascript
// Automatically enforced in production mode (NODE_ENV=production):
cookie: {
  secure: true,        // Only transmitted over HTTPS
  httpOnly: true,      // Not accessible to JavaScript
  sameSite: 'strict',  // Prevents CSRF attacks
  maxAge: 24 * 60 * 60 * 1000 // 24-hour expiration
}
```

**Note**: In development, `secure: false` is used to allow HTTP. In production, HTTPS is enforced.

### Session Storage in Production

For multi-instance deployments, use external session storage:

```javascript
const RedisStore = require('connect-redis').default;
const redis = require('redis');

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict'
  }
}));
```

## Error Handling

### Production Error Responses

In production, error responses hide sensitive information:

```javascript
// Production response (NODE_ENV=production)
{
  "error": {
    "message": "Internal Server Error"
  }
}

// Development response (NODE_ENV=development)
{
  "error": {
    "message": "Database connection failed: ECONNREFUSED",
    "stack": "Error: Database connection failed...\n    at ..."
  }
}
```

### Service Failure Handling

Services implement circuit breaker patterns to prevent cascading failures:

```javascript
// Example: Circuit breaker state transitions
Closed     → Service operating normally
     ↓ (failures exceed threshold)
Open       → Service unavailable, fast-fail
     ↓ (timeout elapsed)
Half-Open  → Limited requests allowed to test recovery
     ↓ (recovery successful)
Closed     → Resume normal operations
```

### Error Logging

All errors are logged to:

- **File**: `./.application/logs/` (rotating daily)
- **Console**: JSON formatted for log aggregation services
- **External**: Configure external logging service via logging provider

Configure logging provider in `app.js`:

```javascript
// File-based logging (default)
const log = serviceRegistry.logger('file');

// External logging (e.g., Datadog, ELK)
const log = serviceRegistry.logger('api', {
  endpoint: process.env.LOG_SERVICE_URL,
  apiKey: process.env.LOG_SERVICE_KEY
});
```

## Monitoring & Logging

### Log Levels

Configure appropriate log levels for production:

```bash
# Production: Minimal verbose output
LOG_LEVEL=info

# Staging: Detailed for debugging
LOG_LEVEL=debug

# Development: Very detailed
LOG_LEVEL=trace
```

### System Monitoring Endpoints

The service registry provides monitoring endpoints:

- `GET /services/api/monitoring/metrics` - System metrics (CPU, memory, event loop)
- `GET /services/api/monitoring/snapshot` - Current performance snapshot

Protect these endpoints with authentication:

```javascript
// These endpoints automatically respect authentication configured in SERVICE_AUTH
// If API keys are required, include them in requests:
curl -H "X-API-Key: your-api-key" \
  https://api.example.com/services/api/monitoring/metrics
```

### Health Checks

Add a health check endpoint for load balancers:

```javascript
app.get('/health', (req, res) => {
  // Quick health check (doesn't count towards API quota)
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### Setting Alerts

Configure alerts for:

- **High error rate**: > 1% of requests return errors
- **Slow response times**: 95th percentile > 1000ms
- **Service failures**: External service connection failures
- **Memory leaks**: Heap size continuously increasing
- **Failed authentications**: > 5 failed API key attempts per minute

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured in deployment platform
- [ ] `SESSION_SECRET` is a random 32+ character value
- [ ] `API_KEYS` configured with 2+ unique keys (32+ chars each)
- [ ] `NODE_ENV` set to `production`
- [ ] Database connections tested (if using MongoDB/DocumentDB)
- [ ] Redis connection tested (if using for caching/sessions)
- [ ] SSL/TLS certificate installed on reverse proxy
- [ ] Secrets not committed to version control
- [ ] All critical tests passing (`npm test`)
- [ ] Docker image built with Node 18+ LTS

### Deployment

- [ ] Run database migrations (if applicable)
- [ ] Deploy application with new environment variables
- [ ] Verify all services are accessible
- [ ] Check log files for startup errors
- [ ] Verify API key authentication is working
- [ ] Test health check endpoint

### Post-Deployment

- [ ] Monitor error logs for new issues
- [ ] Check performance metrics (response time, CPU, memory)
- [ ] Verify external service integrations (databases, APIs)
- [ ] Test user authentication workflows
- [ ] Conduct security scan for exposed secrets
- [ ] Schedule follow-up monitoring review in 24 hours

### Ongoing Production Operations

- [ ] Daily review of error logs
- [ ] Weekly review of performance metrics
- [ ] Monthly security audit
- [ ] Quarterly key rotation
- [ ] Automated backup verification (if using databases)
- [ ] Update dependencies monthly (security patches)

## Troubleshooting

### "SESSION_SECRET is not set" Error

**Solution**: Set the environment variable before starting the application:

```bash
export SESSION_SECRET=$(openssl rand -hex 32)
node app.js
```

### "No API keys configured" Error

**Solution**: Set the API_KEYS environment variable:

```bash
export API_KEYS=key1,key2,key3
node app.js
```

### Services failing to initialize

**Check**:

1. All required databases are accessible (Redis, MongoDB if configured)
2. Environment variables are correctly set
3. Service dependencies are available
4. Log files in `./.application/logs/` for detailed errors

### High memory usage

**Typical causes**:

- Logging service not rotating logs (check `./.application/logs/`)
- Cache not evicting old entries (check TTL configuration)
- Database connections not pooling

**Solution**: Review the Performance Monitoring documentation at `docs/PERFORMANCE_MONITORING.md`

## References

- [CLAUDE.md](../CLAUDE.md) - Application architecture and service documentation
- [Performance Monitoring](./PERFORMANCE_MONITORING.md) - Performance tracking and optimization
- [Security Audit](./SECURITY_AUDIT.md) - Security best practices and audit procedures
