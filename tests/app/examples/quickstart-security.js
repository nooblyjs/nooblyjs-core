const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('passport');
const serviceRegistry = require('../../../index');

const app = express();

// Security headers: applied before other middleware so every response is
// covered. CSP is disabled here to match the main apps (app.js / app-noauth.js)
// because the service dashboards use inline styles/scripts; enable a tuned CSP
// per deployment.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup session and passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// Initialize with security
const apiKeys = (process.env.NOOBLY_API_KEYS || '').split(',').filter(Boolean);
serviceRegistry.initialize(app, null, {
  logDir: './.nooblyjs-core/logs',
  dataDir: './.nooblyjs-core/data',
  apiKeys: apiKeys,
  requireApiKey: apiKeys.length > 0,
  excludePaths: ['/services/*/status', '/services/', '/public/*']
});

const logger = serviceRegistry.logger('file');
const authservice = serviceRegistry.authservice('file');
const { configurePassport } = authservice.passportConfigurator(authservice.getAuthStrategy);
configurePassport(passport);

app.listen(3000, () => {
  logger.info('Server running on port 3000');
  logger.info('Dashboard: http://localhost:3000/services/');
});