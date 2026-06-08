import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const db = supabase as any;

  const formData = await request.formData();
  const reconciliationId = formData.get('reconciliation_id') as string;
  const bankAccountId = formData.get('bank_account_id') as string;

  if (!reconciliationId) {
    return NextResponse.json({ error: 'Missing reconciliation_id' }, { status: 400 });
  }

  // Verify the user can manage finance for this reconciliation
  const { data: recon } = await db
    .from('bank_reconciliations')
    .select('id, portfolio_id, bank_account_id')
    .eq('id', reconciliationId)
    .single();

  if (!recon) {
    return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
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
    return NextResponse.json({ error: 'Failed to complete reconciliation' }, { status: 500 });
  }

  // Redirect back to the reconcile page
  const redirectUrl = bankAccountId
    ? `/bank-accounts/reconcile?account_id=${encodeURIComponent(bankAccountId)}&tab=reconciled`
    : '/bank-accounts/reconcile';

  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
