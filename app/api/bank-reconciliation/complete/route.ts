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
    .select('id, portfolio_id, bank_account_id, status, statement_balance, ending_book_balance')
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
    .select('id, amount, is_cleared')
    .eq('reconciliation_id', reconciliationId)
    .order('id'));
  if (itemsError) return back(`Could not load the reconciliation items: ${itemsError}`, recon.bank_account_id);

  // Adjusted book balance = book balance at the statement date less items
  // that have not cleared. It must match the statement before completing:
  // completion stamps the account as reconciled, which lets periods close.
  const outstanding = items
    .filter((i: any) => !i.is_cleared)
    .reduce((sum: number, i: any) => sum + Number(i.amount ?? 0), 0);
  const adjusted = Number(recon.ending_book_balance ?? 0) - outstanding;
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
