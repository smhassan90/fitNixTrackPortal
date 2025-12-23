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
        // Primary Colors - Managed in lib/colors.ts
        primary: '#1ABC9C',
        'primary-light': '#48C9B0',
        'primary-dark': '#16A085',
        
        // Secondary Colors
        blue: '#3498DB',
        'blue-light': '#5DADE2',
        'blue-dark': '#2980B9',
        
        orange: '#E67E22',
        'orange-light': '#F39C12',
        'orange-dark': '#D35400',
        
        // Neutral Colors
        'dark-gray': '#2C3E50',
        'dark-gray-light': '#34495E',
        'dark-gray-dark': '#1A252F',
        
        'light-gray': '#ECF0F1',
        'light-gray-light': '#F8F9FA',
        'light-gray-dark': '#D5DBDB',
        
        // Status Colors
        success: '#27AE60',
        'success-light': '#58D68D',
        'success-dark': '#1E8449',
        
        error: '#E74C3C',
        'error-light': '#EC7063',
        'error-dark': '#C0392B',
        
        warning: '#F39C12',
        'warning-light': '#F7DC6F',
        'warning-dark': '#D68910',
        
        info: '#3498DB',
        'info-light': '#85C1E2',
        'info-dark': '#2980B9',
        
        // Special Colors
        purple: '#9B59B6',
        'purple-light': '#BB8FCE',
        'purple-dark': '#7D3C98',
      },
    },
  },
  plugins: [],
}

