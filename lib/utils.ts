import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { displayTimeZone } from '@/lib/time/display-zone';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function money(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  const n = typeof cents === 'string' ? parseFloat(cents) : cents;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// Server components render in UTC, so timestamps need an explicit zone or an
// evening event shows as the next day. Without one, use the viewer's
// association zone for this request (see lib/time/display-zone.ts).
export function date(d: string | Date | null | undefined, fmt: 'short' | 'long' = 'short', timeZone: string = displayTimeZone()): string {
  if (!d) return '—';
  const opts: Intl.DateTimeFormatOptions = fmt === 'long'
    ? { year: 'numeric', month: 'long', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  if (typeof d === 'string') {
    // Date-only strings (YYYY-MM-DD) are calendar days, not instants: format
    // them as that exact day (new Date() would read UTC midnight, a day early
    // in US time zones).
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
  }
  const obj = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(obj.getTime())) return '—';
  return obj.toLocaleDateString('en-US', { ...opts, timeZone });
}
