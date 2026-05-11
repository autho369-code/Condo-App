import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Editorial table style — hairline rows, ivory header, tabular numerals
 * by default. Designed to feel like a refined ledger, not an admin grid.
 */

export function Table({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white shadow-soft-sm">
      <table className={cn('w-full text-sm tabular-nums', className)} {...p} />
    </div>
  );
}

export function THead(p: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className="bg-cream-100 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-600"
      {...p}
    />
  );
}

export function TR({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-t border-ink-100 transition-colors hover:bg-cream-50/60 last:border-b-0',
        className,
      )}
      {...p}
    />
  );
}

export function TH({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('px-4 py-3 text-left text-ink-700', className)}
      {...p}
    />
  );
}

export function TD({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-3.5 align-top text-ink-800', className)}
      {...p}
    />
  );
}
