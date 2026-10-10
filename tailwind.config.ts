import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Inter is loaded by next/font in app/layout.tsx (DESIGN_SYSTEM.md).
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
        // Page titles, section titles and key figures (Schibsted Grotesk, app/layout.tsx).
        display: ['var(--font-display)', 'var(--font-inter)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        canvas: 'var(--canvas)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        // The workspace company's color (role shells set it); decorative
        // accents only: status colors never come from it.
        accent: { DEFAULT: 'var(--brand)', ink: 'var(--brand-ink)' },
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },
      },
    },
  },
  plugins: [],
};
export default config;
