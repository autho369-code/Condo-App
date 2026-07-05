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
  let obj: Date;
  if (typeof d === 'string') {
    // Date-only strings (YYYY-MM-DD) must parse as LOCAL dates — new Date()
    // treats them as UTC midnight, which renders a day early in US timezones.
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    obj = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
  } else {
    obj = d;
  }
  return obj.toLocaleDateString('en-US', fmt === 'long'
    ? { year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
}
