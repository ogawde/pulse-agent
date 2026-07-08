/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        pulse: {
          500: '#22d3ee',
          600: '#0ea5e9',
        },
      },
      boxShadow: {
        soft: '0 24px 60px rgba(15,23,42,0.8)',
      },
    },
  },
  plugins: [],
}

