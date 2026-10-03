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
    // Lines the bank feed already matched to a transaction the bank posted by
    // the statement date start cleared.
    const lineIds = lines.map((l: any) => l.id);
    const clearedByFeed = new Set<string>();
    for (let i = 0; i < lineIds.length; i += 200) {
      const { data: matched } = await db.from('bank_transactions')
        .select('matched_journal_line_id')
        .in('matched_journal_line_id', lineIds.slice(i, i + 200))
        .lte('date', statementDate);
      for (const m of matched ?? []) clearedByFeed.add(m.matched_journal_line_id);
    }
    // Receipts in a bank deposit the feed matched start cleared as well.
    const { data: matchedDeps } = await db.from('bank_transactions')
      .select('matched_bank_deposit_id')
      .eq('bank_account_id', bankAccountId)
      .not('matched_bank_deposit_id', 'is', null)
      .lte('date', statementDate);
    const depIds = (matchedDeps ?? []).map((m: any) => m.matched_bank_deposit_id);
    if (depIds.length) {
      const [{ data: depPays }, { data: depOthers }] = await Promise.all([
        db.from('payments').select('id').in('bank_deposit_id', depIds),
        db.from('other_receipts').select('journal_entry_id').in('bank_deposit_id', depIds),
      ]);
      const payIds = new Set((depPays ?? []).map((p: any) => p.id));
      const entryIds = new Set((depOthers ?? []).map((r: any) => r.journal_entry_id));
      for (const line of lines) {
        const e = line.journal_entries;
        if ((e?.source_type === 'payment' && payIds.has(e.source_id)) || entryIds.has(e?.id)) clearedByFeed.add(line.id);
      }
    }
    const items = lines.map((line: any, index: number) => {
      const item = itemFromLine(reconciliation.id, line, index);
      return clearedByFeed.has(line.id) ? { ...item, is_cleared: true, cleared_at: new Date().toISOString() } : item;
    });

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

  // Bank adjustments (bank-only items, no ledger effect) through the statement
  // date that no completed reconciliation has cleared yet.
  const [{ data: adjustments }, { data: clearedAdj }] = await Promise.all([
    db.from('bank_adjustments').select('id, amount, adjustment_date, description')
      .eq('bank_account_id', bankAccountId).lte('adjustment_date', statementDate),
    db.from('bank_reconciliation_items')
      .select('bank_adjustment_id, bank_reconciliations!inner(bank_account_id, status)')
      .eq('bank_reconciliations.bank_account_id', bankAccountId)
      .eq('bank_reconciliations.status', 'completed')
      .eq('is_cleared', true)
      .not('bank_adjustment_id', 'is', null),
  ]);
  const doneAdj = new Set((clearedAdj ?? []).map((r: any) => r.bank_adjustment_id));
  const adjItems = (adjustments ?? []).filter((a: any) => !doneAdj.has(a.id)).map((a: any, i: number) => ({
    reconciliation_id: reconciliation.id,
    bank_adjustment_id: a.id,
    journal_line_id: null,
    amount: Number(a.amount),
    description: `Bank adjustment ${a.adjustment_date}: ${a.description}`,
    type: 'bank_only',
    is_cleared: false,
    sort_order: lines.length + i,
  }));
  if (adjItems.length) {
    const { error: adjError } = await db.from('bank_reconciliation_items').insert(adjItems);
    if (adjError) return back(`The reconciliation started, but its bank adjustments could not be added: ${adjError.message}`);
  }

  // Redirect to the reconcile page
  const redirectUrl = `/bank-accounts/reconcile?account_id=${encodeURIComponent(bankAccountId)}&tab=unreconciled`;
  return NextResponse.redirect(new URL(redirectUrl, request.url), 303);
}
