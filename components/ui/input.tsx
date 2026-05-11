import { cn } from '@/lib/utils';
import * as React from 'react';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-10 w-full rounded-md bg-white px-3.5 text-sm text-ink-900',
      'border border-ink-200 placeholder:text-ink-400',
      'transition-colors',
      'hover:border-ink-300',
      'focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60',
      'disabled:bg-ink-50 disabled:text-ink-400 disabled:cursor-not-allowed',
      className,
    )}
    {...p}
  />
));
Input.displayName = 'Input';

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-600',
        className,
      )}
      {...p}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-bordeaux-600">{error}</p>}
    </div>
  );
}
