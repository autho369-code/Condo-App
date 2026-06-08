// POST /api/plaid/transactions/sync
// Syncs bank transactions from Plaid for a connected bank account

import { NextRequest, NextResponse } from 'next/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { autoMatchTransaction } from '@/lib/plaid/auto-match';

export async function POST(request: NextRequest) {
  try {
    const user = await getMe();
    if (!user || !user.auth_user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: 'Plaid is not configured.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { plaid_item_id } = body;

    const supabase = await createClient();
    const db = supabase as any;
    const client = getPlaidClient();

    // Get plaid item
    const { data: plaidItem, error: itemError } = await db
      .from('plaid_items')
      .select('*')
      .eq('id', plaid_item_id)
      .single();

    if (itemError || !plaidItem) {
      return NextResponse.json({ error: 'Plaid item not found' }, { status: 404 });
    }

    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;
    let hasMore = true;
    let cursor: string | undefined = plaidItem.cursor || undefined;

    // Sync transactions using cursor-based pagination
    while (hasMore) {
      const syncResponse = await client.transactionsSync({
        access_token: plaidItem.plaid_access_token,
        cursor: cursor as string,
        count: 500,
      });

      const { added, modified, removed, has_more, next_cursor } = syncResponse.data;

      // Process added transactions
      for (const tx of added) {
        // Auto-match to GL account
        const match = await autoMatchTransaction(
          db,
          plaidItem.portfolio_id,
          tx.name || '',
          tx.merchant_name || '',
          tx.personal_finance_category?.primary || '',
          tx.amount
        );

        await db.from('bank_transactions').upsert(
          {
            portfolio_id: plaidItem.portfolio_id,
            bank_account_id: plaidItem.bank_account_id,
            plaid_item_id: plaidItem.id,
            plaid_transaction_id: tx.transaction_id,
            amount: tx.amount,
            date: tx.date,
            name: tx.name,
            merchant_name: tx.merchant_name || null,
            category: tx.personal_finance_category?.primary || null,
            category_detail: tx.personal_finance_category?.detailed || null,
            pending: tx.pending,
            iso_currency_code: tx.iso_currency_code || 'USD',
            gl_account_id: match.gl_account_id,
            match_confidence: match.confidence,
            match_method: match.method,
          },
          {
            onConflict: 'bank_account_id,plaid_transaction_id',
            ignoreDuplicates: false,
          }
        );
        addedCount++;
      }

      // Process modified
      for (const tx of modified) {
        await db
          .from('bank_transactions')
          .update({
            amount: tx.amount,
            date: tx.date,
            name: tx.name,
            merchant_name: tx.merchant_name || null,
            pending: tx.pending,
          })
          .eq('plaid_transaction_id', tx.transaction_id);
        modifiedCount++;
      }

      // Process removed
      for (const removedId of removed) {
        const txId = typeof removedId === 'string' ? removedId : (removedId as any).transaction_id;
        if (txId) {
          await db.from('bank_transactions').delete().eq('plaid_transaction_id', txId);
        }
        removedCount++;
      }

      hasMore = has_more;
      cursor = next_cursor;
    }

    // Update cursor and last_sync_at
    await db
      .from('plaid_items')
      .update({
        cursor: cursor || null,
        last_sync_at: new Date().toISOString(),
        status: 'active',
        error_message: null,
      })
      .eq('id', plaidItem.id);

    return NextResponse.json({
      success: true,
      added: addedCount,
      modified: modifiedCount,
      removed: removedCount,
    });
  } catch (error: any) {
    console.error('Error syncing transactions:', error?.response?.data || error);
    return NextResponse.json(
      { error: error?.response?.data?.error_message || error?.message || 'Failed to sync transactions' },
      { status: 500 }
    );
  }
}
