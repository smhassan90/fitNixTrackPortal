# Color Management Guide

All colors in the FitNixTrack Admin Portal are managed from centralized locations for easy maintenance and consistency.

## Color Configuration Files

### 1. `lib/colors.ts` - JavaScript/TypeScript Colors
This file contains color values for use in JavaScript/TypeScript code, charts, and programmatic styling.

**Usage:**
```typescript
import { colors, getGradient, getStatusColors } from '@/lib/colors';

// Access color values
const primaryColor = colors.primary.main; // '#1ABC9C'

// Get gradient classes
const gradientClass = getGradient('primary'); // 'from-primary to-teal-600'

// Get status colors
const successColors = getStatusColors('success');
```

### 2. `tailwind.config.js` - Tailwind CSS Colors
This file defines colors for use in Tailwind CSS classes throughout the application.

**Usage:**
```jsx
// Use Tailwind classes directly
<div className="bg-primary text-white">
<div className="bg-blue-500 hover:bg-blue-600">
<div className="text-dark-gray border-light-gray">
```

## Available Colors

### Primary Colors
- `primary` - Teal (#1ABC9C)
- `primary-light` - Light Teal (#48C9B0)
- `primary-dark` - Dark Teal (#16A085)

### Secondary Colors
- `blue` - Blue (#3498DB)
- `orange` - Orange (#E67E22)
- `purple` - Purple (#9B59B6)

### Neutral Colors
- `dark-gray` - Dark Gray (#2C3E50)
- `light-gray` - Light Gray (#ECF0F1)

### Status Colors
- `success` - Green (#27AE60)
- `error` - Red (#E74C3C)
- `warning` - Yellow (#F39C12)
- `info` - Blue (#3498DB)

## Best Practices

1. **For CSS Classes**: Always use Tailwind classes (e.g., `bg-primary`, `text-blue`)
2. **For Charts**: Use `colors.chart.primary`, `colors.chart.secondary`, etc.
3. **For Inline Styles**: Use `colors.primary.main`, `colors.blue.main`, etc.
4. **For Status Indicators**: Use `getStatusColors('success')` helper function

## Changing Colors

To change the color scheme:
1. Update color values in `lib/colors.ts`
2. Update corresponding values in `tailwind.config.js`
3. Restart the development server

This ensures all components use the updated colors consistently.

