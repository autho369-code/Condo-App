import * as React from 'react';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const toneClass: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-600 ring-gray-500/15',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
  info: 'bg-blue-50 text-blue-700 ring-blue-600/15',
};

export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
