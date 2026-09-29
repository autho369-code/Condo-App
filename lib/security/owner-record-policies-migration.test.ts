import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929130000_tenant_scope_owner_record_policies.sql'),
  'utf8',
);

describe('owner record tenant-scope migration', () => {
  it('drops every unscoped "any staff" policy', () => {
    for (const policy of ['Staff manage agreements', 'Staff manage ACH status', 'Staff manage form submissions', 'Staff manage packets', 'Staff manage portal invites']) {
      expect(migration).toContain(`drop policy if exists "${policy}"`);
    }
  });

  it('scopes every replacement policy to the caller portfolio', () => {
    const creates = migration.split('create policy').slice(1);
    expect(creates).toHaveLength(5);
    for (const body of creates) {
      expect(body).toContain('public.can_access_portfolio(');
      expect(body).toContain('with check');
      expect(body).not.toMatch(/is_staff\(\)\s+or\s+/i);
    }
  });
});
