import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { bookBalance, itemFromLine, reconcilableLines } from '@/lib/banking/reconciliation';

export async function POST(request: NextRequest) {
  // Staff-only: server actions/route handlers are callable endpoints, so the
  // guard lives in the handler itself (middleware alone is not sufficient).
  try {
    await (await import('@/lib/auth/me')).requireFinanceStaff();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const db = supabase as any;

  const formData = await request.formData();
  const reconciliationId = formData.get('reconciliation_id') as string;
  const bankAccountId = formData.get('bank_account_id') as string;
  const back = (message: string, accountId = bankAccountId) => NextResponse.redirect(new URL(
    `/bank-accounts/reconcile?${accountId ? `account_id=${encodeURIComponent(accountId)}&` : ''}error=${encodeURIComponent(message)}`,
    request.url,
  ), 303);

  if (!reconciliationId) {
    return back('Missing reconciliation_id');
  }

  // RLS limits this read to reconciliations the caller can manage.
  const { data: recon } = await db
    .from('bank_reconciliations')
    .select('id, portfolio_id, bank_account_id, status, statement_date, statement_balance, ending_book_balance, bank_accounts(id, gl_account_id, association_id)')
    .eq('id', reconciliationId)
    .maybeSingle();

  if (!recon) {
    return back('Reconciliation not found');
  }
  if (recon.status !== 'in_progress') {
    return back('This reconciliation is already completed.', recon.bank_account_id);
  }

  // Every item (paged past 1,000 rows).
  const { rows: items, error: itemsError } = await fetchAllRows<any>(() => db
    .from('bank_reconciliation_items')
    .select('id, amount, is_cleared, journal_line_id, type')
    .eq('reconciliation_id', reconciliationId)
    .order('id'));
  if (itemsError) return back(`Could not load the reconciliation items: ${itemsError}`, recon.bank_account_id);

  // Entries posted (or reversed) on or before the statement date since the
  // reconciliation started change the book balance. Bring them in as
  // uncleared items and refresh the book balance, then let the user review.
  const bank = recon.bank_accounts;
  if (bank?.gl_account_id) {
    const { balance, error: balError } = await bookBalance(db, bank, recon.statement_date);
    if (balError) return back(`Could not compute the book balance: ${balError}`, recon.bank_account_id);
    if (Math.abs(balance - Number(recon.ending_book_balance ?? 0)) >= 0.005) {
      const { lines, error: linesError, truncated } = await reconcilableLines(
        db, bank, recon.statement_date, new Set(items.map((i: any) => i.journal_line_id).filter(Boolean)),
      );
      if (linesError) return back(linesError, recon.bank_account_id);
      if (truncated) return back('This account has too many unreconciled lines to load at once.', recon.bank_account_id);
      const added = lines.map((line: any, index: number) => itemFromLine(reconciliationId, line, items.length + index));
      for (let i = 0; i < added.length; i += 500) {
        const { error: addError } = await db.from('bank_reconciliation_items').insert(added.slice(i, i + 500));
        if (addError) return back(`Could not add new ledger lines: ${addError.message}`, recon.bank_account_id);
      }
      const { error: updError } = await db.from('bank_reconciliations')
        .update({ ending_book_balance: balance, difference: balance - Number(recon.statement_balance ?? 0), updated_at: new Date().toISOString() })
        .eq('id', reconciliationId).eq('status', 'in_progress');
      if (updError) return back(`Could not refresh the book balance: ${updError.message}`, recon.bank_account_id);
      return back(`The books changed since this reconciliation started (${added.length} new ledger line${added.length === 1 ? '' : 's'} on or before the statement date). Review them, then complete again.`, recon.bank_account_id);
    }
  }

  // Adjusted book balance = book balance at the statement date less items
  // that have not cleared. It must match the statement before completing:
  // completion stamps the account as reconciled, which lets periods close.
  // Book items not yet through the bank come off; bank-only adjustments that
  // are on the statement (cleared) are added, since the books don't have them.
  const outstanding = items
    .filter((i: any) => !i.is_cleared && i.type !== 'bank_only')
    .reduce((sum: number, i: any) => sum + Number(i.amount ?? 0), 0);
  const bankOnly = items
    .filter((i: any) => i.is_cleared && i.type === 'bank_only')
    .reduce((sum: number, i: any) => sum + Number(i.amount ?? 0), 0);
  const adjusted = Number(recon.ending_book_balance ?? 0) - outstanding + bankOnly;
  const difference = Math.round((Number(recon.statement_balance ?? 0) - adjusted) * 100) / 100;
  if (Math.abs(difference) >= 0.01) {
    return back(`The reconciliation is out of balance by $${Math.abs(difference).toFixed(2)}. Clear the matching items (or correct the statement balance) before completing it.`, recon.bank_account_id);
  }

  const { data: me } = await supabase.auth.getUser();
  const { data: completed, error } = await db
    .from('bank_reconciliations')
    .update({
      status: 'completed',
      reconciled_balance: Math.round(adjusted * 100) / 100,
      difference: 0,
      completed_at: new Date().toISOString(),
      completed_by: me.user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId)
    .eq('status', 'in_progress')
    .select('id')
    .maybeSingle();

  if (error || !completed) {
    console.error('Failed to complete reconciliation:', error);
    return back(error?.message ?? 'Failed to complete reconciliation', recon.bank_account_id);
  }

  // Redirect back to the reconcile page
  // Fall back to the reconciliation's own account so the user lands on it.
  const accountForRedirect = bankAccountId || recon.bank_account_id;
  const redirectUrl = accountForRedirect
    ? `/bank-accounts/reconcile?account_id=${encodeURIComponent(accountForRedirect)}&tab=reconciled`
    : '/bank-accounts/reconcile';

  return NextResponse.redirect(new URL(redirectUrl, request.url), 303);
}
