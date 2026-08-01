import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { richTextToPlainText, textToHtml } from '@/lib/email/queue';

const route = readFileSync(resolve('app/api/letters/send/route.ts'), 'utf8');
const action = readFileSync(resolve('app/(app)/communication-center/actions.ts'), 'utf8');
const migration = readFileSync(resolve('supabase/migrations/20260730003000_idempotent_staff_communication_queue.sql'), 'utf8');

describe('staff email delivery', () => {
  it('queues letter email with server-side validation and idempotency', () => {
    expect(route).toContain(".from('document_templates')");
    expect(route).toContain(".from('email_queue')");
    expect(route).toContain("idempotencyKey: `letter:${requestKey}`");
    expect(route).not.toContain("from 'resend'");
    expect(route).not.toContain('resend.emails.send');
  });

  it('removes active content before rebuilding safe HTML', () => {
    const plain = richTextToPlainText('<p>Hello <strong>owner</strong></p><script>alert(1)</script><img src=x onerror=alert(2)>');
    expect(plain).toBe('Hello owner');
    expect(textToHtml(plain)).not.toContain('<script');
    expect(textToHtml(plain)).not.toContain('<img');
  });

  it('queues communication-center messages atomically and exactly once', () => {
    expect(action).toContain(".rpc('enqueue_communication_message'");
    expect(action).not.toContain(".from('email_queue').insert");
    expect(migration).toContain('email_queue_idempotency_key_unique');
    expect(migration).toContain("v_message.status in ('queued', 'sent')");
    expect(migration).toContain("set status = 'queued'");
  });
});
