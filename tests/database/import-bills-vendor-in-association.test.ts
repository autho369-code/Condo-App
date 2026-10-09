import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The bills CSV upload matches each row's vendor inside the row's association
// (plus the management company), now that each vendor record belongs to one
// association (20261009020000).

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261009030000_import_bills_vendor_in_association.sql'),
  'utf8',
);

describe('import_bills vendor matching', () => {
  it('resolves the association before the vendor', () => {
    expect(migration.indexOf('v_assoc := public.csv_association_id(v_pid, r->>\'association\');'))
      .toBeLessThan(migration.indexOf('select v.id into v_vendor from public.vendors v'));
  });

  it('matches and counts vendors only inside the row\'s association or the management company', () => {
    const scoped = migration.match(/and \(v\.association_id = v_assoc or v\.is_management_company\)/g) ?? [];
    expect(scoped).toHaveLength(2);
  });

  it('names a vendor of another association instead of creating its bill', () => {
    expect(migration).toContain('is not a vendor of that association; add it to the association first');
    // ...but only for associations the caller can see.
    expect(migration).toContain('and public.can_view_association_row(v.association_id)');
  });

  it('keeps message text ASCII', () => {
    expect(migration.split('create or replace function')[1]).not.toMatch(/[^\x00-\x7f]/);
  });

  it('keeps the grants: signed-in users and the service role only', () => {
    expect(migration).toContain('revoke all on function public.import_bills(jsonb) from public, anon;');
    expect(migration).toContain('grant execute on function public.import_bills(jsonb) to authenticated, service_role;');
  });
});
