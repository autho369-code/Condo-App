import { cn } from '@/lib/utils';
import * as React from 'react';

/* Low-level table parts (kept for existing imports) + a high-level DataTable. */

export function Table({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <table className={cn('w-full text-sm', className)} {...p} />
    </div>
  );
}
export function THead(p: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500" {...p} />;
}
export function TR({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-gray-50 last:border-0 hover:bg-gray-50/60', className)} {...p} />;
}
export function TH({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-2.5 text-left font-medium', className)} {...p} />;
}
export function TD({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle text-[13px] text-gray-700', className)} {...p} />;
}

/* ── DataTable: declarative list table with empty state ──────────────── */

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
};

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  rowKey,
  empty,
  onRowHref,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
  onRowHref?: (row: T) => string | undefined;
}) {
  if (!rows.length && empty) {
    return (
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {empty}
      </div>
    );
  }
  const alignCls = { left: 'text-left', right: 'text-right', center: 'text-center' };
  return (
    <Table>
      <THead>
        <tr>
          {columns.map((c) => (
            <TH key={c.key} className={cn(c.align && alignCls[c.align], c.className)}>{c.header}</TH>
          ))}
        </tr>
      </THead>
      <tbody>
        {rows.map((row) => {
          const href = onRowHref?.(row);
          return (
            <TR key={rowKey(row)} className={href ? 'cursor-pointer' : undefined}>
              {columns.map((c) => (
                <TD key={c.key} className={cn(c.align && alignCls[c.align], c.className)}>
                  {href ? (
                    <a href={href} className="block -mx-4 -my-3 px-4 py-3">
                      {c.render ? c.render(row) : row[c.key]}
                    </a>
                  ) : c.render ? c.render(row) : row[c.key]}
                </TD>
              ))}
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}
