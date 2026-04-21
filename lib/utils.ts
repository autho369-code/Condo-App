import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function money(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  const n = typeof cents === 'string' ? parseFloat(cents) : cents;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function date(d: string | Date | null | undefined, fmt: 'short' | 'long' = 'short'): string {
  if (!d) return '—';
  const obj = typeof d === 'string' ? new Date(d) : d;
  return obj.toLocaleDateString('en-US', fmt === 'long'
    ? { year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
}
