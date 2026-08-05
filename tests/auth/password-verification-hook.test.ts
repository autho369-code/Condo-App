import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260803080000_password_verification_audit_hook.sql', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');
const recovery = readFileSync('scripts/reset-mfa-break-glass.mjs', 'utf8');

describe('Supabase Auth password boundary', () => {
  it('audits direct password verification attempts inside Supabase Auth', () => {
    expect(config).toContain('# [auth.hook.password_verification_attempt]');
    expect(config).toContain('# uri = "pg-functions://postgres/public/hook_password_verification_attempt"');
    expect(migration).toContain('function public.hook_password_verification_attempt(event jsonb)');
    expect(migration).toContain('insert into public.login_attempts');
    expect(migration).toContain("return jsonb_build_object('decision', 'continue')");
    expect(migration).toContain('to supabase_auth_admin');
  });

  it('enriches the hook row instead of duplicating application sign-in activity', () => {
    expect(migration).toContain("la.at >= now() - interval '30 seconds'");
    expect(migration).toContain('la.ip_address is null');
    expect(migration).toContain('for update skip locked');
  });

  it('keeps sole-operator recovery explicit, confirmed, and audited', () => {
    expect(recovery).toContain("flag('confirm-email')");
    expect(recovery).toContain('SUPABASE_URL does not match --project-ref');
    expect(recovery).toContain("action: 'mfa_break_glass_authorized'");
    expect(recovery).toContain("action: 'mfa_break_glass_completed'");
    expect(recovery).not.toContain('console.log(serviceRoleKey');
  });
});
