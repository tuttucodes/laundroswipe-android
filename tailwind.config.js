/** NativeWind v4 Tailwind config. Mirrors brand tokens from the web app. */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1746A2',
          light: '#E8EEFB',
          mid: '#3B6FD4',
        },
        teal: {
          DEFAULT: '#0D9488',
          light: '#CCFBF1',
        },
        orange: {
          DEFAULT: '#F97316',
          light: '#FFF7ED',
        },
        accent: '#E8523F',
        surface: '#FFFFFF',
        bg: '#F8FAFC',
        ink: {
          DEFAULT: '#1A1D2E',
          2: '#475569',
          3: '#94A3B8',
        },
        border: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        success: '#15803D',
        error: '#DC2626',
      },
      borderRadius: {
        sm: '10px',
        DEFAULT: '14px',
        lg: '18px',
      },
      fontFamily: {
        display: ['Outfit_700Bold', 'Outfit_600SemiBold', 'sans-serif'],
        body: ['SourceSans3_400Regular', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
