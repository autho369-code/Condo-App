// POST /api/plaid/exchange-token
// Exchanges a Plaid public_token for an access_token and saves the connection

import { NextRequest, NextResponse } from 'next/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';

export async function POST(request: NextRequest) {
  try {
    // Banking connections are a staff-only capability.
    let user;
    try {
      user = await requireFinanceStaff();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: 'Plaid is not configured.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { public_token, institution_id, institution_name, bank_account_id } = body;

    if (!public_token) {
      return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const db = supabase as any;
    const client = getPlaidClient();

    // Get user's portfolio_id
    const { data: profile } = await db
      .from('profiles')
      .select('portfolio_id')
      .eq('id', user.auth_user_id)
      .single();

    if (!profile?.portfolio_id) {
      return NextResponse.json({ error: 'No portfolio found' }, { status: 400 });
    }

    // The bank account must be one of the caller's own (RLS scopes the read
    // to their company and associations) before a connection is tied to it.
    if (bank_account_id) {
      const { data: ownBank } = await db
        .from('bank_accounts')
        .select('id, portfolio_id')
        .eq('id', String(bank_account_id))
        .is('archived_at', null)
        .maybeSingle();
      if (!ownBank || ownBank.portfolio_id !== profile.portfolio_id) {
        return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
      }
    }

    // Exchange public_token for access_token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution details if not provided
    let instId = institution_id;
    let instName = institution_name;

    // Save to plaid_items
    const { data: plaidItem, error: insertError } = await db
      .from('plaid_items')
      .insert({
        portfolio_id: profile.portfolio_id,
        bank_account_id: bank_account_id || null,
        plaid_item_id: itemId,
        plaid_access_token: accessToken,
        plaid_institution_id: instId,
        plaid_institution_name: instName,
        status: 'active',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error saving plaid_item:', insertError);
      return NextResponse.json({ error: 'Failed to save bank connection' }, { status: 500 });
    }

    // If bank_account_id was provided, enable auto-reconciliation
    if (bank_account_id) {
      const { error: autoError } = await db
        .from('bank_accounts')
        .update({ auto_reconciliation: true })
        .eq('id', bank_account_id);
      if (autoError) console.error('Could not turn on auto-reconciliation:', autoError);
    }

    return NextResponse.json({
      success: true,
      plaid_item_id: plaidItem.id,
      institution_name: instName || 'Connected Bank',
    });
  } catch (error: any) {
    console.error('Error exchanging token:', error?.response?.data || error);
    return NextResponse.json(
      { error: error?.response?.data?.error_message || error?.message || 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
