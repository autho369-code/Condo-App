import { isValidTimeZone } from '@/lib/time/display-zone';

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

export const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * The local hour a schedule runs at. Schedules saved with a time zone keep
 * their local hour; older ones stored only a UTC hour, shown in `zone`.
 */
export function scheduleLocalHour(row: { local_hour?: number | null; hour_utc?: number | null }, zone: string): number {
  if (row.local_hour != null) return row.local_hour;
  const d = new Date();
  d.setUTCHours(row.hour_utc ?? 8, 0, 0, 0);
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(d)) % 24;
}

/** Short zone name, e.g. "CDT". */
export function zoneAbbreviation(zone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? zone;
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

/** e.g. "Monthly on the 1st at 8:00 AM CDT". */
export function describeSchedule(
  row: { frequency: string; day_of_week?: number | null; day_of_month?: number | null; hour_utc?: number | null; local_hour?: number | null; time_zone?: string | null },
  displayZone: string,
) {
  const zone = row.local_hour != null && row.time_zone && isValidTimeZone(row.time_zone) ? row.time_zone : displayZone;
  const at = `${hourLabel(scheduleLocalHour(row, zone))} ${zoneAbbreviation(zone)}`;
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
