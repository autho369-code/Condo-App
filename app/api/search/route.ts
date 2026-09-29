/**
 * GET /api/search?q=...
 *
 * Command-palette record search for the staff workspace. Uses the caller's
 * RLS-scoped client, so it can only return rows the user may already read.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/me';
import { searchEverything } from '@/lib/search/global';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let me;
  try {
    me = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  if (!me.is_staff && !me.is_company_admin && !me.is_platform_operator) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get('q') ?? '';
  const supabase = await createClient();
  const results = await searchEverything(supabase as any, q, { finance: me.is_finance_staff || me.is_platform_operator });
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
}
