import { cn } from '@/lib/utils';
import * as React from 'react';

export function Table({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className={cn('w-full text-sm', className)} {...p} />
    </div>
  );
}
export function THead(p: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600" {...p} />;
}
export function TR(p: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="border-t border-gray-100 last:border-b-0" {...p} />;
}
export function TH({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-2 text-left font-semibold', className)} {...p} />;
}
export function TD({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-top', className)} {...p} />;
}
