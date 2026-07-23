/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Theme tokens (CSS variables — overridable per gym)
        primary: 'rgb(var(--theme-primary-rgb) / <alpha-value>)',
        'primary-light': 'rgb(var(--theme-primary-rgb) / <alpha-value>)',
        'primary-dark': 'rgb(var(--theme-primary-dark-rgb) / <alpha-value>)',

        blue: '#3498DB',
        'blue-light': '#5DADE2',
        'blue-dark': '#2980B9',

        orange: '#E67E22',
        'orange-light': '#F39C12',
        'orange-dark': '#D35400',

        'dark-gray': 'rgb(var(--theme-ink-rgb) / <alpha-value>)',
        'dark-gray-light': 'rgb(var(--theme-ink-rgb) / 0.55)',
        'dark-gray-dark': 'rgb(var(--theme-ink-rgb) / <alpha-value>)',

        'light-gray': 'rgb(var(--theme-canvas-rgb) / <alpha-value>)',
        'light-gray-light': '#ffffff',
        'light-gray-dark': 'rgb(var(--theme-ink-rgb) / 0.12)',

        success: 'rgb(var(--theme-primary-rgb) / <alpha-value>)',
        'success-light': 'rgb(var(--theme-primary-rgb) / 0.35)',
        'success-dark': 'rgb(var(--theme-primary-dark-rgb) / <alpha-value>)',

        error: '#E74C3C',
        'error-light': '#EC7063',
        'error-dark': '#C0392B',

        warning: '#F39C12',
        'warning-light': '#F7DC6F',
        'warning-dark': '#D68910',

        info: '#3498DB',
        'info-light': '#85C1E2',
        'info-dark': '#2980B9',

        purple: '#9B59B6',
        'purple-light': '#BB8FCE',
        'purple-dark': '#7D3C98',

        ink: 'rgb(var(--theme-ink-rgb) / <alpha-value>)',
        surface: 'rgb(var(--theme-surface-rgb) / <alpha-value>)',
        canvas: 'rgb(var(--theme-canvas-rgb) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
