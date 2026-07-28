
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260728094000_audit_log_and_owner_payable_scope.sql',
);
const migration = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('audit log and owner payable scope migration', () => {
  it('adds a tenant key and removes public audit-log mutation', () => {
    expect(migration).toContain('add column if not exists portfolio_id uuid');
    expect(migration).toContain('drop policy if exists "system insert audit logs"');
    expect(migration).toContain(
      'revoke all privileges on public.audit_logs from anon, authenticated',
    );
    expect(migration).toContain('grant select on public.audit_logs to authenticated');
  });

  it('limits staff audit reads to the current portfolio', () => {
    expect(migration).toContain('create policy audit_logs_tenant_read');
    expect(migration).toContain('portfolio_id = public.current_portfolio_id()');
    expect(migration).toContain('public.is_platform_operator_safe()');
  });

  it('prevents owner payable tenant-key relocation', () => {
    expect(migration).toContain('owner payable portfolio cannot be changed');
    expect(migration).toContain('owner payable association is outside the portfolio');
    expect(migration).toContain('owner payable owner is outside the association');
    expect(migration).not.toContain('with check (true)');
  });
});
