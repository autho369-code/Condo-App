type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';

type NextRunInput = {
  frequency: ScheduleFrequency;
  hourUtc: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  now?: Date;
};

export function computeNextScheduledReportRun({
  frequency,
  hourUtc,
  dayOfWeek,
  dayOfMonth,
  now = new Date(),
}: NextRunInput) {
  const hour = clamp(Math.trunc(hourUtc), 0, 23);
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour));

  if (frequency === 'daily') {
    return nextAfter(base, now, 1).toISOString();
  }

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const targetDay = clamp(Math.trunc(dayOfWeek ?? 1), 0, 6);
    const days = (targetDay - base.getUTCDay() + 7) % 7;
    base.setUTCDate(base.getUTCDate() + days);
    return nextAfter(base, now, frequency === 'biweekly' ? 14 : 7).toISOString();
  }

  const targetDay = clamp(Math.trunc(dayOfMonth ?? 1), 1, 28);
  const monthStep = frequency === 'quarterly' ? 3 : frequency === 'annually' ? 12 : 1;
  base.setUTCDate(targetDay);
  while (base <= now) base.setUTCMonth(base.getUTCMonth() + monthStep, targetDay);
  return base.toISOString();
}

function nextAfter(candidate: Date, now: Date, days: number) {
  while (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + days);
  return candidate;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
