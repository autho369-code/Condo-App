import * as React from 'react';

export type Metric = {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="group rounded-2xl border border-line bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        >
          <div className="text-[13px] font-medium leading-5 text-gray-500">
            {metric.label}
          </div>
          <div className="mt-1.5 font-display text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-ink sm:text-[28px]">
            {metric.value}
          </div>
          {metric.sublabel && <div className="mt-2 text-[13px] leading-5 text-gray-500">{metric.sublabel}</div>}
        </div>
      ))}
    </div>
  );
}
