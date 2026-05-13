// Portier brand mark — editorial monogram with champagne accent.
// "Address-plate" badge: ink slab + serif "P" with a champagne accent dot
// reading as a polished hardware finish.
//
// Usage:
//   <ManageOpsLogo />                  → mark + wordmark
//   <ManageOpsLogo markOnly />         → just the badge
//   <ManageOpsLogo size="sm" />        → footer / dense areas
//   <ManageOpsLogo tone="dark" />      → for use on cream backgrounds
//   <ManageOpsLogo tone="light" />     → for use on ink backgrounds
import * as React from 'react';

type Props = {
  markOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'dark' | 'light';
  className?: string;
};

export function ManageOpsLogo({
  markOnly = false,
  size = 'md',
  tone = 'dark',
  className = '',
}: Props) {
  const heights = { sm: 22, md: 30, lg: 40 } as const;
  const h = heights[size];

  const wordColor = tone === 'light' ? 'text-cream-50' : 'text-ink-900';
  const subColor  = tone === 'light' ? 'text-cream-300' : 'text-ink-500';
  const plateBg   = tone === 'light' ? '#F8F4EC' : '#121110';
  const plateInk  = tone === 'light' ? '#121110' : '#F8F4EC';

  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label="Portier">
      <svg
        height={h}
        width={h}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        {/* Address plate */}
        <rect
          x="1" y="1" width="38" height="38" rx="6"
          fill={plateBg}
          stroke="#A8884A" strokeOpacity="0.55" strokeWidth="0.75"
        />
        {/* Hairline interior frame */}
        <rect
          x="3.5" y="3.5" width="33" height="33" rx="4"
          fill="none"
          stroke={plateInk} strokeOpacity="0.10" strokeWidth="0.5"
        />
        {/* Serif "P" — vertical stem with a stroked semi-circle */}
        <path
          d="M 14 11 L 14 29"
          fill="none"
          stroke={plateInk}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M 14 11.5 L 22 11.5 A 4.6 4.6 0 0 1 22 20.7 L 14 20.7"
          fill="none"
          stroke={plateInk}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Champagne accent dot — like a brass period in the wordmark */}
        <circle cx="29" cy="29" r="1.7" fill="#C2A361" />
      </svg>
      {!markOnly && (
        <span className="flex flex-col leading-none">
          <span
            className={`font-display ${wordColor}`}
            style={{
              fontSize: size === 'sm' ? '1.05rem' : size === 'lg' ? '1.55rem' : '1.25rem',
              letterSpacing: '-0.025em',
              fontWeight: 500,
            }}
          >
            Portier<span className="text-champagne-500">.</span>
          </span>
          {size !== 'sm' && (
            <span className={`mt-1 text-[10px] uppercase tracking-[0.22em] ${subColor}`}>
              Association operations, refined.
            </span>
          )}
        </span>
      )}
    </span>
  );
}

// Brand-renamed alias — use either name; they resolve to the same component.
export const PortierLogo = ManageOpsLogo;
