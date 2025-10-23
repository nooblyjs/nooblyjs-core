# AuthService Branding Configuration

## Overview

The authservice now supports complete branding customization for customer-facing authentication pages. This allows you to:

- Display a custom application name
- Show a custom logo/image
- Apply custom color schemes
- Load a custom stylesheet for additional styling
- Use Bootstrap for responsive, mobile-friendly layouts

All branding configuration is passed through the options when initializing the authservice, with no file modifications needed.

## Configuration

### Basic Setup

Pass a `brandingConfig` object in the options when initializing the service:

```javascript
const serviceRegistry = require('./index.js');
const express = require('express');
const EventEmitter = require('events');

const app = express();
const eventEmitter = new EventEmitter();

const options = {
  'express-app': app,
  logDir: './logs',
  dataDir: './data',

  // NEW: Branding configuration
  brandingConfig: {
    appName: 'MyApp',
    logoUrl: '/assets/logo.png',
    stylesheetUrl: '/assets/custom-styles.css',
    primaryColor: '#FF5733',
    secondaryColor: '#333333',
    warningColor: '#FFC300'
  }
};

serviceRegistry.initialize(app, eventEmitter, options);
```

### Configuration Options

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `appName` | string | No | The application name displayed on login/register pages | "Noobly JS" |
| `logoUrl` | string | No | URL to logo image (PNG, SVG, JPG) | null (no logo) |
| `stylesheetUrl` | string | No | URL to custom CSS stylesheet | null |
| `primaryColor` | string | No | Primary color (hex, rgb, or named) | "#0066cc" |
| `secondaryColor` | string | No | Secondary color for text/muted elements | "#6c757d" |
| `warningColor` | string | No | Warning color for alerts | "#ffc107" |

## Usage Examples

### Example 1: Minimal Branding (Name Only)

```javascript
const options = {
  'express-app': app,
  brandingConfig: {
    appName: 'ACME Corp'
  }
};
```

Result: Login page displays "ACME Corp" instead of "Noobly JS"

### Example 2: Full Branding with Logo

```javascript
const options = {
  'express-app': app,
  brandingConfig: {
    appName: 'TechFlow',
    logoUrl: 'https://example.com/images/logo.png',
    primaryColor: '#1E88E5',
    secondaryColor: '#424242'
  }
};
```

Result:
- Logo image displayed above the app name
- App name: "TechFlow"
- Primary buttons and links use blue (#1E88E5)
- Secondary text uses dark gray (#424242)

### Example 3: Custom Stylesheet

```javascript
const options = {
  'express-app': app,
  brandingConfig: {
    appName: 'ClientApp',
    logoUrl: '/assets/client-logo.svg',
    stylesheetUrl: '/css/client-branding.css'
  }
};
```

The custom stylesheet can override any Bootstrap or auth service styles:

```css
/* /css/client-branding.css */
.auth-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-card {
  border-radius: 2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-logo {
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -2px;
}
```

### Example 4: Multi-Tenant Setup

```javascript
const tenantBranding = {
  'tenant-a': {
    appName: 'Tenant A Portal',
    logoUrl: '/assets/tenant-a-logo.png',
    primaryColor: '#FF6B6B',
    stylesheetUrl: '/css/tenant-a.css'
  },
  'tenant-b': {
    appName: 'Tenant B System',
    logoUrl: '/assets/tenant-b-logo.png',
    primaryColor: '#4ECDC4',
    stylesheetUrl: '/css/tenant-b.css'
  }
};

function getTenantConfig(tenantId) {
  return tenantBranding[tenantId] || {};
}

// Use when initializing
const options = {
  'express-app': app,
  brandingConfig: getTenantConfig(currentTenant)
};
```

## API Endpoint

The branding configuration is served via a public API endpoint:

### GET /services/authservice/api/branding

**Response:**
```json
{
  "success": true,
  "data": {
    "appName": "MyApp",
    "logoUrl": "/assets/logo.png",
    "stylesheetUrl": "/assets/custom-styles.css",
    "primaryColor": "#FF5733",
    "secondaryColor": "#333333",
    "warningColor": "#FFC300"
  }
}
```

This endpoint is public (no authentication required) so frontend applications can fetch branding configuration.

## How It Works

1. **Initialization**: Branding config is passed via options
2. **API Serving**: `/services/authservice/api/branding` endpoint exposes the configuration
3. **Frontend Loading**: Login and register pages fetch branding on page load
4. **Dynamic Application**: JavaScript applies branding dynamically:
   - Updates page title
   - Sets application name text
   - Replaces logo if provided
   - Applies CSS variables for colors
   - Loads custom stylesheet if provided

## Styling System

### CSS Variables

The following CSS variables control the auth UI appearance:

```css
:root {
  --custom-primary: #0066cc;      /* Primary color for buttons, links */
  --custom-secondary: #6c757d;    /* Secondary text color */
  --custom-warning: #ffc107;      /* Warning/alert color */
}
```

These variables are automatically updated when branding config includes color values.

### Bootstrap Integration

The auth pages use Bootstrap 5.3.2 for:
- Responsive grid system
- Form styling
- Button components
- Card layouts
- Alert boxes
- Icons (Bootstrap Icons 1.11.3)

Your custom stylesheet can extend or override Bootstrap classes.

## Logo Best Practices

### Image Format
- **Recommended**: SVG (scalable, lightweight)
- **Also good**: PNG (with transparency), WebP
- **Acceptable**: JPG (for photos)

### Image Size
- **Max height**: 60px (automatically enforced)
- **Aspect ratio**: Any ratio works (images scale proportionally)
- **File size**: Keep under 100KB for fast loading

### Hosting
- **Best**: Host on your own server for fast loading
- **Alternative**: CDN for global availability
- **CORS**: Ensure logo URL is accessible from client browser

### Example SVG Logo
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="90" fill="#FF5733"/>
  <text x="100" y="120" text-anchor="middle" font-size="60" fill="white" font-weight="bold">A</text>
</svg>
```

## Color Customization

### Color Values Accepted
```javascript
brandingConfig: {
  primaryColor: '#FF5733',        // Hex
  primaryColor: 'rgb(255, 87, 51)',  // RGB
  primaryColor: 'red',            // Named color
  primaryColor: 'hsl(9, 100%, 60%)' // HSL
}
```

### Maintaining Contrast
- Ensure text is readable on backgrounds
- Primary color should have sufficient contrast with white text
- Test with accessibility tools

### Color Palette Examples

**Professional Blue**
```javascript
primaryColor: '#1E3A8A',
secondaryColor: '#475569',
warningColor: '#DC2626'
```

**Modern Purple**
```javascript
primaryColor: '#7C3AED',
secondaryColor: '#6366F1',
warningColor: '#EC4899'
```

**Green/Eco**
```javascript
primaryColor: '#059669',
secondaryColor: '#047857',
warningColor: '#F97316'
```

## Custom Stylesheet

### When to Use

Create a custom stylesheet when:
- You need to change layout/spacing
- You want custom fonts
- You need additional animations
- You want to override Bootstrap styles
- You need responsive breakpoints

### Example Custom Stylesheet

```css
/* /css/custom-auth-branding.css */

/* Custom font */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');

body, .auth-logo {
  font-family: 'Inter', sans-serif;
}

/* Custom card styling */
.auth-card {
  border-radius: 16px;
  border-left: 4px solid var(--custom-primary);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
}

/* Custom button styling */
.btn-primary {
  border-radius: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
}

/* Custom form inputs */
.form-control {
  border-radius: 8px;
  border: 2px solid #e5e7eb;
  padding: 12px 16px;
  font-size: 1rem;
}

.form-control:focus {
  border-color: var(--custom-primary);
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .auth-container {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  }

  .auth-card {
    background-color: #374151;
    color: #f3f4f6;
  }
}

/* Mobile optimization */
@media (max-width: 768px) {
  .auth-card {
    margin: 20px;
  }

  .auth-logo {
    font-size: 1.5rem;
  }
}
```

## Testing Your Branding

### Test in Development

```bash
# Start your app with branding config
npm start

# Visit the login page
open http://localhost:3001/services/authservice/views/login.html

# Check browser console for branding load status
# Should see no errors in console
```

### Check API Response

```bash
curl http://localhost:3001/services/authservice/api/branding | jq

# Should return your branding configuration
```

### Verify Visual Changes

- [ ] Application name appears correctly
- [ ] Logo displays (if configured)
- [ ] Colors match your configuration
- [ ] Custom stylesheet loads (if configured)
- [ ] Layout is responsive on mobile
- [ ] No console errors

## Backward Compatibility

This feature is **fully backward compatible**:

- If `brandingConfig` is not provided, defaults are used
- Existing implementations work without changes
- Pages display "Noobly JS" with default styling if no config provided
- Bootstrap styling is always available

## Troubleshooting

### Logo Not Showing

1. **Check URL**: Ensure `logoUrl` is correct and accessible
2. **CORS**: Logo must be accessible from browser
3. **Format**: Use PNG, JPG, or SVG
4. **Size**: Keep under 100KB

Test:
```bash
curl -I https://example.com/logo.png
# Should return 200 OK
```

### Colors Not Applying

1. **Format**: Use valid CSS color format (#hex, rgb, or named)
2. **Specificity**: Custom colors override defaults
3. **Cache**: Clear browser cache or use incognito mode
4. **Reload**: Hard refresh (Ctrl+Shift+R) to reload

### Stylesheet Not Loading

1. **URL**: Ensure stylesheet URL is correct
2. **CORS**: Stylesheet must be accessible from browser
3. **Syntax**: Check CSS for valid syntax
4. **Console**: Check browser console for CORS errors

### Branding API Returns Defaults

1. **Configuration**: Verify `brandingConfig` is in options
2. **Initialization**: Check options are passed correctly
3. **Server Restart**: Restart server after config changes
4. **API Response**: Call `/services/authservice/api/branding` to verify

## Advanced Usage

### Dynamic Branding Based on URL

```javascript
// In your application setup
function getBrandingFromDomain(req) {
  const domain = req.hostname;

  if (domain.includes('enterprise')) {
    return {
      appName: 'Enterprise Edition',
      primaryColor: '#003366'
    };
  }

  return {
    appName: 'Standard Edition',
    primaryColor: '#0066cc'
  };
}

// Create middleware to inject branding
app.use((req, res, next) => {
  res.locals.branding = getBrandingFromDomain(req);
  next();
});
```

### Branding with Feature Flags

```javascript
const brandingConfig = {
  appName: process.env.APP_NAME || 'Default App',
  logoUrl: process.env.LOGO_URL || null,

  // Only load custom stylesheet in production
  stylesheetUrl: process.env.NODE_ENV === 'production'
    ? process.env.CUSTOM_STYLESHEET_URL
    : null,

  primaryColor: process.env.PRIMARY_COLOR || '#0066cc'
};
```

## Performance Considerations

- **API Call**: Branding is fetched on each page load (lightweight JSON)
- **Logo Image**: Only downloaded if configured
- **Stylesheet**: Only loaded if configured
- **Caching**: Configure HTTP caching headers for better performance

```javascript
// In your application
app.get('/services/authservice/api/branding', (req, res, next) => {
  // Cache for 1 hour
  res.set('Cache-Control', 'public, max-age=3600');
  next();
});
```

## Security Notes

- **Public Endpoint**: Branding API is intentionally public (no auth required)
- **No Sensitive Data**: Never include secrets or sensitive info in branding
- **URL Validation**: Ensure logo and stylesheet URLs are from trusted sources
- **Content Security Policy**: Consider CSP headers for additional security
