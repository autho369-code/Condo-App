import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260729010000_harden_check_runs.sql', 'utf8');
const printPage = readFileSync('app/(app)/bills/check-run/print/[id]/page.tsx', 'utf8');
const action = readFileSync('lib/rpcs/bills.ts', 'utf8');

describe('check-run accounting boundary', () => {
  it('validates tenant, association, state, amount, and check-number ownership before updates', () => {
    expect(migration).toContain('bill_row.portfolio_id is distinct from bank_row.portfolio_id');
    expect(migration).toContain('bill_row.association_id is distinct from bank_row.association_id');
    expect(migration).toContain("bill_row.status <> 'approved'::public.payable_bill_status");
    expect(migration).toContain('bill_row.amount <= 0');
    expect(migration).toContain('check_number between p_starting_check_number');
    expect(migration.indexOf('-- Validate the entire batch')).toBeLessThan(migration.indexOf("set status = 'paid'"));
  });

  it('requires the bank sequence and removes anonymous RPC execution', () => {
    expect(migration).toContain('p_starting_check_number <> bank_row.next_check_number');
    expect(migration).toContain('revoke all on function public.record_check_run(uuid, uuid[], integer, date) from public, anon');
  });

  it('scopes print output to the returned run start and bounded count', () => {
    expect(action).toContain('&start=${starting_check_number}');
    expect(printPage).toContain(".gte('check_number', firstCheckNumber)");
    expect(printPage).toContain('.limit(requestedCount)');
    expect(printPage).toContain('Math.min(100');
  });
});
