# NooblyJS Core - Security Improvements

**Version:** 1.0.14+
**Date:** 2024-11-05
**Priority:** Critical

---

## Security Assessment Summary

The current nooblyjs-core implementation has several security vulnerabilities that need immediate attention. This document outlines specific security improvements with implementation details.

---

## Critical Security Issues

### 1. API Key Security

**Current Vulnerabilities:**
- API keys stored in plain text
- Keys transmitted in query parameters (logged in access logs)
- No key rotation mechanism
- No key scoping or permissions

**Immediate Fixes:**

```javascript
// Enhanced API Key Manager
const crypto = require('crypto');
const bcrypt = require('bcrypt');

class SecureApiKeyManager {
  constructor(options = {}) {
    this.saltRounds = options.saltRounds || 12;
    this.keyStore = new Map(); // In production, use encrypted database
    this.keyMetadata = new Map();
  }

  async createApiKey(scopes = [], expiresIn = '1y', description = '') {
    const keyId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString('base64url');
    const fullKey = `njs_${keyId}_${secret}`;
    
    // Hash the secret part for storage
    const hashedSecret = await bcrypt.hash(secret, this.saltRounds);
    
    const metadata = {
      keyId,
      hashedSecret,
      scopes,
      description,
      created: new Date(),
      expires: new Date(Date.now() + this.parseExpiry(expiresIn)),
      lastUsed: null,
      usageCount: 0,
      active: true
    };
    
    this.keyStore.set(keyId, hashedSecret);
    this.keyMetadata.set(keyId, metadata);
    
    return {
      apiKey: fullKey,
      keyId,
      scopes,
      expires: metadata.expires
    };
  }

  async validateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('njs_')) {
      return { valid: false, reason: 'Invalid key format' };
    }

    const parts = apiKey.split('_');
    if (parts.length !== 3) {
      return { valid: false, reason: 'Invalid key structure' };
    }

    const [, keyId, secret] = parts;
    const metadata = this.keyMetadata.get(keyId);
    
    if (!metadata) {
      return { valid: false, reason: 'Key not found' };
    }

    if (!metadata.active) {
      return { valid: false, reason: 'Key deactivated' };
    }

    if (metadata.expires < new Date()) {
      return { valid: false, reason: 'Key expired' };
    }

    const hashedSecret = this.keyStore.get(keyId);
    const isValid = await bcrypt.compare(secret, hashedSecret);
    
    if (isValid) {
      // Update usage statistics
      metadata.lastUsed = new Date();
      metadata.usageCount++;
      
      return {
        valid: true,
        keyId,
        scopes: metadata.scopes,
        metadata
      };
    }

    return { valid: false, reason: 'Invalid key' };
  }

  async rotateApiKey(keyId) {
    const metadata = this.keyMetadata.get(keyId);
    if (!metadata) {
      throw new Error('Key not found');
    }

    // Create new key with same permissions
    const newKey = await this.createApiKey(
      metadata.scopes,
      '1y',
      `Rotated from ${keyId}`
    );

    // Mark old key for deprecation (don't delete immediately)
    metadata.active = false;
    metadata.rotatedTo = newKey.keyId;
    metadata.rotatedAt = new Date();

    return newKey;
  }
}
```

### 2. Input Validation & Sanitization

**Current Vulnerabilities:**
- Basic string validation only
- No protection against injection attacks
- Missing data sanitization

**Implementation:**

```javascript
const Joi = require('joi');
const DOMPurify = require('isomorphic-dompurify');

class InputValidator {
  static schemas = {
    cacheKey: Joi.string()
      .min(1)
      .max(250)
      .pattern(/^[a-zA-Z0-9:._-]+$/)
      .required(),
    
    containerName: Joi.string()
      .min(1)
      .max(100)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required(),
    
    jsonObject: Joi.object()
      .max(100) // Max 100 properties
      .unknown(true)
      .custom((value, helpers) => {
        // Check for dangerous properties
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        for (const key of dangerousKeys) {
          if (key in value) {
            return helpers.error('object.dangerous-key', { key });
          }
        }
        return value;
      }),

    searchTerm: Joi.string()
      .min(1)
      .max(1000)
      .pattern(/^[^<>{}\\]+$/) // Prevent script injection
      .required()
  };

  static validate(data, schemaName) {
    const schema = this.schemas[schemaName];
    if (!schema) {
      throw new Error(`Unknown validation schema: ${schemaName}`);
    }

    const { error, value } = schema.validate(data);
    if (error) {
      throw new ValidationError(error.details[0].message, schemaName);
    }

    return value;
  }

  static sanitizeHtml(input) {
    if (typeof input !== 'string') return input;
    return DOMPurify.sanitize(input);
  }

  static sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const cleanKey = key.replace(/[<>{}\\]/g, '');
      
      // Sanitize value
      if (typeof value === 'string') {
        sanitized[cleanKey] = this.sanitizeHtml(value);
      } else if (typeof value === 'object') {
        sanitized[cleanKey] = this.sanitizeObject(value);
      } else {
        sanitized[cleanKey] = value;
      }
    }
    
    return sanitized;
  }
}

class ValidationError extends Error {
  constructor(message, schema) {
    super(message);
    this.name = 'ValidationError';
    this.schema = schema;
  }
}
```

### 3. Rate Limiting & DDoS Protection

**Current Vulnerabilities:**
- No rate limiting
- Vulnerable to DDoS attacks
- No request throttling

**Implementation:**

```javascript
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
    this.keyGenerator = options.keyGenerator || ((req) => req.ip);
    this.store = new Map(); // Use Redis in production
    this.cleanup();
  }

  middleware() {
    return (req, res, next) => {
      const key = this.keyGenerator(req);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // Get or create request log for this key
      let requests = this.store.get(key) || [];
      
      // Remove old requests outside the window
      requests = requests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit exceeded
      if (requests.length >= this.maxRequests) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(this.windowMs / 1000)} seconds.`,
          retryAfter: Math.ceil(this.windowMs / 1000)
        });
      }

      // Add current request
      requests.push(now);
      this.store.set(key, requests);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.maxRequests,
        'X-RateLimit-Remaining': Math.max(0, this.maxRequests - requests.length),
        'X-RateLimit-Reset': new Date(now + this.windowMs).toISOString()
      });

      next();
    };
  }

  cleanup() {
    // Clean up old entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      for (const [key, requests] of this.store.entries()) {
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        if (validRequests.length === 0) {
          this.store.delete(key);
        } else {
          this.store.set(key, validRequests);
        }
      }
    }, 5 * 60 * 1000);
  }
}
```

### 4. Secure Session Management

**Current Vulnerabilities:**
- Default session configuration
- No session security headers
- Missing CSRF protection

**Implementation:**

```javascript
const session = require('express-session');
const MongoStore = require('connect-mongo');
const csrf = require('csurf');

class SecureSessionManager {
  static createSessionConfig(options = {}) {
    return {
      name: options.sessionName || 'nooblyjs.sid', // Don't use default name
      secret: options.secret || process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true, // Reset expiry on activity
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: options.maxAge || 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict' // CSRF protection
      },
      store: options.store || new MongoStore({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/nooblyjs-sessions',
        touchAfter: 24 * 3600 // Lazy session update
      })
    };
  }

  static securityHeaders() {
    return (req, res, next) => {
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
      });
      next();
    };
  }

  static csrfProtection() {
    return csrf({
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      }
    });
  }
}
```

### 5. Audit Logging & Monitoring

**Current Vulnerabilities:**
- No audit trail
- Missing security event logging
- No intrusion detection

**Implementation:**

```javascript
class SecurityAuditLogger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'info';
    this.storage = options.storage || 'file'; // file, database, syslog
    this.alertThresholds = options.alertThresholds || {
      failedLogins: 5,
      rateLimitHits: 10,
      suspiciousActivity: 3
    };
    this.alerts = new Map();
  }

  async logSecurityEvent(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      severity: event.severity || 'info',
      userId: event.userId || 'anonymous',
      ip: event.ip,
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      result: event.result,
      details: event.details || {},
      sessionId: event.sessionId,
      requestId: event.requestId
    };

    // Store the log entry
    await this.storeLogEntry(logEntry);

    // Check for alert conditions
    await this.checkAlertConditions(logEntry);

    return logEntry;
  }

  async logAuthFailure(req, reason, details = {}) {
    await this.logSecurityEvent({
      type: 'AUTH_FAILURE',
      severity: 'warning',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: req.path,
      action: 'authenticate',
      result: 'failure',
      details: { reason, ...details }
    });
  }

  async logSuspiciousActivity(req, activity, details = {}) {
    await this.logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'high',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: req.path,
      action: activity,
      result: 'blocked',
      details
    });
  }

  async checkAlertConditions(logEntry) {
    const key = `${logEntry.eventType}:${logEntry.ip}`;
    const count = (this.alerts.get(key) || 0) + 1;
    this.alerts.set(key, count);

    const threshold = this.alertThresholds[logEntry.eventType.toLowerCase()];
    if (threshold && count >= threshold) {
      await this.triggerAlert(logEntry, count);
    }

    // Clean up old alerts (older than 1 hour)
    setTimeout(() => {
      this.alerts.delete(key);
    }, 60 * 60 * 1000);
  }

  async triggerAlert(logEntry, count) {
    const alert = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_ALERT',
      severity: 'critical',
      message: `Security threshold exceeded: ${logEntry.eventType}`,
      count,
      ip: logEntry.ip,
      details: logEntry
    };

    // Send alert (email, Slack, etc.)
    console.error('SECURITY ALERT:', alert);
    
    // In production, integrate with alerting system
    // await this.sendAlert(alert);
  }
}
```

---

## Implementation Priority

### Immediate (Week 1)
1. ✅ Secure API key management
2. ✅ Input validation framework
3. ✅ Rate limiting middleware

### Short-term (Weeks 2-3)
4. ✅ Session security improvements
5. ✅ Audit logging system
6. Security headers middleware

### Medium-term (Weeks 4-6)
7. CSRF protection
8. SQL injection prevention
9. File upload security

### Long-term (Weeks 7-8)
10. Intrusion detection system
11. Security monitoring dashboard
12. Penetration testing

---

## Security Configuration

```javascript
// Enhanced security initialization
const securityConfig = {
  apiKeys: {
    manager: new SecureApiKeyManager({
      saltRounds: 12,
      defaultExpiry: '1y'
    }),
    rotation: {
      enabled: true,
      interval: '90d',
      warningPeriod: '7d'
    }
  },
  
  rateLimiting: {
    global: { windowMs: 60000, maxRequests: 1000 },
    api: { windowMs: 60000, maxRequests: 100 },
    auth: { windowMs: 300000, maxRequests: 5 }
  },
  
  validation: {
    strictMode: true,
    sanitizeInput: true,
    maxObjectDepth: 10,
    maxStringLength: 10000
  },
  
  audit: {
    enabled: true,
    logLevel: 'info',
    storage: 'database',
    retention: '1y'
  }
};

// Apply security configuration
serviceRegistry.initialize(app, eventEmitter, {
  ...options,
  security: securityConfig
});
```

---

## Security Testing

```javascript
// Security test suite
describe('Security Tests', () => {
  test('API key validation', async () => {
    const keyManager = new SecureApiKeyManager();
    const { apiKey } = await keyManager.createApiKey(['read'], '1h');
    
    const validation = await keyManager.validateApiKey(apiKey);
    expect(validation.valid).toBe(true);
    
    const invalidValidation = await keyManager.validateApiKey('invalid-key');
    expect(invalidValidation.valid).toBe(false);
  });

  test('Rate limiting', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
    const middleware = limiter.middleware();
    
    // Should allow first two requests
    await testRequest(middleware, 200);
    await testRequest(middleware, 200);
    
    // Should block third request
    await testRequest(middleware, 429);
  });

  test('Input validation', () => {
    expect(() => {
      InputValidator.validate('valid-key', 'cacheKey');
    }).not.toThrow();
    
    expect(() => {
      InputValidator.validate('<script>alert("xss")</script>', 'cacheKey');
    }).toThrow(ValidationError);
  });
});
```

---

## Monitoring & Alerts

Set up monitoring for:
- Failed authentication attempts
- Rate limit violations
- Suspicious request patterns
- API key usage anomalies
- Input validation failures
- Security header violations

**Recommended Tools:**
- ELK Stack for log analysis
- Prometheus + Grafana for metrics
- PagerDuty for critical alerts
- OWASP ZAP for security scanning

---

## Compliance Considerations

### GDPR Compliance
- Data encryption at rest and in transit
- Right to be forgotten implementation
- Data processing audit logs
- Privacy by design principles

### SOC 2 Compliance
- Access controls and authentication
- System monitoring and logging
- Data protection and encryption
- Incident response procedures

### OWASP Top 10 Protection
- ✅ Injection prevention
- ✅ Broken authentication fixes
- ✅ Sensitive data exposure protection
- ✅ XML external entities prevention
- ✅ Broken access control fixes
- ✅ Security misconfiguration prevention
- ✅ Cross-site scripting protection
- ✅ Insecure deserialization prevention
- ✅ Known vulnerabilities monitoring
- ✅ Insufficient logging fixes

This security improvement plan addresses the most critical vulnerabilities and provides a roadmap for making nooblyjs-core enterprise-ready from a security perspective.