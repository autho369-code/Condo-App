import type { CSSProperties } from 'react';

/** The platform's own color, used where no company color applies. */
export const DEFAULT_BRAND = '#10B981';

/**
 * CSS variables for a workspace's company color: `--brand` and `--brand-ink`
 * (black or white, whichever reads better on it). Anything that is not a
 * #RRGGBB color falls back to the default (the DB and middleware enforce the
 * format too).
 */
export function brandStyle(color?: string | null): CSSProperties {
  const brand = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_BRAND;
  return { ['--brand' as string]: brand, ['--brand-ink' as string]: inkOn(brand) } as CSSProperties;
}

/** Black or white text on a background color, by WCAG relative luminance. */
export function inkOn(hex: string): '#0e1116' | '#ffffff' {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast with white is (1.05)/(lum+0.05); with near-black (lum+0.05)/0.06.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.0587 ? '#ffffff' : '#0e1116';
}
