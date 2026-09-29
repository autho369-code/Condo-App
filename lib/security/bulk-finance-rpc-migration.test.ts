import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929110000_harden_bulk_finance_rpcs.sql'),
  'utf8',
).toLowerCase();

describe('bulk finance RPC hardening migration', () => {
  it('requires finance permission for the target portfolio in every hardened RPC', () => {
    for (const fn of ['bulk_create_charges', 'bulk_create_recurring_charges', 'generate_owner_statements']) {
      const start = migration.indexOf(`create or replace function public.${fn}(`);
      expect(start).toBeGreaterThan(-1);
      const body = migration.slice(start, migration.indexOf('\n$$;', start));
      expect(body).toContain('security definer');
      expect(body).toContain('set search_path = pg_catalog, public');
      expect(body).toContain('public.can_manage_finance(v_portfolio)');
    }
  });

  it('validates categories and GL accounts against the unit portfolio', () => {
    expect(migration).toContain('c.portfolio_id = v_portfolio');
    expect(migration).toContain('g.portfolio_id = v_portfolio');
  });

  it('keeps the unit→portfolio helper off the public API', () => {
    expect(migration).toContain('revoke all on function public.unit_portfolio_id(uuid) from public, anon, authenticated');
  });
});
