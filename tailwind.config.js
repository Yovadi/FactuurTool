/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#E8C547',
          500: '#D4AF37',
          600: '#C19A2E',
        },
        dark: {
          950: '#0A0A0B',
          900: '#1A1A1C',
          800: '#2A2A2D',
          700: '#3A3A3E',
          600: '#4A4A4F',
        },
      },
    },
  },
  plugins: [],
};
