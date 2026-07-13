// POST /api/plaid/create-link-token
// Creates a Plaid Link token for the bank connection UI

import { NextRequest, NextResponse } from 'next/server';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/client';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Products, CountryCode } from 'plaid';

export async function POST(request: NextRequest) {
  try {
    // Banking connections are a staff-only capability.
    let user;
    try {
      user = await requireStaff();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.auth_user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isPlaidConfigured()) {
      return NextResponse.json(
        { error: 'Plaid is not configured. Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV in environment variables.' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const client = getPlaidClient();

    // Get user's portfolio_id from profiles
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('portfolio_id, full_name, email')
      .eq('id', user.auth_user_id)
      .single();

    if (!profile?.portfolio_id) {
      return NextResponse.json({ error: 'No portfolio found for user' }, { status: 400 });
    }

    const config = {
      user: {
        client_user_id: user.auth_user_id,
        legal_name: profile.full_name || profile.email || 'User',
      },
      client_name: 'Portier369',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
      redirect_uri: process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/bank-accounts/link-bank`
        : undefined,
    };

    const response = await client.linkTokenCreate(config);

    return NextResponse.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
  } catch (error: any) {
    console.error('Error creating link token:', error?.response?.data || error);
    return NextResponse.json(
      { error: error?.response?.data?.error_message || error?.message || 'Failed to create link token' },
      { status: 500 }
    );
  }
}
