import * as React from 'react';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export const toneClass: Record<Tone, string> = {
  neutral: 'bg-ink-50 text-ink-700 ring-ink-200',
  success: 'bg-sage-50 text-sage-700 ring-sage-200',
  warning: 'bg-champagne-50 text-champagne-800 ring-champagne-200',
  danger:  'bg-bordeaux-50 text-bordeaux-700 ring-bordeaux-300',
  info:    'bg-cream-100 text-ink-700 ring-ink-200',
  accent:  'bg-champagne-100 text-champagne-800 ring-champagne-300',
};

export function StatusChip({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        'inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ' +
        toneClass[tone]
      }
    >
      {children}
    </span>
  );
}
