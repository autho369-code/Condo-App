import * as React from 'react';

export type Metric = {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
};

const TONE: Record<NonNullable<Metric['tone']>, string> = {
  neutral:  'text-ink-900',
  positive: 'text-sage-700',
  warning:  'text-champagne-700',
  danger:   'text-bordeaux-700',
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-ink-100 bg-ink-100 shadow-soft-sm md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => (
        <div key={m.label} className="bg-white px-5 py-4">
          <div className="eyebrow">{m.label}</div>
          <div className={`mt-2 font-display text-3xl number-plate ${TONE[m.tone ?? 'neutral']}`}>
            {m.value}
          </div>
          {m.sublabel && <div className="mt-1 text-xs text-ink-500">{m.sublabel}</div>}
        </div>
      ))}
    </div>
  );
}
