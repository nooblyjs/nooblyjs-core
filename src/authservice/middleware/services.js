'use strict';

/**
 * @fileoverview Authenticated services middleware
 * Protects /services routes by validating sessions through the authservice.
 *
 * @module authservice/middleware/services
 */

/**
 * Creates authentication middleware for protecting the services page.
 * Validates user session tokens and redirects to login if not authenticated.
 *
 * @param {Object} serviceRegistry - The service registry instance
 * @returns {Function} Express middleware function
 */
function createServicesAuthMiddleware(serviceRegistry) {
  return async (req, res, next) => {
    try {
      if (req.path.includes('/login') || req.path.includes('/register')) {
        if (req.path.includes('/login')) {
          const token = req.query.authToken || req.headers.authorization?.substring(7);

          if (token) {
            try {
              const authService = serviceRegistry.authservice();
              const session = await authService.validateSession(token);

              if (session && session.username) {
                return res.redirect('/services/');
              }
            } catch (error) {
              // Ignore invalid tokens so login page can render
            }
          }
        }
        return next();
      }

      let token = null;
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      if (!token && req.query.authToken) {
        token = req.query.authToken;
      }

      if (!token && req.session && req.session.authToken) {
        token = req.session.authToken;
      }

      if (token) {
        try {
          const authService = serviceRegistry.authservice();
          const session = await authService.validateSession(token);

          if (session && session.username) {
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

      if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
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
                fetch('/services/authservice/api/validate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: authToken })
                })
                .then(response => response.json())
                .then(result => {
                  if (result.success) {
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
  res.redirect(`/services/authservice/views/login.html?returnUrl=${returnUrl}`);
}

module.exports = {
  createServicesAuthMiddleware
};
