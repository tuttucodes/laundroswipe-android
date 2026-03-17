/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Source Sans 3', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#1746A2',
          dark: '#0F3285',
          light: '#E8EEFB',
        },
        accent: {
          teal: '#0D9488',
          orange: '#F97316',
        },
        // Tokens used by the new homepage
        primary: '#3B82F6',
        accentBlue: '#06B6D4',
        dark: '#0A0E1A',
        'dark-card': '#111827',
        'dark-border': '#1F2937',
        glow: '#3B82F680',
      },
      boxShadow: {
        'soft-xl': '0 20px 80px rgba(15, 52, 133, 0.35)',
      },
      backgroundImage: {
        'hero-grid':
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out both',
        'fade-in': 'fadeIn 0.4s ease-out both',
        'float-slow': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.9, transform: 'scale(1.03)' },
        },
      },
    },
  },
  plugins: [],
};

