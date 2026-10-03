import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
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
  const bankAccountId = formData.get('bank_account_id') as string;
  const statementDate = formData.get('statement_date') as string;
  const statementBalance = parseFloat(formData.get('statement_balance') as string);
  const notes = formData.get('notes') as string;
  // Errors go back to the page as an Alert instead of a raw JSON screen.
  const back = (message: string) => NextResponse.redirect(new URL(
    `/bank-accounts/reconcile?${bankAccountId ? `account_id=${encodeURIComponent(bankAccountId)}&` : ''}error=${encodeURIComponent(message)}`,
    request.url,
  ), 303);

  if (!bankAccountId || !statementDate || isNaN(statementBalance)) {
    return back('Missing required fields');
  }

  // Get bank account info
  const { data: bankAccount } = await db
    .from('bank_accounts')
    .select('id, portfolio_id, gl_account_id, name, association_id')
    .eq('id', bankAccountId)
    .single();

  if (!bankAccount) {
    return back('Bank account not found');
  }

  if (!bankAccount.gl_account_id) {
    return back('Bank account has no linked GL account. Link a GL account first.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(statementDate)) return back('Enter a valid statement date');

  // One reconciliation at a time, statements in order, none from the future:
  // completing an older statement after a newer one would rewind the
  // account's reconciled date, and a future date would let periods close
  // that the bank has not confirmed yet.
  const { todayInZone } = await import('@/lib/time/zoned');
  if (statementDate > todayInZone()) return back('The statement date is in the future');
  const [{ data: open }, { data: lastDone }] = await Promise.all([
    db.from('bank_reconciliations').select('id').eq('bank_account_id', bankAccountId).eq('status', 'in_progress').limit(1).maybeSingle(),
    db.from('bank_reconciliations').select('statement_date').eq('bank_account_id', bankAccountId).eq('status', 'completed')
      .order('statement_date', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (open) return back('A reconciliation of this account is already in progress. Finish it before starting another.');
  if (lastDone && statementDate <= lastDone.statement_date) {
    return back(`This account is reconciled through ${lastDone.statement_date}. Choose a later statement date.`);
  }

  const { balance: totalBookBalance, error: balError } = await bookBalance(db, bankAccount, statementDate);
  if (balError) return back(`Could not compute the book balance: ${balError}`);
  const { lines, error: linesError, truncated } = await reconcilableLines(db, bankAccount, statementDate);
  if (linesError) return back(linesError);
  if (truncated) return back('This account has too many unreconciled lines to load at once. Reconcile an earlier statement first.');

  // Create the reconciliation
  const { data: reconciliation, error: reconError } = await db
    .from('bank_reconciliations')
    .insert({
      portfolio_id: bankAccount.portfolio_id,
      bank_account_id: bankAccountId,
      statement_date: statementDate,
      statement_balance: statementBalance,
      ending_book_balance: totalBookBalance,
      difference: totalBookBalance - statementBalance,
      status: 'in_progress',
      notes: notes || null,
    })
    .select('id')
    .single();

  if (reconError || !reconciliation) {
    console.error('Failed to create reconciliation:', reconError);
    return back('Failed to create reconciliation');
  }

  // Populate reconciliation items from journal_lines
  if (lines.length > 0) {
    const items = lines.map((line: any, index: number) => itemFromLine(reconciliation.id, line, index));

    // Insert in chunks; a reconciliation with missing lines is worse than
    // none, so roll it back on failure.
    for (let i = 0; i < items.length; i += 500) {
      const { error: itemsError } = await db
        .from('bank_reconciliation_items')
        .insert(items.slice(i, i + 500));
      if (itemsError) {
        console.error('Failed to insert reconciliation items:', itemsError);
        await db.from('bank_reconciliation_items').delete().eq('reconciliation_id', reconciliation.id);
        await db.from('bank_reconciliations').delete().eq('id', reconciliation.id);
        return back(`Could not add the ledger lines to the reconciliation: ${itemsError.message}`);
      }
    }
  }

  // Redirect to the reconcile page
  const redirectUrl = `/bank-accounts/reconcile?account_id=${encodeURIComponent(bankAccountId)}&tab=unreconciled`;
  return NextResponse.redirect(new URL(redirectUrl, request.url), 303);
}
