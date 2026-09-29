import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RECEIPT_METHODS, isReceiptMethod, receiptMethodLabel } from '@/lib/payments/methods';

const sql = readFileSync('supabase/migrations/20260930020000_post_receivables_to_gl.sql', 'utf8');
const fn = (name: string) => sql.split(`create or replace function public.${name}(`)[1]?.split('end $$;')[0] ?? '';

describe('receipt methods', () => {
  it('match the payments_method_check constraint exactly', () => {
    const allowed = sql.match(/payments_method_check check \(method = any \(array\[([\s\S]*?)\]\)\)/)?.[1] ?? '';
    const dbValues = [...allowed.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(RECEIPT_METHODS.map((m) => m.value).sort()).toEqual(dbValues);
  });

  it('include office methods and label them', () => {
    expect(isReceiptMethod('cash')).toBe(true);
    expect(isReceiptMethod('bitcoin')).toBe(false);
    expect(receiptMethodLabel('money_order')).toBe('Money order');
  });
});

describe('receivables → GL posting', () => {
  it('posts charges Dr A/R Cr income and payments Dr cash Cr A/R', () => {
    expect(fn('post_charge_to_gl')).toMatch(/'charge', new\.id, v_memo, g\.ar, g\.income, new\.amount/);
    expect(fn('post_payment_to_gl')).toMatch(/'payment', new\.id, v_memo, g\.cash, g\.ar, new\.amount/);
  });

  it('reverses what was posted before re-posting an edit or on delete — never rewrites history', () => {
    for (const name of ['post_charge_to_gl', 'post_payment_to_gl']) {
      const body = fn(name);
      expect(body).toContain('reverse_subledger_source');
      expect(body).not.toMatch(/delete from public\.journal/);
      expect(body).not.toMatch(/update public\.journal_lines/);
    }
  });

  it('skips re-posting when only non-financial fields change', () => {
    expect(fn('post_charge_to_gl')).toContain('new.amount is not distinct from old.amount');
  });

  it('refuses a bank account from another association', () => {
    expect(fn('payment_gl_accounts')).toContain('That bank account belongs to a different association');
  });

  it('never picks an allowance account as receivables', () => {
    expect(sql).toMatch(/array\['accounts_receivable'\], null, '%allowance%'/);
  });

  it('keeps the posting internals away from signed-in users', () => {
    expect(sql).toContain("execute format('revoke all on function %s from public, anon, authenticated', f)");
  });

  it('adds nightly checks that the ledger matches owner balances', () => {
    const diag = readFileSync('supabase/migrations/20260930021000_receivables_gl_diagnostics.sql', 'utf8');
    expect(diag).toContain("'receivable_not_posted'");
    expect(diag).toContain("'receivables_gl_mismatch'");
  });
});

describe('text encoding', () => {
  it('has no mojibake in user-facing pages that were fixed', () => {
    for (const p of ['app/(app)/units/[id]/page.tsx', 'app/(app)/associations/[id]/amenities/page.tsx']) {
      expect(readFileSync(p, 'utf8')).not.toMatch(/Ã¢|â€/);
    }
  });
});
