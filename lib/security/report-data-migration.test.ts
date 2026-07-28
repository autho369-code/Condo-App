
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260728093000_restore_scoped_report_data_functions.sql',
);
const migration = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('queued report data migration', () => {
  it('restores every production queued-report helper missing from source', () => {
    for (const name of [
      'report_data_delinquency',
      'report_data_open_work_orders',
      'report_data_property_directory',
      'report_data_vendor_1099',
      'report_data_vendor_directory',
      'report_data_violation_log',
      'report_data_work_orders',
      'report_data_dispatch',
    ]) {
      expect(migration).toContain(`create or replace function public.${name}`);
    }
  });

  it('applies portfolio and requested-association scope to association reports', () => {
    expect(migration.match(/a\.portfolio_id = p_portfolio_id/g)?.length).toBeGreaterThanOrEqual(5);
    expect(migration).toContain("p_params->>'association_id'");
    expect(migration).toContain('association is not accessible for this portfolio');
  });

  it('keeps elevated report helpers service-only', () => {
    expect(migration).toContain("pg_catalog.left(p.proname, 12) = 'report_data_'");
    expect(migration).toContain(
      "'revoke all on function %s from public, anon, authenticated'",
    );
    expect(migration).toContain("'grant execute on function %s to service_role'");
    expect(migration).not.toContain('grant execute on function public.report_data_dispatch');
  });
});
