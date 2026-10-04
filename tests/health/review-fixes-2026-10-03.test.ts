import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Guards for the fixes found in the 2026-10-03 review of PRs #158–#171. The
// behaviour itself was verified against production in rolled-back
// transactions; these keep the migration from being edited away.
const sql = readFileSync('supabase/migrations/20261003230000_review_fixes_sale_fees_feed_1099.sql', 'utf8');

describe('2026-10-03 review fixes', () => {
  it('stops late fees on a previous owner\'s charges after a sale', () => {
    expect(sql).toContain('app_ownership_bounds(v_charge.unit_id, v_charge.due_date)).period_to <= current_date');
  });

  it('refuses an NSF fee for a previous owner\'s payment instead of billing the buyer', () => {
    const fn = sql.split('create or replace function public.post_nsf_fee(')[1] ?? '';
    expect(fn).toContain('made by a previous owner of the unit');
    expect(fn.indexOf('previous owner')).toBeLessThan(fn.indexOf('insert into public.charges'));
  });

  it('matches a receipt to the bank feed only once (deposit or own line)', () => {
    expect(sql).toContain('create trigger trg_feed_line_not_deposited');
    expect(sql).toContain("guard_deposit_receipt_not_feed_matched('payment')");
    expect(sql).toContain("guard_deposit_receipt_not_feed_matched('other_receipt')");
  });

  it('keeps company-wide user and diagnostics reports from scoped managers', () => {
    expect(sql).toContain("''users_and_permissions'', ''data_diagnostics_summary''");
  });

  it('stores payment dates at noon UTC so 1099 years do not shift', () => {
    expect(sql).toContain("paid_at = (p_payment_date::timestamp + interval ''12 hours'') at time zone ''UTC''");
    for (const fn of ['record_bill_payment', 'record_check_run_legacy', 'pay_owner_payable']) expect(sql).toContain(`'${fn}'`);
  });

  it('checks scope on the existing recurring journal template when editing or archiving', () => {
    expect(sql).toContain('public.app_recurring_je_in_scope(template_lines)');
  });
});
