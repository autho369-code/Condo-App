import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Editorial card surfaces. Hairline borders, soft warm shadow, generous
 * inner padding. CardTitle uses the display serif for an editorial feel.
 */

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-ink-100 bg-white shadow-soft-sm',
        'transition-shadow hover:shadow-soft',
        className,
      )}
      {...p}
    />
  );
}

export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-b border-ink-100 px-5 py-4',
        className,
      )}
      {...p}
    />
  );
}

export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-display text-lg text-ink-900 tracking-editorial',
        className,
      )}
      {...p}
    />
  );
}

export function CardSubtitle({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-ink-500', className)} {...p} />;
}

export function CardBody({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...p} />;
}

/**
 * Stat — editorial KPI tile with eyebrow + serif numeral.
 * Used on dashboards and the resident portal home.
 */
export function Stat({
  label,
  value,
  sub,
  trend,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  trend?: { dir: 'up' | 'down' | 'flat'; label: string };
  accent?: boolean;
}) {
  const trendCls =
    trend?.dir === 'up'
      ? 'text-sage-600'
      : trend?.dir === 'down'
      ? 'text-bordeaux-600'
      : 'text-ink-500';

  return (
    <div
      className={cn(
        'rounded-lg border px-5 py-4 transition-shadow',
        accent
          ? 'border-champagne-300 bg-champagne-50 shadow-soft'
          : 'border-ink-100 bg-white shadow-soft-sm hover:shadow-soft',
      )}
    >
      <div className="eyebrow">{label}</div>
      <div className="mt-2 font-display text-3xl text-ink-900 number-plate">
        {value}
      </div>
      {(sub || trend) && (
        <div className="mt-2 flex items-baseline gap-2 text-xs">
          {trend && (
            <span className={cn('font-medium', trendCls)}>
              {trend.dir === 'up' ? '↑' : trend.dir === 'down' ? '↓' : '→'} {trend.label}
            </span>
          )}
          {sub && <span className="text-ink-500">{sub}</span>}
        </div>
      )}
    </div>
  );
}
