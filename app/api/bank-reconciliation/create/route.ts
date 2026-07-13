import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

  if (!bankAccountId || !statementDate || isNaN(statementBalance)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get bank account info
  const { data: bankAccount } = await db
    .from('bank_accounts')
    .select('id, portfolio_id, gl_account_id, name')
    .eq('id', bankAccountId)
    .single();

  if (!bankAccount) {
    return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
  }

  if (!bankAccount.gl_account_id) {
    return NextResponse.json({ error: 'Bank account has no linked GL account. Link a GL account first.' }, { status: 400 });
  }

  // Calculate ending book balance from journal_lines for this GL account
  const { data: journalLines } = await db
    .from('journal_lines')
    .select('id, debit_amount, credit_amount, memo, journal_entries!inner(entry_date, reference_number, description, posted)')
    .eq('gl_account_id', bankAccount.gl_account_id)
    .eq('journal_entries.posted', true)
    .order('id');

  const lines = (journalLines ?? []) as any[];
  const totalBookBalance = lines.reduce(
    (sum: number, line: any) => sum + ((line.debit_amount ?? 0) - (line.credit_amount ?? 0)),
    0
  );

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
    return NextResponse.json({ error: 'Failed to create reconciliation' }, { status: 500 });
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

    const { error: itemsError } = await db
      .from('bank_reconciliation_items')
      .insert(items);

    if (itemsError) {
      console.error('Failed to insert reconciliation items:', itemsError);
      // Don't fail — the reconciliation was created, just missing items
    }
  }

  // Redirect to the reconcile page
  const redirectUrl = `/bank-accounts/reconcile?account_id=${encodeURIComponent(bankAccountId)}&tab=unreconciled`;
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
