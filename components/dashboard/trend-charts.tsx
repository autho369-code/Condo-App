'use client';

import { useState } from 'react';

/**
 * Dashboard trend charts — cash flow, billed vs collected, work-order
 * throughput. Plain SVG (no chart dependency), matching the gray-surface
 * design system. Series hues #2563eb / #d97706 validated for CVD
 * separation and 3:1 surface contrast (2026-07-26).
 */

export interface MonthPoint {
  label: string; // "Mar"
  a: number;
  b: number;
}

interface ChartDef {
  title: string;
  sub: string;
  seriesA: string;
  seriesB: string;
  points: MonthPoint[];
  money?: boolean;
  kind: 'bars' | 'lines';
}

const HUE_A = '#2563eb';
const HUE_B = '#d97706';

const fmtMoney = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`;
const fmt = (v: number, money?: boolean) => (money ? fmtMoney(v) : String(Math.round(v)));

function niceMax(values: number[]) {
  const m = Math.max(...values, 1);
  const pow = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 2, 2.5, 5, 10]) if (m <= k * pow) return k * pow;
  return m;
}

const W = 320;
const H = 150;
const PAD_L = 8;
const PAD_B = 18;
const PAD_T = 12;
const PLOT_H = H - PAD_T - PAD_B;

function Chart({ def }: { def: ChartDef }) {
  const [hover, setHover] = useState<number | null>(null);
  const { points, kind } = def;
  const n = points.length;
  const max = niceMax(points.flatMap((p) => [p.a, p.b]));
  const slot = (W - PAD_L * 2) / Math.max(n, 1);
  const y = (v: number) => PAD_T + PLOT_H * (1 - v / max);

  const barW = Math.min(14, slot / 2 - 4);

  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-gray-950">{def.title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{def.sub}</p>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: HUE_A }} aria-hidden />
          {def.seriesA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: HUE_B }} aria-hidden />
          {def.seriesB}
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-2 w-full"
          role="img"
          aria-label={`${def.title}: ${def.seriesA} and ${def.seriesB} by month`}
          onMouseLeave={() => setHover(null)}
        >
          {/* recessive gridlines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={PAD_L}
              x2={W - PAD_L}
              y1={PAD_T + PLOT_H * f}
              y2={PAD_T + PLOT_H * f}
              stroke="#f3f4f6"
              strokeWidth={1}
            />
          ))}
          <line x1={PAD_L} x2={W - PAD_L} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke="#e5e7eb" strokeWidth={1} />

          {kind === 'bars'
            ? points.map((p, i) => {
                const cx = PAD_L + slot * i + slot / 2;
                return (
                  <g key={i}>
                    <rect
                      x={cx - barW - 1}
                      y={y(p.a)}
                      width={barW}
                      height={Math.max(PAD_T + PLOT_H - y(p.a), p.a > 0 ? 2 : 0)}
                      rx={3}
                      fill={HUE_A}
                    />
                    <rect
                      x={cx + 1}
                      y={y(p.b)}
                      width={barW}
                      height={Math.max(PAD_T + PLOT_H - y(p.b), p.b > 0 ? 2 : 0)}
                      rx={3}
                      fill={HUE_B}
                    />
                  </g>
                );
              })
            : (['a', 'b'] as const).map((key) => (
                <polyline
                  key={key}
                  fill="none"
                  stroke={key === 'a' ? HUE_A : HUE_B}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points
                    .map((p, i) => `${PAD_L + slot * i + slot / 2},${y(p[key])}`)
                    .join(' ')}
                />
              ))}

          {kind === 'lines' &&
            points.map((p, i) => (
              <g key={i}>
                <circle cx={PAD_L + slot * i + slot / 2} cy={y(p.a)} r={hover === i ? 4 : 2.5} fill={HUE_A} stroke="#fff" strokeWidth={1.5} />
                <circle cx={PAD_L + slot * i + slot / 2} cy={y(p.b)} r={hover === i ? 4 : 2.5} fill={HUE_B} stroke="#fff" strokeWidth={1.5} />
              </g>
            ))}

          {/* month labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={PAD_L + slot * i + slot / 2}
              y={H - 4}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={10}
            >
              {p.label}
            </text>
          ))}

          {/* hover hit targets (full column) */}
          {points.map((_, i) => (
            <rect
              key={i}
              x={PAD_L + slot * i}
              y={0}
              width={slot}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}

          {hover !== null && (
            <line
              x1={PAD_L + slot * hover + slot / 2}
              x2={PAD_L + slot * hover + slot / 2}
              y1={PAD_T}
              y2={PAD_T + PLOT_H}
              stroke="#d1d5db"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
        </svg>

        {hover !== null && points[hover] && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{
              left: `${((PAD_L + slot * hover + slot / 2) / W) * 100}%`,
              transform: hover > points.length / 2 ? 'translateX(-105%)' : 'translateX(8px)',
            }}
          >
            <p className="font-semibold text-gray-950">{points[hover].label}</p>
            <p className="mt-0.5 text-gray-600">
              <span className="mr-1 inline-block h-2 w-2 rounded-full align-baseline" style={{ background: HUE_A }} />
              {def.seriesA}: <span className="font-medium text-gray-900">{fmt(points[hover].a, def.money)}</span>
            </p>
            <p className="text-gray-600">
              <span className="mr-1 inline-block h-2 w-2 rounded-full align-baseline" style={{ background: HUE_B }} />
              {def.seriesB}: <span className="font-medium text-gray-900">{fmt(points[hover].b, def.money)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Accessible table view */}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-medium text-gray-400 hover:text-gray-600">
          View as table
        </summary>
        <table className="mt-1 w-full text-left text-xs text-gray-600">
          <thead>
            <tr className="text-gray-400">
              <th className="py-1 font-medium">Month</th>
              <th className="py-1 font-medium">{def.seriesA}</th>
              <th className="py-1 font-medium">{def.seriesB}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1">{p.label}</td>
                <td className="py-1">{fmt(p.a, def.money)}</td>
                <td className="py-1">{fmt(p.b, def.money)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function TrendCharts({
  cashFlow,
  billedCollected,
  workOrders,
}: {
  cashFlow: MonthPoint[];
  billedCollected: MonthPoint[];
  workOrders: MonthPoint[];
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Chart
        def={{
          title: 'Cash flow',
          sub: 'Payments received vs bills paid, last 6 months.',
          seriesA: 'Money in',
          seriesB: 'Money out',
          points: cashFlow,
          money: true,
          kind: 'bars',
        }}
      />
      <Chart
        def={{
          title: 'Billed vs collected',
          sub: 'Assessments charged vs payments received.',
          seriesA: 'Billed',
          seriesB: 'Collected',
          points: billedCollected,
          money: true,
          kind: 'bars',
        }}
      />
      <Chart
        def={{
          title: 'Work orders',
          sub: 'Opened vs completed per month.',
          seriesA: 'Opened',
          seriesB: 'Completed',
          points: workOrders,
          kind: 'lines',
        }}
      />
    </div>
  );
}
