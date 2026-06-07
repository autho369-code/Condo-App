import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { NextResponse } from 'next/server'

export async function GET() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any

  let requests: any[] = []
  try {
    const { data } = await db
      .from('platform_requests')
      .select('*')
      .eq('portfolio_id', me.portfolio.id)
      .order('created_at', { ascending: false })
      .limit(200)
    requests = data ?? []
  } catch {
    requests = []
  }

  return NextResponse.json({ requests })
}
