import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';

export const SCHEDULE_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Yearly',
};

export function frequencyLabel(f: string) {
  return FREQUENCY_LABELS[f] ?? f;
}

/** UTC hour for a local hour today in `zone`, or null when that hour falls on another UTC day. */
export function toUtcHour(localHour: number, zone: string): number | null {
  const day = todayInZone(zone);
  const at = zonedWallTimeToUtc(day, `${String(localHour).padStart(2, '0')}:00`, zone);
  if (!at) return null;
  // Day-of-week and day-of-month are stored for the UTC day, so only hours that
  // stay on the same calendar day in UTC are offered.
  if (at.toISOString().slice(0, 10) !== day) return null;
  return at.getUTCHours();
}

/** Local hours (0-23) whose run stays on the same calendar day in UTC. */
export function localHourOptions(zone: string): number[] {
  return Array.from({ length: 24 }, (_, h) => h).filter((h) => toUtcHour(h, zone) != null);
}

/** The local hour for a stored UTC hour, today, in `zone`. */
export function fromUtcHour(hourUtc: number | null | undefined, zone: string): number {
  const d = new Date();
  d.setUTCHours(hourUtc ?? 8, 0, 0, 0);
  const local = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(d);
  return Number(local) % 24;
}

export function hourLabel(h: number) {
  const suffix = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** e.g. "Monthly on the 1st at 8:00 AM". */
export function describeSchedule(row: { frequency: string; day_of_week?: number | null; day_of_month?: number | null; hour_utc?: number | null }, zone: string) {
  const at = hourLabel(fromUtcHour(row.hour_utc, zone));
  switch (row.frequency) {
    case 'daily': return `Daily at ${at}`;
    case 'weekly': return `Weekly on ${WEEKDAYS[row.day_of_week ?? 1]} at ${at}`;
    case 'biweekly': return `Every two weeks on ${WEEKDAYS[row.day_of_week ?? 1]} at ${at}`;
    case 'monthly': return `Monthly on the ${ordinal(row.day_of_month ?? 1)} at ${at}`;
    case 'quarterly': return `Quarterly on the ${ordinal(row.day_of_month ?? 1)} at ${at}`;
    case 'annually': return `Yearly on January ${row.day_of_month ?? 1} at ${at}`;
    default: return frequencyLabel(row.frequency);
  }
}
