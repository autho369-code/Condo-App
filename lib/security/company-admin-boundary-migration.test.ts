import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260728095000_company_admin_role_boundary.sql',
), 'utf8').toLowerCase();

describe('company administrator database boundary', () => {
  it('requires the explicit company_admin role', () => {
    expect(migration).toContain("p.hoa_role = 'company_admin'");
    expect(migration).not.toContain("ur.name = 'president'");
  });

  it('does not grant portfolio administration to full-access managers', () => {
    expect(migration).toContain('public.is_company_admin()');
    expect(migration).toContain('p_id = public.current_portfolio_id()');
    expect(migration).not.toContain('public.is_full_access_staff()');
  });
});
