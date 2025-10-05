/**
 * @fileoverview Services Authentication Middleware
 * Middleware to protect the /services route using the authservice for authentication.
 * Redirects unauthenticated users to login page.
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Creates authentication middleware for protecting the services page.
 * Validates user session tokens and redirects to login if not authenticated.
 * @param {Object} serviceRegistry - The service registry instance
 * @returns {Function} Express middleware function
 */
function createServicesAuthMiddleware(serviceRegistry) {
  return async (req, res, next) => {
    try {
      // Skip authentication for login-related paths, but check if user is already authenticated
      if (req.path.includes('/login') || req.path.includes('/register')) {
        // For login page, check if user is already authenticated
        if (req.path.includes('/login')) {
          // Check for token in query parameters (from return URLs)
          const token = req.query.authToken || req.headers.authorization?.substring(7);

          if (token) {
            try {
              const authService = serviceRegistry.authservice();
              const session = await authService.validateSession(token);

              if (session && session.username) {
                // User is already authenticated, redirect to services
                return res.redirect('/services/');
              }
            } catch (error) {
              // Token is invalid, continue to show login page
            }
          }
        }
        return next();
      }

      // Check for token first before serving auth check page
      let token = null;

      // Check Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      // Check query parameter (from client-side redirect)
      if (!token && req.query.authToken) {
        token = req.query.authToken;
      }

      // Check session cookie
      if (!token && req.session && req.session.authToken) {
        token = req.session.authToken;
      }

      // If we have a token, validate it server-side
      if (token) {
        try {
          const authService = serviceRegistry.authservice();
          const session = await authService.validateSession(token);

          if (session && session.username) {
            // Valid token - add user info and continue
            req.user = {
              id: session.userId,
              username: session.username,
              role: session.role
            };
            req.sessionData = session;
            return next();
          }
        } catch (error) {
          console.error('Token validation error:', error);
        }
      }

      // For browser requests without valid token, serve auth check page
      if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
        // Serve an authentication check page that will validate tokens client-side
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Authenticating...</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <h2>Checking authentication...</h2>
            <div class="spinner"></div>
            <script>
              const authToken = localStorage.getItem('authToken');
              if (!authToken) {
                window.location.href = '/services/authservice/views/login.html?returnUrl=' + encodeURIComponent(window.location.pathname);
              } else {
                // Validate token with server
                fetch('/services/authservice/api/validate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: authToken })
                })
                .then(response => response.json())
                .then(result => {
                  if (result.success) {
                    // Token is valid, redirect with token parameter for server validation
                    window.location.href = window.location.pathname + '?authToken=' + authToken;
                  } else {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('currentUser');
                    window.location.href = '/services/authservice/views/login.html?returnUrl=' + encodeURIComponent(window.location.pathname);
                  }
                })
                .catch(() => {
                  localStorage.removeItem('authToken');
                  localStorage.removeItem('currentUser');
                  window.location.href = '/services/authservice/views/login.html?returnUrl=' + encodeURIComponent(window.location.pathname);
                });
              }
            </script>
          </body>
          </html>
        `);
      }

      // If we reach here, no valid token was found
      return redirectToLogin(req, res);
    } catch (error) {
      console.error('Services auth middleware error:', error);
      return redirectToLogin(req, res);
    }
  };
}

/**
 * Redirects user to login page with return URL.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function redirectToLogin(req, res) {
  const returnUrl = encodeURIComponent(req.originalUrl);
  res.redirect(`/login.html?returnUrl=${returnUrl}`);
}

module.exports = { createServicesAuthMiddleware };