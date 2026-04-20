# Noobly JS Core - Branding Guide

## Color Palette

The Noobly JS Core uses a sophisticated blue color scheme with complementary rust orange accents, creating a modern and professional appearance.

### Primary Colors
- **Primary (Teal Blue)**: `#68A8C4` - Main brand color used for headers, buttons, and key UI elements
- **Complementary (Rust Orange)**: `#C49668` - Secondary accent color for highlights and interactive elements
- **Accent (Sky Blue)**: `#6AAAC6` - Secondary blue accent for secondary actions
- **Success (Blue)**: `#3B82F6` - For success states and positive feedback
- **Warning (Amber)**: `#FFB703` - For warnings and alerts
- **Light (Light Teal)**: `#E8F4F8` - Light backgrounds and tints
- **Dark**: `#1F2937` - Dark text and backgrounds

### CSS Variables

All colors are defined as CSS variables in the root selector:

```css
:root {
  /* Noobly JS branding colors - Blue & Rust Palette */
  --bs-primary: #68A8C4;
  --bs-primary-rgb: 104, 168, 196;
  --noobly-complement: #C49668;
  --noobly-accent: #6AAAC6;
  --noobly-success: #3B82F6;
  --noobly-warning: #FFB703;
  --noobly-dark: #1F2937;
  --noobly-light: #E8F4F8;
}
```

## Logo & Branding Assets

### Logo Files
- **Main Logo**: `/public/images/nooblyjs-logo.png` - Noobly JS profile logo used in headers
- **Profile**: `/public/images/nooblyjs-profile.jpg` - Character profile image
- **Background**: `/public/images/noobly-background.png` - Full background illustration

### Favicon Assets
- **Favicon**: `/public/favicon.ico` - Main favicon
- **16x16**: `/public/favicon-16x16.png`
- **32x32**: `/public/favicon-32x32.png`
- **Apple Touch Icon**: `/public/apple-touch-icon.png` - For iOS home screen

### Original Branding Files
All original branding assets are stored in `/docs/branding/` including:
- Character sheets and artwork
- Multiple logo variations
- Background images
- Web manifest files

## CSS Classes

### Button Styles
- `.btn-noobly` - Primary Noobly button with teal blue (hover: #5691B0)
- `.btn-noobly-accent` - Secondary button with sky blue (hover: #5A9AB6)
- `.btn-noobly-complement` - Complementary button with rust orange (hover: #B08454)

### Text Colors
- `.text-noobly` - Primary teal blue text
- `.text-noobly-accent` - Accent teal green text
- `.text-noobly-complement` - Complementary rust orange text

### Background Classes
- `.bg-noobly-light` - Light background with primary color tint
- `.noobly-hero` - Full-screen hero section with background image

### Card Styles
- `.noobly-card` - Card with Noobly styling and hover effects
- `.noobly-card-header` - Card header with gradient background

### Border Styles
- `.border-noobly` - Border with primary color

## Component Updates

### Headers
- Logo updated from S-Tech to Noobly JS profile image
- Header background uses primary teal blue color (`#68A8C4`)

### Buttons
- Primary buttons use teal blue (#68A8C4), hover: darker teal (#5691B0)
- Accent buttons use teal green (#68C4B8), hover: darker teal green (#5AA09E)
- Complementary buttons use rust orange (#C49668), hover: darker rust (#B08454)
- All buttons include lift effect and glow shadow on hover
- Smooth transition animations for all interactions

### Cards & Containers
- Cards have subtle Noobly-branded teal borders
- Hover states show enhanced shadow and teal border color change
- Card headers use gradient from teal to rust

### Background
- Body background uses subtle gradient (light gray to lighter gray)
- Hero sections can display full Noobly background image

## Implementation Notes

1. **Color Updates**: Updated to sophisticated teal blue palette (#68A8C4) with complementary rust orange (#C49668) accents

2. **Logo Migration**: All S-Tech logo references updated to Noobly JS profile image

3. **Favicon Setup**: Full favicon suite deployed with proper size variants for all platforms

4. **CSS Extensions**: Comprehensive set of Noobly-specific classes including complement color variants

5. **Gradient Backgrounds**: Smooth gradients using primary teal and complementary rust colors

6. **Color Complementarity**: Teal blue (#68A8C4) paired with rust orange (#C49668) for maximum visual contrast and appeal

7. **Analogous Accents**: Teal green (#68C4B8) provides softer secondary accent option

## Usage Examples

### Using Noobly Colors
```html
<button class="btn btn-noobly">Primary Action</button>
<button class="btn btn-noobly-accent">Secondary Action</button>
<div class="noobly-card">
  <div class="noobly-card-header">
    <h3>Service Details</h3>
  </div>
  <div class="card-body">...</div>
</div>
```

### Text Colors
```html
<p class="text-noobly">Primary text</p>
<p class="text-noobly-accent">Accent text</p>
```

### Background Effects
```html
<section class="noobly-hero">
  <h1>Hero Section with Noobly Background</h1>
</section>
```

## Brand Guidelines

- **Primary Color** should be used for main CTA buttons and headers
- **Accent Color** draws attention to secondary actions and highlights
- **Logo** should maintain proper spacing (at least 8px margin on all sides)
- **Typography** uses Inter font throughout for consistency
- **Shadows** use the custom shadow variables defined in CSS

## Future Customization

To adjust colors:
1. Update the CSS variables in `:root` selector
2. All dependent classes will automatically inherit the new colors
3. Use `.noobly-*` classes for brand-specific styling

To add new backgrounds:
1. Place images in `/public/images/`
2. Reference in CSS backgrounds or HTML img tags
3. Consider image size for performance
