import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260729010000_harden_check_runs.sql', 'utf8');
const printPage = readFileSync('app/(app)/bills/check-run/print/[id]/page.tsx', 'utf8');
const action = readFileSync('lib/rpcs/bills.ts', 'utf8');
const ledgerMigration = readFileSync('supabase/migrations/20260729020000_post_payable_bill_ledger.sql', 'utf8');
const historyMigration = readFileSync('supabase/migrations/20260729030000_immutable_payable_checks.sql', 'utf8');
const voidBoundaryMigration = readFileSync('supabase/migrations/20260729031000_secure_payable_check_void.sql', 'utf8');

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

  it('scopes printable and historical copies to immutable check-run history', () => {
    expect(action).toContain(".from('payable_checks')");
    expect(action).toContain('redirect(`/bills/check-run/print/${firstCheck.id}`)');
    expect(printPage).toContain(".select('run_transaction_id')");
    expect(printPage).toContain(".eq('run_transaction_id', seed?.run_transaction_id");
    expect(printPage).toContain("c.status === 'stop_payment' ? 'STOP PAYMENT' : 'VOID'");
    expect(printPage).toContain('.limit(100)');
  });

  it('posts idempotent balanced accrual, payment, and void journal entries', () => {
    expect(ledgerMigration).toContain("source_type in ('payable_bill', 'check_payment', 'payable_bill_void')");
    expect(ledgerMigration).toContain("'payable_bill', p_bill_id");
    expect(ledgerMigration).toContain("'check_payment', bill_id");
    expect(ledgerMigration).toContain("'payable_bill_void', p_bill_id");
    expect(ledgerMigration).toContain("(payment_entry_id, bill_row.association_id, ap_account_id, bill_row.amount, 0");
    expect(ledgerMigration).toContain("(payment_entry_id, bill_row.association_id, bank_row.gl_account_id, 0, bill_row.amount");
    expect(action).toContain("rpc('approve_payable_bill'");
    expect(action).toContain("rpc('void_payable_bill'");
  });

  it('preserves issued numbers and reverses paid checks before reissue', () => {
    expect(historyMigration).toContain('create table if not exists public.payable_checks');
    expect(historyMigration).toContain('unique (bank_account_id, check_number)');
    expect(historyMigration).toContain('run_transaction_id bigint not null default txid_current()');
    expect(historyMigration).toContain("source_type = 'check_payment' and source_id = new.id");
    expect(historyMigration).toContain("'check_payment_void', check_row.id");
    expect(historyMigration).toContain("status = 'approved'::public.payable_bill_status");
    expect(action).toContain("rpc('void_payable_check'");
    expect(voidBoundaryMigration).toContain('security definer');
    expect(voidBoundaryMigration).toContain('grant execute on function public.void_payable_check');
  });
});
