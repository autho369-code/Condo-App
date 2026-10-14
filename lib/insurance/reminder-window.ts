// Which expiry reminder (30 or 15 days) a policy is due today, given the days
// left counted from its association's own calendar day. Each window is sent
// once (reminder_*_sent_at); a policy first seen inside 15 days gets the
// 15-day reminder only.
export function reminderWindow(
  daysLeft: number,
  sent: { reminder_30_sent_at?: string | null; reminder_15_sent_at?: string | null },
): 15 | 30 | null {
  if (!Number.isFinite(daysLeft) || daysLeft < 0 || daysLeft > 30) return null;
  if (daysLeft <= 15) return sent.reminder_15_sent_at ? null : 15;
  return sent.reminder_30_sent_at ? null : 30;
}
