// POST /api/plaid/transactions/sync
// Syncs bank transactions from Plaid for a connected bank account

import { NextRequest, NextResponse } from 'next/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { autoMatchTransaction } from '@/lib/plaid/auto-match';
import { plaidErrorSummary, plaidPublicMessage } from '@/lib/plaid/errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    // Banking connections are a staff-only capability.
    // Same capability as connecting the bank (plaid_items RLS is finance-only).
    try {
      await requireFinanceStaff();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: 'Plaid is not configured.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    const plaid_item_id = typeof body?.plaid_item_id === 'string' ? body.plaid_item_id : '';
    if (!UUID_PATTERN.test(plaid_item_id)) {
      return NextResponse.json({ error: 'plaid_item_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const db = supabase as any;
    const client = getPlaidClient();

    // Authorization: the caller's RLS-scoped client must be able to see the
    // item (can_manage_finance on its portfolio). Only then is the bank
    // credential read with the service role — browser roles have no column
    // privilege on plaid_access_token / cursor.
    const { data: visibleItem, error: itemError } = await db
      .from('plaid_items')
      .select('id, portfolio_id, bank_account_id')
      .eq('id', plaid_item_id)
      .maybeSingle();

    if (itemError || !visibleItem) {
      return NextResponse.json({ error: 'Plaid item not found' }, { status: 404 });
    }

    const service = createServiceClient() as any;
    const { data: secretRow, error: secretError } = await service
      .from('plaid_items')
      .select('plaid_access_token, cursor')
      .eq('id', visibleItem.id)
      .eq('portfolio_id', visibleItem.portfolio_id)
      .maybeSingle();
    if (secretError || !secretRow?.plaid_access_token) {
      return NextResponse.json({ error: 'Plaid item not found' }, { status: 404 });
    }
    const plaidItem = { ...visibleItem, ...secretRow };
    // Vendor matching stays inside the bank account's association.
    // A failed or empty lookup must not fall back to company-level matching.
    const { data: bankAccount, error: bankAccountError } = plaidItem.bank_account_id
      ? await db.from('bank_accounts').select('association_id').eq('id', plaidItem.bank_account_id).maybeSingle()
      : { data: null, error: null };
    if (plaidItem.bank_account_id && (bankAccountError || !bankAccount)) {
      return NextResponse.json({ error: 'The linked bank account could not be loaded. Nothing was synced; try again.' }, { status: 500 });
    }
    const bankAssociationId: string | null = bankAccount?.association_id ?? null;

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
          tx.amount,
          bankAssociationId
        );

        const { error: upsertError } = await db.from('bank_transactions').upsert(
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
        // A failed save must stop the sync before the cursor moves past it,
        // or the transaction is never imported.
        if (upsertError) throw new Error(`Could not save transaction ${tx.transaction_id}: ${upsertError.message}`);
        addedCount++;
      }

      // Process modified
      for (const tx of modified) {
        const { error: modError } = await db
          .from('bank_transactions')
          .update({
            amount: tx.amount,
            date: tx.date,
            name: tx.name,
            merchant_name: tx.merchant_name || null,
            pending: tx.pending,
          })
          .eq('plaid_transaction_id', tx.transaction_id)
          .eq('plaid_item_id', plaidItem.id);
        if (modError) throw new Error(`Could not update transaction ${tx.transaction_id}: ${modError.message}`);
        modifiedCount++;
      }

      // Process removed
      for (const removedId of removed) {
        const txId = typeof removedId === 'string' ? removedId : (removedId as any).transaction_id;
        if (txId) {
          const { error: delError } = await db.from('bank_transactions').delete()
            .eq('plaid_transaction_id', txId)
            .eq('plaid_item_id', plaidItem.id);
          if (delError) throw new Error(`Could not remove transaction ${txId}: ${delError.message}`);
        }
        removedCount++;
      }

      hasMore = has_more;
      cursor = next_cursor;
    }

    // Update cursor and last_sync_at (service role: cursor is not browser-writable).
    const { error: cursorError } = await service
      .from('plaid_items')
      .update({
        cursor: cursor || null,
        last_sync_at: new Date().toISOString(),
        status: 'active',
        error_message: null,
      })
      .eq('id', plaidItem.id);
    if (cursorError) throw new Error(`Transactions saved, but the sync position was not stored: ${cursorError.message}`);

    return NextResponse.json({
      success: true,
      added: addedCount,
      modified: modifiedCount,
      removed: removedCount,
    });
  } catch (error: any) {
    console.error('Error syncing transactions:', plaidErrorSummary(error));
    return NextResponse.json(
      { error: plaidPublicMessage(error, 'Failed to sync transactions') },
      { status: 500 }
    );
  }
}
