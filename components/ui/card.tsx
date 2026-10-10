import { cn } from '@/lib/utils';
import * as React from 'react';

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)} {...p} />;
}
export function CardHeader({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 border-b border-line px-5 py-4', className)} {...p} />;
}
export function CardTitle({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-[16px] font-semibold text-ink', className)} {...p} />;
}
export function CardBody({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...p} />;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card>
      <CardBody>
        <div className="text-[13px] font-medium text-gray-500">{label}</div>
        <div className="mt-1 font-display text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</div>
        {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
      </CardBody>
    </Card>
  );
}
