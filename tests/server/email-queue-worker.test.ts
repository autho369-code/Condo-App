import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve('app/api/email/process-queue/route.ts'), 'utf8');
const migration = readFileSync(resolve('supabase/migrations/20260730004000_durable_email_queue_worker.sql'), 'utf8');
const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));

describe('durable email queue worker', () => {
  it('is scheduled every minute and fails closed behind the cron secret', () => {
    expect(vercel.crons).toContainEqual({ path: '/api/email/process-queue', schedule: '* * * * *' });
    expect(route).toContain('requireCronSecret(request)');
    expect(route).toContain("if (!process.env.RESEND_API_KEY)");
  });

  it('claims atomically and uses provider idempotency', () => {
    expect(migration).toContain('for update skip locked');
    expect(migration).toContain("processing_at < now() - interval '10 minutes'");
    expect(route).toContain(".rpc('claim_email_queue'");
    expect(route).toContain('idempotencyKey: `email-queue-${email.id}`');
  });

  it('records bounded retries and only reports a communication sent after completion', () => {
    expect(migration).toContain('attempt_count between 0 and 5');
    expect(migration).toContain("when 3 then interval '25 minutes'");
    expect(migration).toContain("set status = 'sent', sent_at = now()");
    expect(migration).toContain('where communication_message_id = v_message_id and status <> \'sent\'');
    expect(migration).toContain("set status = 'failed'");
  });
});
