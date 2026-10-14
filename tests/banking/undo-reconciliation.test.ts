import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();
const redirects: string[] = [];
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { redirects.push(url); throw new Error(`REDIRECT ${url}`); },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/auth/me', () => ({ requireFinanceStaff: async () => ({ auth_user_id: 'u1' }) }));
// Rows the fake client returns per table, and the deletes it was asked for.
let recRow: any = null;
const deletes: string[] = [];
const updates: Array<{ table: string; values: any }> = [];
function from(table: string) {
  const b: any = {
    select: () => b,
    eq: () => b,
    maybeSingle: async () => ({ data: recRow, error: null }),
    delete: () => { deletes.push(table); return b; },
    update: (values: any) => { updates.push({ table, values }); return b; },
    then: (resolve: any) => resolve({ data: [{ id: 'x' }], error: null }),
  };
  return b;
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc, from }) }));

import { discardBankReconciliation, undoBankReconciliation, updateStatementBalance } from '@/app/(app)/bank-accounts/reconcile/actions';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const REC = '22222222-2222-4222-8222-222222222222';

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

async function run(fields: Record<string, string>) {
  await expect(undoBankReconciliation(form(fields))).rejects.toThrow(/REDIRECT/);
  return redirects.at(-1)!;
}

beforeEach(() => {
  rpc.mockReset();
  recRow = null;
  deletes.length = 0;
  updates.length = 0;
  redirects.length = 0;
});

describe('undo a bank reconciliation', () => {
  it('asks the database to undo it, with the reason', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const to = await run({ bank_account_id: ACCOUNT, reconciliation_id: REC, reason: 'Statement balance was keyed wrong' });
    expect(rpc).toHaveBeenCalledWith('undo_bank_reconciliation', { p_reconciliation_id: REC, p_reason: 'Statement balance was keyed wrong' });
    expect(to).toBe(`/bank-accounts/reconcile?account_id=${ACCOUNT}&done=undone`);
  });

  it('needs a reason of at least 10 characters', async () => {
    const to = await run({ bank_account_id: ACCOUNT, reconciliation_id: REC, reason: 'oops' });
    expect(rpc).not.toHaveBeenCalled();
    expect(to).toContain('error=');
  });

  it('shows the database\'s refusal (e.g. a closed month) on the page', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'A month this reconciliation covers is closed. Reopen the month before undoing it.' } });
    const to = await run({ bank_account_id: ACCOUNT, reconciliation_id: REC, reason: 'Statement balance was keyed wrong' });
    expect(decodeURIComponent(to)).toContain('A month this reconciliation covers is closed');
  });

  it('refuses a malformed id without calling the database', async () => {
    const to = await run({ bank_account_id: 'x', reconciliation_id: 'nope', reason: 'Statement balance was keyed wrong' });
    expect(rpc).not.toHaveBeenCalled();
    expect(to.startsWith('/bank-accounts/reconcile?error=')).toBe(true);
  });
});

describe('discard a reconciliation in progress', () => {
  it('removes its items, then the reconciliation', async () => {
    recRow = { id: REC, status: 'in_progress' };
    await expect(discardBankReconciliation(form({ bank_account_id: ACCOUNT, reconciliation_id: REC }))).rejects.toThrow(/REDIRECT/);
    expect(deletes).toEqual(['bank_reconciliation_items', 'bank_reconciliations']);
    expect(redirects.at(-1)).toBe(`/bank-accounts/reconcile?account_id=${ACCOUNT}&done=discarded`);
  });

  it('leaves a completed one alone (undo it instead)', async () => {
    recRow = { id: REC, status: 'completed' };
    await expect(discardBankReconciliation(form({ bank_account_id: ACCOUNT, reconciliation_id: REC }))).rejects.toThrow(/REDIRECT/);
    expect(deletes).toEqual([]);
    expect(redirects.at(-1)).toContain('error=');
  });
});

describe('correct the statement balance of a reconciliation in progress', () => {
  it('saves a corrected balance (e.g. after reopening one keyed wrong)', async () => {
    await expect(updateStatementBalance(form({ bank_account_id: ACCOUNT, reconciliation_id: REC, statement_balance: '$12,450.10' }))).rejects.toThrow(/REDIRECT/);
    expect(updates).toEqual([{ table: 'bank_reconciliations', values: { statement_balance: 12450.1 } }]);
    expect(redirects.at(-1)).toBe(`/bank-accounts/reconcile?account_id=${ACCOUNT}&done=balance`);
  });

  it('refuses something that is not an amount', async () => {
    await expect(updateStatementBalance(form({ bank_account_id: ACCOUNT, reconciliation_id: REC, statement_balance: '12.345' }))).rejects.toThrow(/REDIRECT/);
    expect(updates).toEqual([]);
    expect(redirects.at(-1)).toContain('error=');
  });
});
