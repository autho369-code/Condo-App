/**
 * Platform health summary (platform_health_summary RPC, 20261024010000):
 * failed scheduled database jobs and failure counts for the last N hours.
 * Read by the System Monitor and the daily /api/platform/health-alert cron,
 * which emails the platform operator only when something failed.
 */

export interface CronFailure {
  job: string;
  started_at: string;
  status: string;
  message: string;
}

export interface PlatformHealthSummary {
  since: string;
  cron_failures: CronFailure[];
  emails_failed: number;
  emails_stuck: number;
  webhooks_failed: number;
  reports_failed: number;
  automations_failed: number;
  stripe_events_failed: number;
  autopay_failed: number;
  /** Sent 2h+ ago with no delivered/bounced/complaint report from the provider (20261025020000). */
  emails_unconfirmed?: number;
  /** Failed password sign-ins in the window (20261025020000; absent before). */
  sign_in_failures?: number;
  /** The most failed sign-ins against any one account in the window. */
  sign_in_failures_one_account?: number;
}

/** Failed sign-ins worth a look: a busy day, or one account being guessed at. */
export const SIGN_IN_FAILURES_ALERT = 25;
export const SIGN_IN_FAILURES_ONE_ACCOUNT_ALERT = 10;

/** Plain-language lines for each non-zero item; empty when all is healthy. */
export function healthProblems(s: PlatformHealthSummary): string[] {
  const lines: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const failures = s.cron_failures ?? [];
  if (failures.length) {
    const jobs = [...new Set(failures.map((f) => f.job))].join(', ');
    lines.push(`${plural(failures.length, 'scheduled database job run failed', 'scheduled database job runs failed')} (${jobs})`);
  }
  if (s.emails_failed) lines.push(`${plural(s.emails_failed, 'email failed', 'emails failed')} to send`);
  if (s.emails_stuck) lines.push(`${plural(s.emails_stuck, 'email has', 'emails have')} waited over an hour to send (is the email worker running?)`);
  if (s.emails_unconfirmed) lines.push(`${plural(s.emails_unconfirmed, 'sent email has', 'sent emails have')} no delivery report from the email provider (is its delivery webhook set up?)`);
  if (s.webhooks_failed) lines.push(`${plural(s.webhooks_failed, 'webhook delivery', 'webhook deliveries')} failed`);
  if (s.reports_failed) lines.push(`${plural(s.reports_failed, 'report run', 'report runs')} failed`);
  if (s.automations_failed) lines.push(`${plural(s.automations_failed, 'automation run', 'automation runs')} failed or partly failed`);
  if (s.stripe_events_failed) lines.push(`${plural(s.stripe_events_failed, 'Stripe event', 'Stripe events')} could not be processed`);
  if (s.autopay_failed) lines.push(`${plural(s.autopay_failed, 'AutoPay run', 'AutoPay runs')} failed`);
  const signIns = s.sign_in_failures ?? 0;
  const oneAccount = s.sign_in_failures_one_account ?? 0;
  if (signIns >= SIGN_IN_FAILURES_ALERT || oneAccount >= SIGN_IN_FAILURES_ONE_ACCOUNT_ALERT) {
    lines.push(`${plural(signIns, 'failed sign-in', 'failed sign-ins')}${oneAccount >= SIGN_IN_FAILURES_ONE_ACCOUNT_ALERT ? `, ${oneAccount} against one account` : ''} (see the Security Center)`);
  }
  return lines;
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The operator alert email. Counts and job names only (no recipients or contents). */
export function healthAlertEmail(problems: string[], monitorUrl: string) {
  const subject = `System health: ${problems.length} ${problems.length === 1 ? 'problem' : 'problems'} in the last 24 hours`;
  const body = `
<p>Hello,</p>
<p>The daily system check found:</p>
<ul>
${problems.map((p) => `<li>${escapeHtml(p)}</li>`).join('\n')}
</ul>
<p><a href="${escapeHtml(monitorUrl)}">Open the System Monitor</a> for the details.</p>
<p>This email is sent only on days when something failed.</p>`.trim();
  return { subject, body };
}
