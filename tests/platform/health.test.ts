import { describe, expect, it } from 'vitest';
import { healthAlertEmail, healthProblems, type PlatformHealthSummary } from '@/lib/platform/health';

const healthy: PlatformHealthSummary = {
  since: '2026-10-23T00:00:00Z',
  cron_failures: [],
  emails_failed: 0,
  emails_stuck: 0,
  webhooks_failed: 0,
  reports_failed: 0,
  automations_failed: 0,
  stripe_events_failed: 0,
  autopay_failed: 0,
};

describe('platform health alert', () => {
  it('reports nothing on a healthy day', () => {
    expect(healthProblems(healthy)).toEqual([]);
  });

  it('lists each failure kind with job names', () => {
    const problems = healthProblems({
      ...healthy,
      cron_failures: [
        { job: 'expire-idle-sessions', started_at: '2026-10-23T01:00:00Z', status: 'failed', message: 'job startup timeout' },
        { job: 'expire-idle-sessions', started_at: '2026-10-23T02:00:00Z', status: 'failed', message: 'job startup timeout' },
      ],
      emails_failed: 1,
      emails_stuck: 3,
      stripe_events_failed: 2,
    });
    expect(problems).toEqual([
      '2 scheduled database job runs failed (expire-idle-sessions)',
      '1 email failed to send',
      '3 emails have waited over an hour to send (is the email worker running?)',
      '2 Stripe events could not be processed',
    ]);
  });

  it('escapes the email text', () => {
    const { subject, body } = healthAlertEmail(['<b>x</b>'], 'https://portier369.com/platform-operator/system');
    expect(subject).toBe('System health: 1 problem in the last 24 hours');
    expect(body).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(body).not.toContain('<b>x</b>');
  });
});
