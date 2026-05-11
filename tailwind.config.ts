import type { Config } from 'tailwindcss';

/**
 * Portier — Premium design system
 * -----------------------------------------------------------
 * Editorial, luxury real-estate aesthetic for property managers.
 *
 *   ink        deep warm charcoal — primary text, structural surfaces
 *   cream      ivory / parchment — page + card backgrounds
 *   champagne  muted brushed-gold accent — CTAs, focus, active state
 *   sage       refined green — positive / monetary states
 *   bordeaux   restrained burgundy — danger / overdue
 *
 * The legacy `brand-*` palette is retained but remapped to ink so
 * existing utility classes (bg-brand-600, text-brand-700) cascade
 * into the new look without touching every file.
 */

const ink = {
  50:  '#F5F5F4',
  100: '#E7E5E2',
  200: '#C9C5BF',
  300: '#A8A39C',
  400: '#7B7770',
  500: '#52504A',
  600: '#33322E',
  700: '#23221F',
  800: '#1A1916',
  900: '#121110',
  950: '#0A0908',
};

const cream = {
  50:  '#FCFAF6',
  100: '#F8F4EC',
  200: '#EFE9DD',
  300: '#E2DAC9',
  400: '#CDC2AB',
  500: '#A89C82',
};

const champagne = {
  50:  '#FBF6EC',
  100: '#F4ECD8',
  200: '#E6D7B0',
  300: '#D4BD86',
  400: '#C2A361',
  500: '#A8884A',
  600: '#8C6F3A',
  700: '#6E572D',
  800: '#523F22',
  900: '#372A18',
};

const sage = {
  50:  '#F2F4F0',
  100: '#E0E5DA',
  200: '#C2CCB6',
  300: '#9FAE8F',
  400: '#7B8B6B',
  500: '#5C6B4F',
  600: '#48553D',
  700: '#36402E',
};

const bordeaux = {
  50:  '#FBF1F0',
  100: '#F4DAD7',
  300: '#D89A93',
  500: '#A03A30',
  600: '#82281F',
  700: '#5F1A14',
};

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink,
        cream,
        champagne,
        sage,
        bordeaux,
        // Legacy brand alias → new ink palette so existing classes redesign
        brand: {
          50:  cream[100],
          100: cream[200],
          200: cream[300],
          500: ink[700],
          600: ink[800],
          700: ink[900],
          800: ink[950],
          900: ink[950],
        },
        // Quick semantic alias used by chips & metric tiles
        accent: champagne,
      },
      fontFamily: {
        sans:    ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif:   ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        display: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono:    ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest:  '-0.04em',
        editorial: '-0.02em',
      },
      boxShadow: {
        'soft-sm': '0 1px 2px 0 rgba(18, 17, 16, 0.04)',
        'soft':    '0 2px 6px -1px rgba(18, 17, 16, 0.06), 0 1px 3px -1px rgba(18, 17, 16, 0.04)',
        'soft-lg': '0 12px 32px -8px rgba(18, 17, 16, 0.10), 0 4px 10px -4px rgba(18, 17, 16, 0.05)',
        'inset-hairline': 'inset 0 0 0 1px rgba(18, 17, 16, 0.08)',
      },
      borderRadius: {
        xs: '3px',
      },
      backgroundImage: {
        'cream-gradient':     'linear-gradient(180deg, #FBF9F4 0%, #F8F4EC 100%)',
        'ink-gradient':       'linear-gradient(180deg, #1A1916 0%, #0A0908 100%)',
        'champagne-shimmer':  'linear-gradient(135deg, #F4ECD8 0%, #E6D7B0 50%, #D4BD86 100%)',
      },
    },
  },
  plugins: [],
};
export default config;
