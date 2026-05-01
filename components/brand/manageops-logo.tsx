// ManageOps brand mark + wordmark.
// Pure SVG, no image asset required. Theme-able via Tailwind currentColor.
//
// Usage:
//   <ManageOpsLogo />            → mark + wordmark (default)
//   <ManageOpsLogo markOnly />   → just the geometric mark
//   <ManageOpsLogo size="sm" />  → smaller variant for footers
import * as React from 'react';

type Props = {
  markOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function ManageOpsLogo({ markOnly = false, size = 'md', className = '' }: Props) {
  const heights = { sm: 20, md: 28, lg: 36 } as const;
  const h = heights[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="ManageOps">
      <svg
        height={h}
        width={h}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="28" height="28" rx="7" fill="url(#mo-grad)" />
        {/* Stylized "M" — two upstrokes meeting at apex */}
        <path
          d="M9 22 L9 11 L13 11 L16 16 L19 11 L23 11 L23 22 L20 22 L20 15.5 L17 20 L15 20 L12 15.5 L12 22 Z"
          fill="white"
        />
      </svg>
      {!markOnly && (
        <span
          className="font-semibold tracking-tight text-gray-900"
          style={{ fontSize: size === 'sm' ? '0.95rem' : size === 'lg' ? '1.4rem' : '1.15rem' }}
        >
          ManageOps
        </span>
      )}
    </span>
  );
}
