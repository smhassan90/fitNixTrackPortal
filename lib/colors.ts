/**
 * Centralized color configuration for FitNixTrack Admin Portal
 *
 * Tailwind classes (bg-primary, text-dark-gray, …) read CSS variables from
 * lib/theme.ts defaults / per-gym overrides. Use this module for charts & JS.
 */

import { DEFAULT_THEME } from '@/lib/theme';

export const colors = {
  primary: {
    main: DEFAULT_THEME.primary,
    light: DEFAULT_THEME.primary,
    dark: DEFAULT_THEME.primaryDark,
    gradient: 'from-primary to-primary-dark',
  },

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

  darkGray: {
    main: DEFAULT_THEME.ink,
    light: DEFAULT_THEME.surface,
    dark: DEFAULT_THEME.ink,
  },

  lightGray: {
    main: DEFAULT_THEME.canvas,
    light: '#ffffff',
    dark: '#e5e5e5',
  },

  success: {
    main: DEFAULT_THEME.primary,
    light: DEFAULT_THEME.primary,
    dark: DEFAULT_THEME.primaryDark,
    bg: 'from-primary/10 to-primary/5',
    border: 'border-primary/30',
    text: 'text-primary-dark',
    icon: 'bg-primary',
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

  purple: {
    main: '#9B59B6',
    light: '#BB8FCE',
    dark: '#7D3C98',
    gradient: 'from-purple-500 to-purple-600',
  },

  chart: {
    primary: DEFAULT_THEME.primary,
    secondary: '#3498DB',
    tertiary: '#E67E22',
    quaternary: DEFAULT_THEME.primaryDark,
  },
} as const;

export const getGradient = (color: keyof typeof colors) => {
  if (color === 'primary') return colors.primary.gradient;
  if (color === 'blue') return colors.blue.gradient;
  if (color === 'orange') return colors.orange.gradient;
  if (color === 'purple') return colors.purple.gradient;
  return '';
};

export const getStatusColors = (status: 'success' | 'error' | 'warning' | 'info') => {
  return colors[status];
};
