import { todayInZone } from '@/lib/time/zoned';

export const PERIOD_PRESETS = ['this_month', 'last_month', 'this_quarter', 'last_quarter', 'ytd', 'last_year', 'custom'];

export type Period = { from: string; to: string; label: string };

export function computePeriod(preset: string, customFrom?: string, customTo?: string, timeZone?: string): Period {
  // "Today" is the calendar day in the request's display zone, not UTC (late
  // evening in the US was already "tomorrow" and could jump a month/year).
  const [ty, tm, td] = todayInZone(timeZone).split('-').map(Number);
  const today = { y: ty, m: tm - 1, d: td };
  const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  const todayStr = ymd(today.y, today.m, today.d);
  const firstOfMonth = (y: number, m: number) => ymd(y, m, 1);
  const lastOfMonth  = (y: number, m: number) => ymd(y, m + 1, 0);

  if (preset === 'custom') {
    return {
      from:  customFrom ?? firstOfMonth(today.y, today.m),
      to:    customTo   ?? todayStr,
      label: 'Custom',
    };
  }
  if (preset === 'last_month') {
    const d = new Date(Date.UTC(today.y, today.m - 1, 1));
    return { from: firstOfMonth(d.getUTCFullYear(), d.getUTCMonth()), to: lastOfMonth(d.getUTCFullYear(), d.getUTCMonth()), label: 'Last month' };
  }
  if (preset === 'this_quarter') {
    const q = Math.floor(today.m / 3) * 3;
    return { from: firstOfMonth(today.y, q), to: todayStr, label: 'This quarter' };
  }
  if (preset === 'last_quarter') {
    const q = Math.floor(today.m / 3) * 3 - 3;
    const y = q < 0 ? today.y - 1 : today.y;
    const m = (q + 12) % 12;
    return { from: firstOfMonth(y, m), to: lastOfMonth(y, m + 2), label: 'Last quarter' };
  }
  if (preset === 'ytd') {
    return { from: ymd(today.y, 0, 1), to: todayStr, label: 'Year to date' };
  }
  if (preset === 'last_year') {
    return { from: ymd(today.y - 1, 0, 1), to: ymd(today.y - 1, 11, 31), label: 'Last year' };
  }
  // default: this_month
  return { from: firstOfMonth(today.y, today.m), to: todayStr, label: 'This month' };
}

