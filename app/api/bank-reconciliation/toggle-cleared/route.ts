import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const db = supabase as any;

  const formData = await request.formData();
  const itemId = formData.get('item_id') as string;
  const reconciliationId = formData.get('reconciliation_id') as string;
  const accountId = formData.get('account_id') as string;
  const tab = formData.get('tab') as string;

  if (!itemId || !reconciliationId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get current state
  const { data: item } = await db
    .from('bank_reconciliation_items')
    .select('id, is_cleared')
    .eq('id', itemId)
    .single();

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  // Toggle cleared state
  const { error } = await db
    .from('bank_reconciliation_items')
    .update({
      is_cleared: !item.is_cleared,
      cleared_at: !item.is_cleared ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) {
    console.error('Failed to toggle cleared:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }

  // Redirect back
  const params = new URLSearchParams();
  if (accountId) params.set('account_id', accountId);
  if (tab) params.set('tab', tab);
  const queryString = params.toString();

  return NextResponse.redirect(
    new URL(`/bank-accounts/reconcile${queryString ? `?${queryString}` : ''}`, request.url)
  );
}
