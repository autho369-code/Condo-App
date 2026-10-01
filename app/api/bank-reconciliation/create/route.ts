import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export async function POST(request: NextRequest) {
  // Staff-only: server actions/route handlers are callable endpoints, so the
  // guard lives in the handler itself (middleware alone is not sufficient).
  try {
    await (await import('@/lib/auth/me')).requireStaff();
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
    .select('id, portfolio_id, gl_account_id, name')
    .eq('id', bankAccountId)
    .single();

  if (!bankAccount) {
    return back('Bank account not found');
  }

  if (!bankAccount.gl_account_id) {
    return back('Bank account has no linked GL account. Link a GL account first.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(statementDate)) return back('Enter a valid statement date');

  // Book balance as of the statement date, summed in the database (a list of
  // lines stopped at 1,000 rows, and entries after the statement date were
  // counted too).
  const { data: balRows, error: balError } = await db.rpc('journal_line_totals', {
    p_gl_account_ids: [bankAccount.gl_account_id],
    p_to: statementDate,
  });
  if (balError) return back(`Could not compute the book balance: ${balError.message}`);
  const totalBookBalance = ((balRows ?? []) as any[]).reduce(
    (sum: number, r: any) => sum + Number(r.debit_total ?? 0) - Number(r.credit_total ?? 0),
    0,
  );

  // Lines to reconcile: every posted line through the statement date that was
  // not already cleared on a completed reconciliation of this account.
  const { rows: lineRows, truncated, error: linesError } = await fetchAllRows<any>(() => db
    .from('journal_lines')
    .select('id, debit_amount, credit_amount, memo, journal_entries!inner(entry_date, reference_number, description, posted)')
    .eq('gl_account_id', bankAccount.gl_account_id)
    .eq('journal_entries.posted', true)
    .lte('journal_entries.entry_date', statementDate)
    .order('id'));
  if (linesError) return back(`Could not load ledger lines: ${linesError}`);
  if (truncated) return back('This account has too many unreconciled lines to load at once. Reconcile an earlier statement first.');
  const { rows: clearedRows, error: clearedError } = await fetchAllRows<any>(() => db
    .from('bank_reconciliation_items')
    .select('journal_line_id, bank_reconciliations!inner(bank_account_id, status)')
    .eq('bank_reconciliations.bank_account_id', bankAccountId)
    .eq('bank_reconciliations.status', 'completed')
    .eq('is_cleared', true)
    .not('journal_line_id', 'is', null)
    .order('journal_line_id'));
  if (clearedError) return back(`Could not load earlier reconciliations: ${clearedError}`);
  const alreadyCleared = new Set(clearedRows.map((r: any) => r.journal_line_id));
  const lines = lineRows.filter((line: any) => !alreadyCleared.has(line.id));

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
    const items = lines.map((line: any, index: number) => ({
      reconciliation_id: reconciliation.id,
      journal_line_id: line.id,
      amount: (line.debit_amount ?? 0) - (line.credit_amount ?? 0),
      type: 'book',
      is_cleared: false,
      sort_order: index,
    }));

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
