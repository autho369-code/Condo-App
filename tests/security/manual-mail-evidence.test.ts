import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260802010000_manual_certified_mail_evidence.sql', 'utf8');

describe('manual certified-mail evidence boundary', () => {
  it('requires an authenticated portfolio administrator and durable evidence', () => {
    expect(migration).toContain('public.can_admin_portfolio(mail.portfolio_id)');
    expect(migration).toContain('mail.delinquency_case_id is null');
    expect(migration).toContain('char_length(evidence_note) < 20');
    expect(migration).toContain("provider = 'manual_usps'");
    expect(migration).toContain('delivery_verified_by = auth.uid()');
    expect(migration).toContain("'manual_certified_mail_delivery_recorded'");
  });

  it('does not expose the attestation RPC anonymously', () => {
    expect(migration).toMatch(/record_manual_certified_mail_delivery[\s\S]*from public, anon/);
    expect(migration).toMatch(/record_manual_certified_mail_delivery[\s\S]*to authenticated, service_role/);
  });
});
