import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Source Code Pro"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          500: '#533afd',
          600: '#4434d4',
          700: '#2e2b8c',
        },
        navy: {
          50:  '#f0f4f8',
          100: '#d9e2ec',
          500: '#273951',
          600: '#061b31',
          700: '#0d253d',
          900: '#1c1e54',
        },
        slate: {
          400: '#64748d',
        },
        border: {
          DEFAULT: '#e5edf5',
          purple: '#b9b9f9',
        },
        success: {
          DEFAULT: '#15be53',
          text: '#108c3d',
        },
      },
      boxShadow: {
        'stripe': 'rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px',
        'stripe-sm': 'rgba(50,50,93,0.15) 0px 6px 12px -2px, rgba(0,0,0,0.05) 0px 3px 7px -3px',
        'stripe-hover': 'rgba(50,50,93,0.30) 0px 35px 50px -28px, rgba(0,0,0,0.12) 0px 22px 40px -16px',
      },
      borderRadius: {
        'stripe': '4px',
      },
    },
  },
  plugins: [],
};
export default config;
