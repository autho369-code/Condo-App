import * as React from 'react';

export type Metric = {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-xl border border-slate-800 bg-[#0B1121] px-5 py-5 transition-all hover:border-emerald-500/30 hover:shadow-[0_0_40px_-15px_rgba(16,185,129,0.1)] group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{metric.label}</div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-white">{metric.value}</div>
            {metric.sublabel && <div className="mt-2 text-[11px] text-emerald-500/60 group-hover:text-emerald-400 transition-colors">{metric.sublabel}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
