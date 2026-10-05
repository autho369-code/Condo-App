// POST /api/plaid/exchange-token
// Exchanges a Plaid public_token for an access_token and saves the connection

import { NextRequest, NextResponse } from 'next/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { plaidErrorSummary, plaidPublicMessage } from '@/lib/plaid/errors';

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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const publicToken = typeof body.public_token === 'string' ? body.public_token.trim() : '';
    const bank_account_id = typeof body.bank_account_id === 'string' && body.bank_account_id ? body.bank_account_id : null;
    const instId = typeof body.institution_id === 'string' ? body.institution_id.slice(0, 120) : null;
    const instName = typeof body.institution_name === 'string' ? body.institution_name.slice(0, 200) : null;

    if (!publicToken || publicToken.length > 512) {
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
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Save to plaid_items. The access token is a bank credential: browser
    // roles have no column privilege on it, so the write goes through the
    // service role — only after the finance-staff, portfolio and bank-account
    // checks above. Nothing token-related is returned to the browser.
    const service = createServiceClient() as any;
    const { data: plaidItem, error: insertError } = await service
      .from('plaid_items')
      .insert({
        portfolio_id: profile.portfolio_id,
        bank_account_id,
        plaid_item_id: itemId,
        plaid_access_token: accessToken,
        plaid_institution_id: instId,
        plaid_institution_name: instName,
        status: 'active',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error saving plaid_item:', insertError.message);
      return NextResponse.json({ error: 'Failed to save bank connection' }, { status: 500 });
    }

    // If bank_account_id was provided, enable auto-reconciliation
    if (bank_account_id) {
      const { error: autoError } = await db
        .from('bank_accounts')
        .update({ auto_reconciliation: true })
        .eq('id', bank_account_id);
      if (autoError) console.error('Could not turn on auto-reconciliation:', autoError.message);
    }

    return NextResponse.json({
      success: true,
      plaid_item_id: plaidItem.id,
      institution_name: instName || 'Connected Bank',
    });
  } catch (error: any) {
    console.error('Error exchanging token:', plaidErrorSummary(error));
    return NextResponse.json(
      { error: plaidPublicMessage(error, 'Failed to exchange token') },
      { status: 500 }
    );
  }
}
