import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
  // Several ids when a bank deposit groups receipts: they clear together.
  const itemIds = [...new Set(formData.getAll('item_id').map(String).filter(Boolean))];
  const reconciliationId = formData.get('reconciliation_id') as string;
  const accountId = formData.get('account_id') as string;
  const tab = formData.get('tab') as string;
  const back = (message: string) => NextResponse.redirect(new URL(
    `/bank-accounts/reconcile?${accountId ? `account_id=${encodeURIComponent(accountId)}&` : ''}error=${encodeURIComponent(message)}`,
    request.url,
  ), 303);

  if (!itemIds.length || itemIds.length > 300 || !reconciliationId) {
    return back('Missing required fields');
  }

  // The items must belong to this reconciliation, and a completed
  // reconciliation is closed: un-clearing an item would silently rewrite it.
  const { data: rows } = await db
    .from('bank_reconciliation_items')
    .select('id, is_cleared, reconciliation_id, bank_reconciliations!inner(status)')
    .in('id', itemIds)
    .eq('reconciliation_id', reconciliationId);
  if (!rows || rows.length !== itemIds.length) {
    return back('Item not found on this reconciliation');
  }
  if (rows.some((r: any) => r.bank_reconciliations?.status !== 'in_progress')) {
    return back('This reconciliation is completed; its cleared items can no longer change.');
  }

  // Toggle: clear all unless all are already cleared.
  const clear = !rows.every((r: any) => r.is_cleared);
  const { error } = await db
    .from('bank_reconciliation_items')
    .update({ is_cleared: clear, cleared_at: clear ? new Date().toISOString() : null })
    .in('id', itemIds)
    .eq('reconciliation_id', reconciliationId);
  if (error) {
    console.error('Failed to toggle cleared:', error);
    return back('Failed to update item');
  }

  // Redirect back
  const params = new URLSearchParams();
  if (accountId) params.set('account_id', accountId);
  if (tab) params.set('tab', tab);
  const queryString = params.toString();

  return NextResponse.redirect(
    new URL(`/bank-accounts/reconcile${queryString ? `?${queryString}` : ''}`, request.url),
    303,
  );
}
