/**
 * @fileoverview Example app demonstrating Azure AD (Microsoft Entra ID) authentication.
 * Wires up the 'azure' authservice provider, which reads its configuration from
 * the AZURE_AD_* environment variables (see the project .env file):
 *
 *   AZURE_AD_CLIENT_ID      Application (client) ID
 *   AZURE_AD_SECRET         Client secret
 *   AZURE_AD_TENANT_ID      Directory (tenant) ID
 *   AZURE_AD_BASE_URL       Public base URL of this app (scheme://host[:port]),
 *                           i.e. the part before /services. The redirect URI is
 *                           this base + /services/authservice/openid.
 *   AZURE_AD_SESSION_SECRET Express session secret (optional, falls back to a dev default)
 *
 * Usage:
 *   node tests/app/authservice/app-azure.js
 *
 * Then in a browser:
 *   1. Open http://localhost:11001/
 *   2. Click "Login with Microsoft" (hits GET /services/authservice/api/azure)
 *   3. Complete the Microsoft sign-in; Azure redirects back to the registered
 *      redirect URI POST /services/authservice/openid, which establishes the
 *      session and redirects the browser to the post-login page.
 *
 * IMPORTANT: The computed redirect URL (AZURE_AD_BASE_URL + /services/authservice/openid)
 * must be registered as a "Web" redirect URI in the Entra app registration,
 * otherwise Azure rejects the callback with AADSTS50011. ("Web", not "SPA":
 * this is the server-side authorization-code flow with a client secret and
 * response_mode=form_post — a SPA registration rejects the client secret.)
 *
 * CORPORATE PROXY / TLS INSPECTION: passport-azure-ad fetches Azure's OpenID
 * metadata over HTTPS from login.microsoftonline.com. Behind a TLS-inspecting
 * proxy that re-signs traffic with a corporate root CA, Node (which doesn't read
 * the OS trust store by default) rejects that fetch with
 * SELF_SIGNED_CERT_IN_CHAIN and the login silently fails into the failure
 * redirect. trustSystemCa() below merges the OS trust store into Node's defaults
 * to fix this; see src/shared/utils/trustSystemCa.js.
 */

'use strict';

const path = require('path');

// Trust the OS certificate store for outbound TLS so the OpenID-metadata fetch
// to login.microsoftonline.com succeeds behind a TLS-inspecting corporate proxy.
// Must run before the first outbound HTTPS request; harmless when not needed.
const { trustSystemCa } = require('../../../src/shared/utils/trustSystemCa');
const caResult = trustSystemCa();

// Load AZURE_AD_* (and other) variables from the project .env before anything
// reads process.env. Resolve the path relative to this file (not process.cwd())
// so the app works no matter which directory it is launched from.
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const { EventEmitter } = require('events');

// HTTP / HTTPS transport selected by HTTPS_ENABLED in .env (same factory app.js
// uses). Enable HTTPS by setting HTTPS_ENABLED=true and AZURE_AD_BASE_URL to an
// https:// URL; generate dev certs with `npm run certs`.
const { createServer } = require('../../../src/shared/utils/createServer');

// Service registry singleton
const serviceRegistry = require('../../../index');

const app = express();

// Security headers: applied before other middleware so every response is
// covered. CSP is disabled here to match the main apps (app.js / app-noauth.js)
// because the service dashboards use inline styles/scripts; enable a tuned CSP
// per deployment.
app.use(helmet({ contentSecurityPolicy: false }));
const eventEmitter = new EventEmitter();

// Derive the listening port from the configured base URL so the app and the
// redirect URI always agree; fall back to 11001.
function portFromUrl(url) {
  try {
    return Number(new URL(url).port) || null;
  } catch (_) {
    return null;
  }
}
const PORT = process.env.PORT
  || portFromUrl(process.env.AZURE_AD_BASE_URL)
  || 11001;

// Whether the app is serving HTTPS (same flag createServer uses below). Needed
// here because the session-cookie policy depends on it.
const httpsEnabled = process.env.HTTPS_ENABLED === 'true';

// Core middleware. Session must be registered before passport.session(), which
// the azure provider adds via the 'express-app' option below.
//
// Azure replies via response_mode=form_post — a cross-site POST from
// login.microsoftonline.com. The browser only sends the session cookie (which
// holds the OIDC state/nonce saved during the initiate step) on that POST if the
// cookie is SameSite=None, and SameSite=None requires Secure, which requires
// HTTPS. So the full OAuth flow needs HTTPS_ENABLED=true. Under plain HTTP we
// fall back to SameSite=Lax (the callback will fail state validation — expected).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.AZURE_AD_SESSION_SECRET || 'azure-ad-dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: httpsEnabled,
    sameSite: httpsEnabled ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// A minimal logging shim so the provider's this.logger?.* calls surface to the
// console during local testing.
const consoleLogger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || '')
};

// The registry must be initialized before any service can be created. Auth
// guards are disabled here so the OAuth initiate/callback routes are reachable
// without an existing session or API key.
serviceRegistry.initialize(app, eventEmitter, {
  logDir: path.join(__dirname, '../../../.application/logs'),
  dataDir: path.join(__dirname, '../../../.application/data'),
  security: {
    apiKeyAuth: { requireApiKey: false, apiKeys: [] },
    servicesAuth: { requireLogin: false }
  }
});

// Create the Azure AD auth service. Passing 'express-app' lets the provider
// register passport.initialize()/session() and lets the authservice mount its
// REST routes (including /api/azure and /services/authservice/openid) on this app.
const authservice = serviceRegistry.authservice('azure', {
  'express-app': app,
  // After a successful login, where to send the user (used in the JSON response).
  loginSuccessRedirectUrl: '/profile',
  dependencies: { logging: consoleLogger }
});

global.auth = authservice;

// Simple landing page with a login link.
app.get('/', (req, res) => {
  res.type('html').send(`
    <!DOCTYPE html>
    <html>
      <head><title>Azure AD Auth Example</title></head>
      <body style="font-family: system-ui; max-width: 640px; margin: 4rem auto;">
        <h1>Azure AD (Microsoft Entra ID) Auth Example</h1>
        <p><a href="/services/authservice/api/azure">➜ Login with Microsoft</a></p>
        <p><a href="/status">View provider status (JSON)</a></p>
      </body>
    </html>
  `);
});

// Provider status (handy for confirming config was picked up from .env).
app.get('/status', async (req, res) => {
  try {
    res.json(await authservice.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shows the authenticated user once the passport session is established.
app.get('/profile', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ authenticated: false, message: 'Not logged in. Visit / to sign in.' });
  }
  res.json({ authenticated: true, user: req.user });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'azure-ad-auth-example' });
});

// Surface auth lifecycle events for visibility during testing.
eventEmitter.on('auth:provider-initialized', (data) => {
  if (data.provider === 'azure') console.log(`[EVENT] Azure provider initialized`);
});
eventEmitter.on('auth:azure-config-missing', (data) => {
  console.warn(`[EVENT] Azure config missing: ${data.message}`);
});
eventEmitter.on('auth:azure-unavailable', (data) => {
  console.warn(`[EVENT] Azure unavailable: ${data.message}`);
});
eventEmitter.on('auth:azure-login', (data) => {
  console.log(`[EVENT] Azure login: ${data.email} roles=${JSON.stringify(data.roles)}`);
});
eventEmitter.on('auth:azure-callback-error', (data) => {
  console.error(`[EVENT] Azure callback error: ${data.error}`);
});

// Build an HTTP or HTTPS server depending on HTTPS_ENABLED in .env. Relative
// cert paths resolve against the project root (three levels up from here).
// httpsEnabled was already derived above (it drives the session-cookie policy);
// createServer recomputes the same flag internally from HTTPS_ENABLED.
const { server, protocol } = createServer(app, {
  baseDir: path.join(__dirname, '../../..')
});

server.listen(PORT, async () => {
  const status = await authservice.getStatus();
  const origin = `${protocol}://localhost:${PORT}`;
  console.log(`\n╔════════════════════════════════════════════════════╗`);
  console.log(`║ Azure AD (Entra ID) Auth Example Server            ║`);
  console.log(`╚════════════════════════════════════════════════════╝\n`);
  console.log(`Listening on   : ${origin} (${protocol.toUpperCase()})`);
  console.log(`System CA      : ${caResult.applied ? `trusted (${caResult.systemCount} OS certs merged)` : `not applied — ${caResult.reason}`}`);
  console.log(`Base URL       : ${process.env.AZURE_AD_BASE_URL || '(AZURE_AD_BASE_URL not set)'}`);
  console.log(`Redirect URI   : ${authservice.callbackURL_ || '(not resolved)'}`);
  console.log(`Tenant set     : ${status.tenantConfigured}`);
  console.log(`Fully configured: ${status.configured}\n`);

  if (!status.configured) {
    console.warn('⚠  Azure AD is not fully configured. Ensure AZURE_AD_CLIENT_ID,');
    console.warn('   AZURE_AD_SECRET and AZURE_AD_TENANT_ID are set in your .env.\n');
  }

  if (httpsEnabled) {
    console.log('Note: self-signed certificates trigger a browser warning — accept it to proceed.');
  }

  // Warn if the redirect URI scheme/port disagree with how the app is actually
  // serving, since Azure must redirect back to a URL this process can answer.
  if (authservice.callbackURL_) {
    try {
      const cb = new URL(authservice.callbackURL_);
      if (cb.protocol !== `${protocol}:` || (cb.port && Number(cb.port) !== Number(PORT))) {
        console.warn(`⚠  Redirect URI (${authservice.callbackURL_}) does not match how this app is`);
        console.warn(`   serving (${origin}). Align AZURE_AD_BASE_URL and HTTPS_ENABLED so they agree.\n`);
      }
    } catch (_) { /* ignore malformed URL */ }
  }

  console.log('Try it:');
  console.log(`  • Browser : open ${origin}/ and click "Login with Microsoft"`);
  console.log(`  • Status  : curl ${httpsEnabled ? '-k ' : ''}${origin}/status\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});

module.exports = app;
