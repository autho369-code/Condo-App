import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'danger' | 'warning' | 'success';

const toneClass: Record<StatTone, string> = {
  default: 'text-gray-950',
  danger: 'text-red-700',
  warning: 'text-amber-700',
  success: 'text-emerald-700',
};

/**
 * One figure in a dashboard grid: label, value (coloured by `tone`), an
 * optional note and an optional icon. On phones the value is smaller and the
 * icon hidden, so large amounts fit a two-column grid; with `href` the whole
 * tile is a link.
 */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ElementType;
  tone?: StatTone;
  href?: string;
  className?: string;
}) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-5 text-gray-500">{label}</div>
        <div className={cn('mt-1.5 text-lg font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-2xl', toneClass[tone])}>{value}</div>
        {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
      </div>
      {Icon && (
        <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70 sm:flex">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      )}
    </div>
  );
  const tile = cn('rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className);
  return href
    ? <Link href={href} className={cn(tile, 'block transition-colors hover:border-gray-300 hover:bg-gray-50/60')}>{body}</Link>
    : <div className={tile}>{body}</div>;
}
