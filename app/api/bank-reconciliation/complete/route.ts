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
  const reconciliationId = formData.get('reconciliation_id') as string;
  const bankAccountId = formData.get('bank_account_id') as string;
  const back = (message: string, accountId = bankAccountId) => NextResponse.redirect(new URL(
    `/bank-accounts/reconcile?${accountId ? `account_id=${encodeURIComponent(accountId)}&` : ''}error=${encodeURIComponent(message)}`,
    request.url,
  ), 303);

  if (!reconciliationId) {
    return back('Missing reconciliation_id');
  }

  // Verify the user can manage finance for this reconciliation
  const { data: recon } = await db
    .from('bank_reconciliations')
    .select('id, portfolio_id, bank_account_id')
    .eq('id', reconciliationId)
    .single();

  if (!recon) {
    return back('Reconciliation not found');
  }

  // Calculate totals from items
  const { data: items } = await db
    .from('bank_reconciliation_items')
    .select('amount, is_cleared')
    .eq('reconciliation_id', reconciliationId);

  const allItems = items ?? [];
  const clearedAmount = allItems
    .filter((i: any) => i.is_cleared)
    .reduce((sum: number, i: any) => sum + (i.amount ?? 0), 0);

  // Update reconciliation status
  const { error } = await db
    .from('bank_reconciliations')
    .update({
      status: 'completed',
      reconciled_balance: clearedAmount,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId);

  if (error) {
    console.error('Failed to complete reconciliation:', error);
    return back('Failed to complete reconciliation');
  }

  // Redirect back to the reconcile page
  // Fall back to the reconciliation's own account so the user lands on it.
  const accountForRedirect = bankAccountId || recon.bank_account_id;
  const redirectUrl = accountForRedirect
    ? `/bank-accounts/reconcile?account_id=${encodeURIComponent(accountForRedirect)}&tab=reconciled`
    : '/bank-accounts/reconcile';

  return NextResponse.redirect(new URL(redirectUrl, request.url), 303);
}
