/**
 * Centralized color configuration for FitNixTrack Admin Portal
 * 
 * Usage:
 * - For Tailwind CSS classes: Use color names directly (e.g., 'bg-primary', 'text-blue')
 *   Colors are defined in tailwind.config.js
 * 
 * - For JavaScript/TypeScript code: Import from this file
 *   import { colors, getGradient, getStatusColors } from '@/lib/colors'
 * 
 * - For charts and inline styles: Use colors.chart.primary, colors.primary.main, etc.
 * 
 * - For status-based colors: Use getStatusColors('success' | 'error' | 'warning' | 'info')
 */

export const colors = {
  // Primary Colors
  primary: {
    main: '#1ABC9C',
    light: '#48C9B0',
    dark: '#16A085',
    gradient: 'from-primary to-teal-600',
  },
  
  // Secondary Colors
  blue: {
    main: '#3498DB',
    light: '#5DADE2',
    dark: '#2980B9',
    gradient: 'from-blue to-blue-600',
  },
  
  orange: {
    main: '#E67E22',
    light: '#F39C12',
    dark: '#D35400',
    gradient: 'from-orange to-orange-600',
  },
  
  // Neutral Colors
  darkGray: {
    main: '#2C3E50',
    light: '#34495E',
    dark: '#1A252F',
  },
  
  lightGray: {
    main: '#ECF0F1',
    light: '#F8F9FA',
    dark: '#D5DBDB',
  },
  
  // Status Colors
  success: {
    main: '#27AE60',
    light: '#58D68D',
    dark: '#1E8449',
    bg: 'from-green-50 to-green-100',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'bg-green-500',
  },
  
  error: {
    main: '#E74C3C',
    light: '#EC7063',
    dark: '#C0392B',
    bg: 'from-red-50 to-red-100',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: 'bg-red-500',
  },
  
  warning: {
    main: '#F39C12',
    light: '#F7DC6F',
    dark: '#D68910',
    bg: 'from-yellow-50 to-yellow-100',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    icon: 'bg-yellow-500',
  },
  
  info: {
    main: '#3498DB',
    light: '#85C1E2',
    dark: '#2980B9',
    bg: 'from-blue-50 to-blue-100',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'bg-blue-500',
  },
  
  // Special Colors
  purple: {
    main: '#9B59B6',
    light: '#BB8FCE',
    dark: '#7D3C98',
    gradient: 'from-purple-500 to-purple-600',
  },
  
  // Chart Colors
  chart: {
    primary: '#1ABC9C',
    secondary: '#3498DB',
    tertiary: '#E67E22',
    quaternary: '#9B59B6',
  },
} as const;

// Helper function to get gradient classes
export const getGradient = (color: keyof typeof colors) => {
  if (color === 'primary') return colors.primary.gradient;
  if (color === 'blue') return colors.blue.gradient;
  if (color === 'orange') return colors.orange.gradient;
  if (color === 'purple') return colors.purple.gradient;
  return '';
};

// Helper function to get status colors
export const getStatusColors = (status: 'success' | 'error' | 'warning' | 'info') => {
  return colors[status];
};

