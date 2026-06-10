import * as React from 'react';

export type Metric = {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="group rounded-xl border border-gray-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_1px_3px_rgba(16,24,40,0.08),0_4px_12px_-4px_rgba(16,24,40,0.1)]"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">
            {metric.label}
          </div>
          <div className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.01em] text-gray-950">
            {metric.value}
          </div>
          {metric.sublabel && <div className="mt-2 text-xs text-gray-500">{metric.sublabel}</div>}
        </div>
      ))}
    </div>
  );
}
