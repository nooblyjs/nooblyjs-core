# AuthService Branding - Quick Start Guide

## TL;DR

Pass branding configuration when initializing the authservice. No file modifications needed.

## Basic Usage

```javascript
const options = {
  'express-app': app,
  brandingConfig: {
    appName: 'My Application',
    logoUrl: '/assets/logo.png',
    primaryColor: '#FF5733'
  }
};

serviceRegistry.initialize(app, eventEmitter, options);
```

## What Gets Customized

| Element | How it Changes |
|---------|---|
| Page title | "Login - My Application" |
| Logo area | Shows your logo image |
| Application name | Displays "My Application" |
| Buttons | Uses your primary color |
| Links | Uses your primary color |
| Form focus | Uses your primary color |
| Alerts | Uses your warning color |

## Common Scenarios

### 1. Change App Name Only
```javascript
brandingConfig: {
  appName: 'ACME Portal'
}
```

### 2. Add Logo
```javascript
brandingConfig: {
  appName: 'TechFlow',
  logoUrl: 'https://example.com/logo.png'
}
```

### 3. Custom Colors
```javascript
brandingConfig: {
  appName: 'MyApp',
  primaryColor: '#1E88E5',
  secondaryColor: '#424242',
  warningColor: '#D32F2F'
}
```

### 4. Load Custom Stylesheet
```javascript
brandingConfig: {
  appName: 'CustomApp',
  stylesheetUrl: '/css/branding.css'
}
```

### 5. Everything
```javascript
brandingConfig: {
  appName: 'Enterprise Suite',
  logoUrl: '/assets/company-logo.svg',
  primaryColor: '#003366',
  secondaryColor: '#333333',
  warningColor: '#CC0000',
  stylesheetUrl: '/css/enterprise-theme.css'
}
```

## Configuration Options

```javascript
brandingConfig: {
  appName: string,           // Default: "Noobly JS"
  logoUrl: string,           // Default: null (no logo)
  stylesheetUrl: string,     // Default: null
  primaryColor: string,      // Default: "#0066cc" (hex, rgb, or named)
  secondaryColor: string,    // Default: "#6c757d"
  warningColor: string       // Default: "#ffc107"
}
```

## Testing

After configuration:

1. **Check API**: `curl http://localhost:3001/services/authservice/api/branding`
2. **Visit pages**:
   - Login: `http://localhost:3001/services/authservice/views/login.html`
   - Register: `http://localhost:3001/services/authservice/views/register.html`
3. **Verify changes**: Logo, name, and colors appear correctly

## Logo Tips

- **Format**: PNG (transparent), SVG, or JPG
- **Max size**: 60px height (auto-sized)
- **File size**: Keep under 100KB
- **URL**: Must be accessible from browser (check CORS)

## Color Formats

All of these work:
```javascript
primaryColor: '#FF5733'           // Hex
primaryColor: 'rgb(255, 87, 51)'  // RGB
primaryColor: 'red'               // Named
primaryColor: 'hsl(9, 100%, 60%)' // HSL
```

## CSS Customization

For advanced styling, create a custom stylesheet:

```css
/* /css/branding.css */
.auth-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-card {
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.btn-primary {
  border-radius: 8px;
  font-weight: 600;
}
```

Then reference it:
```javascript
brandingConfig: {
  stylesheetUrl: '/css/branding.css'
}
```

## Multi-Tenant Setup

```javascript
const tenants = {
  'acme': {
    appName: 'ACME Corp',
    logoUrl: '/logos/acme.png',
    primaryColor: '#FF5733'
  },
  'widgets': {
    appName: 'Widget Inc',
    logoUrl: '/logos/widgets.png',
    primaryColor: '#3366FF'
  }
};

function getTenant(id) {
  return tenants[id] || { appName: 'Default' };
}

const options = {
  'express-app': app,
  brandingConfig: getTenant(currentTenantId)
};
```

## Environment Variables

```javascript
const options = {
  'express-app': app,
  brandingConfig: {
    appName: process.env.APP_NAME || 'Default App',
    logoUrl: process.env.LOGO_URL || null,
    primaryColor: process.env.PRIMARY_COLOR || '#0066cc',
    stylesheetUrl: process.env.STYLESHEET_URL || null
  }
};
```

## How It Works

1. You pass `brandingConfig` in options during initialization
2. Login/register pages fetch `/services/authservice/api/branding` on load
3. JavaScript dynamically applies the branding:
   - Updates page title
   - Sets app name
   - Shows logo (if provided)
   - Applies colors to CSS variables
   - Loads custom stylesheet (if provided)

## No File Modifications Needed

The beauty of this approach:
- ✅ Zero file editing
- ✅ Configuration-driven
- ✅ Multi-tenant ready
- ✅ Easy to update
- ✅ Fully backward compatible

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Logo not showing | Check URL is correct, file exists, and CORS is allowed |
| Colors not changing | Use valid CSS color format, hard refresh browser |
| Stylesheet not loading | Verify URL is accessible, check console for CORS errors |
| Default values showing | Check options are passed to `initialize()`, restart server |

## See Also

- Full documentation: [AUTHSERVICE_BRANDING.md](./AUTHSERVICE_BRANDING.md)
- Login redirect feature: [LOGIN_REDIRECT_FEATURE.md](./LOGIN_REDIRECT_FEATURE.md)
- API documentation: Check `/services/authservice/api/branding` endpoint

## Next Steps

1. Define your branding config
2. Pass it in options during initialization
3. Restart your server
4. Visit login/register pages to see changes
5. Optionally, create custom stylesheet for advanced styling
