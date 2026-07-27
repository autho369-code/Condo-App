import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = fileURLToPath(new URL(
  '../../supabase/migrations/20260726040000_database_tenant_security_hardening.sql',
  import.meta.url,
));
const migration = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('database tenant-security migration', () => {
  it('fail-closes internal payment and insurance mutators', () => {
    expect(migration).toContain(
      'revoke all on function public.apply_payment(uuid, text, uuid[]) from public, anon, authenticated',
    );
    expect(migration).toContain(
      'grant execute on function public.apply_payment(uuid, text, uuid[]) to service_role',
    );
    expect(migration).toContain(
      'revoke all on function public.check_insurance_expirations() from public, anon, authenticated',
    );
  });

  it('requires authenticated tenant authorization in budget RPCs', () => {
    expect(migration).toContain('create or replace function public.can_read_association_budget');
    expect(migration).toContain('auth.uid() is not null');
    expect(migration).toContain('public.current_board_association_ids()');
    expect(migration).toContain('public.can_manage_finance(a.portfolio_id)');
    expect(migration).toContain('budget line association cannot be changed');
    expect(migration).toContain('ga.portfolio_id = v_target_portfolio_id');
    expect(migration).toContain('cardinality(p_monthly_amounts) <> 12');
  });

  it('binds meeting owners and document paths to their tenant targets', () => {
    expect(migration).toContain('trg_validate_meeting_attendee_tenant_scope');
    expect(migration).toContain('residents may only sign in themselves');
    expect(migration).toContain('create or replace function public.document_portfolio_id');
    expect(migration).toContain('create or replace function public.document_path_matches_entity');
    expect(migration).toContain("p_file_url like 'associations/' || p_entity_id::text || '/%'");
    expect(migration).toContain('documents_board_association_read');
  });

  it('rebuilds audited policies and leaves unscoped inventory platform-only', () => {
    expect(migration).toContain("'budget_lines', 'documents', 'insurance_policies', 'house_rules'");
    expect(migration).toContain('maintenance_tasks_staff_tenant_all');
    expect(migration).toContain('maintenance_history_staff_tenant_all');
    expect(migration).toContain('violation_cases_staff_tenant_all');
    expect(migration).toContain('create policy inventory_platform_only');
    expect(migration).not.toContain('inventory_staff');
  });
});
