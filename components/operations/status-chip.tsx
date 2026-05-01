import * as React from 'react';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const toneClass: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700 ring-gray-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
};

export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center rounded px-2 text-xs font-medium ring-1 ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
