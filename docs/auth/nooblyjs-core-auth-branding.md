# Branding Flash-of-Unstyled-Content (FOUC) Fix

## Problem Solved

Previously, when the login/register pages loaded, they would briefly flash with the default blue styling before the custom branding colors were applied. This created a poor user experience.

## Solution Implemented

The pages now use a "loading" state that keeps the page hidden until branding has been fully loaded and applied.

### How It Works

1. **Page loads** - HTML rendered with default styles
2. **JavaScript runs immediately** - Adds `loading` class to body (opacity: 0)
3. **Branding API call** - Fetches configuration from server
4. **Branding applied** - Colors, logo, and stylesheet all applied
5. **Page revealed** - `loading` class removed (opacity: 1)
6. **Fade-in animation** - Page smoothly fades in with correct branding

### CSS Changes

Added to both login.html and register.html:

```css
/* Hide content until branding is loaded */
body.loading {
    opacity: 0;
}

body {
    opacity: 1;
    transition: opacity 0.3s ease-in;
}
```

This creates a smooth fade-in effect once branding is applied.

### JavaScript Changes

Updated branding loading script:

```javascript
// Mark page as loading to hide content
document.body.classList.add('loading');

async function loadBranding() {
    try {
        // Fetch and apply branding...
        applyBranding();
    } catch (error) {
        // Handle errors...
    } finally {
        // Show page when done
        showPage();
    }
}

function showPage() {
    // Remove loading class to reveal page
    document.body.classList.remove('loading');
}

// Start branding load immediately
loadBranding();
```

## User Experience

### Before
- Page loads and briefly shows blue default styling
- Custom orange (or other color) appears after a visible flash
- Feels like a "flash" or flicker

### After
- Page is completely hidden while branding loads
- Page appears fully styled with correct branding
- Smooth fade-in effect (300ms)
- Professional, polished feel

## Performance Impact

- **Minimal**: Hidden page still renders, just not visible
- **Network**: No additional requests (uses existing branding API)
- **Animation**: 300ms fade-in (can be customized if desired)

## Customization

To adjust the fade-in speed, modify the CSS:

```css
body {
    opacity: 1;
    transition: opacity 0.5s ease-in;  /* Change 0.3s to desired duration */
}
```

Or add a timeout to ensure minimum display time:

```javascript
function showPage() {
    setTimeout(() => {
        document.body.classList.remove('loading');
    }, 500);  // Wait at least 500ms before showing
}
```

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Testing

The fix is automatically applied on all page loads. Simply visit:
- Login page: `/services/authservice/views/login.html`
- Register page: `/services/authservice/views/register.html`

You should see a smooth fade-in of the page with correct branding applied, with no visible color flash.

## Files Modified

1. **src/authservice/views/login.html**
   - Added loading state CSS
   - Updated branding script with `showPage()` function

2. **src/authservice/views/register.html**
   - Added loading state CSS
   - Updated branding script with `showPage()` function
