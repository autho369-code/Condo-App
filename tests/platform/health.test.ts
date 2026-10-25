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

  it('alerts on a busy day of failed sign-ins or one account being guessed at, not a few typos', () => {
    expect(healthProblems({ ...healthy, sign_in_failures: 6, sign_in_failures_one_account: 3 })).toEqual([]);
    expect(healthProblems({ ...healthy, sign_in_failures: 30, sign_in_failures_one_account: 2 }))
      .toEqual(['30 failed sign-ins (see the Security Center)']);
    expect(healthProblems({ ...healthy, sign_in_failures: 12, sign_in_failures_one_account: 12 }))
      .toEqual(['12 failed sign-ins, 12 against one account (see the Security Center)']);
  });

  it('flags sent mail the email provider never reported on', () => {
    expect(healthProblems({ ...healthy, emails_unconfirmed: 6 }))
      .toEqual(['6 sent emails have no delivery report from the email provider (is its delivery webhook set up?)']);
  });

  it('escapes the email text', () => {
    const { subject, body } = healthAlertEmail(['<b>x</b>'], 'https://portier369.com/platform-operator/system');
    expect(subject).toBe('System health: 1 problem in the last 24 hours');
    expect(body).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(body).not.toContain('<b>x</b>');
  });
});
