import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },
        cream: {
          50:  '#FDFAF5',
          100: '#FAF7F2',
          200: '#F5F0E8',
          300: '#EDE5D8',
          400: '#E0D5C0',
          500: '#D4C4A8',
          600: '#C4956A',
          700: '#A67C52',
          800: '#8B6540',
          900: '#6B4C30',
        },
        ink: {
          50:  '#F5F5F7',
          100: '#E8E8ED',
          200: '#D1D1DB',
          300: '#B0B0C0',
          400: '#8888A0',
          500: '#6B6B80',
          600: '#4A4A5E',
          700: '#35354A',
          800: '#1E1E30',
          900: '#0F0F1E',
          950: '#080816',
        },
      },
      letterSpacing: {
        'tightest': '-0.03em',
        'tighter': '-0.02em',
        'tight': '-0.01em',
      },
    },
  },
  plugins: [],
};
export default config;
