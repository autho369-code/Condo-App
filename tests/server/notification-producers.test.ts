import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const queue = readFileSync(resolve('lib/email/queue.ts'), 'utf8');
const maintenance = readFileSync(resolve('app/api/maintenance/send-reminders/route.ts'), 'utf8');
const insurance = readFileSync(resolve('app/api/insurance/send-reminders/route.ts'), 'utf8');

describe('scheduled notification producers', () => {
  it('uses queue-level idempotency for replay-safe producers', () => {
    expect(queue).toContain(".upsert(rows, { onConflict: 'idempotency_key', ignoreDuplicates: true })");
    expect(maintenance).toContain('idempotencyKey: `maintenance-reminder:');
    expect(insurance).toContain('idempotencyKey: `insurance-reminder:');
  });

  it('uses escaped text for maintenance mail instead of interpolated HTML', () => {
    expect(maintenance).toContain('text: body');
    expect(maintenance).not.toContain("body.replace(/\\n/g, '<br>')");
  });

  it('stamps insurance windows only after durable queue success', () => {
    const queuePosition = insurance.indexOf('await queueEmails(svc, emails)');
    const stampPosition = insurance.indexOf("const stamp: Record<string, string>");
    expect(queuePosition).toBeGreaterThan(0);
    expect(stampPosition).toBeGreaterThan(queuePosition);
  });
});
