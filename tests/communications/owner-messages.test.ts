import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve('supabase/migrations/20260730002000_secure_owner_communications.sql'), 'utf8');
const page = readFileSync(resolve('app/portal/communications/page.tsx'), 'utf8');

describe('owner-to-management communications', () => {
  it('uses an authenticated atomic RPC with tenant-derived recipients', () => {
    expect(migration).toContain('create or replace function public.submit_owner_message');
    expect(migration).toContain("where auth_user_id = auth.uid()");
    expect(migration).toContain('join public.associations a on a.id = oc.association_id');
    expect(migration).toContain("raise exception 'No management email recipient is configured");
    expect(page).toContain(".rpc('submit_owner_message'");
    expect(page).not.toContain('createServiceClient');
    expect(page).not.toContain('queueEmails');
  });

  it('enforces input bounds, idempotency, durable throttling, and owner-readable history', () => {
    expect(migration).toContain('communications_log_sender_idempotency_unique');
    expect(migration).toContain('email_queue_communication_log_idx');
    expect(migration).toContain(") >= 10 then");
    expect(migration).toContain("length(p_body) < 2 or length(p_body) > 10000");
    expect(migration).toContain('sender_id = auth.uid()');
    expect(page).toContain('name="request_key"');
    expect(page).toContain('maxLength={10000}');
  });
});
