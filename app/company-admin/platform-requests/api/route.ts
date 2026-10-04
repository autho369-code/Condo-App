import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { NextResponse } from 'next/server'
import { PLATFORM_REQUEST_ADMIN_COLUMNS } from '@/lib/company-admin/platform-requests'

export async function GET() {
  const me = await requirePortfolioAdmin()
  if (!me.portfolio?.id) {
    return NextResponse.json({ error: 'Your account is not linked to a company.' }, { status: 403 })
  }
  const supabase = await createClient()
  const db = supabase as any

  // Explicit columns: select('*') returned the operator-only internal_notes
  // and assigned_to fields to company admins.
  const { data, error } = await db
    .from('platform_requests')
    .select(PLATFORM_REQUEST_ADMIN_COLUMNS)
    .eq('portfolio_id', me.portfolio.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: `Could not load platform requests: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ requests: data ?? [] })
}
