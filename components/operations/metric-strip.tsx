import * as React from 'react';

export type Metric = {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded border border-gray-200 bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase text-gray-500">{metric.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-950">{metric.value}</div>
          {metric.sublabel && <div className="mt-1 text-xs text-gray-500">{metric.sublabel}</div>}
        </div>
      ))}
    </div>
  );
}
