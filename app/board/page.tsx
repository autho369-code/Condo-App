import { glDebitBalances, receivableSummary, type ReceivableSummary } from '@/lib/finance/totals'
import { Alert } from '@/components/ui/shell'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date, money } from '@/lib/utils'
import {
  Landmark,
  PiggyBank,
  Receipt,
  AlertTriangle,
  CalendarDays,
  ArrowRight,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  href?: string
  tone?: 'danger' | 'warning' | 'success'
}) {
  const body = (
    <div className={`${card} px-4 py-3.5 ${href ? 'transition-colors hover:bg-gray-50/70' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-medium leading-5 text-gray-500">{label}</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : tone === 'success' ? 'text-emerald-700' : 'text-gray-950'}`}>{value}</div>
          {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default async function BoardDashboardPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []
  const now = new Date()

  if (ids.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Board Dashboard</h1>
        <div className={`${card} p-12 text-center`}>
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No associations assigned to your board membership.</p>
        </div>
      </div>
    )
  }

  // The board portal is a read-only view of basic financials, meeting minutes
  // and governing documents — no vendors, owners or operational records.
  const [
    { data: assoc, error: assocError },
    { data: bankAccounts, error: bankError },
    { data: meetings, error: meetingsError },
  ] = await Promise.all([
    db.from('associations').select('id, name').in('id', ids),
    db.from('bank_accounts').select('id, gl_account_id, purpose, fund_type, association_id').in('association_id', ids).is('archived_at', null),
    db.from('meetings').select('id, title, meeting_type, start_time, location').in('association_id', ids).is('archived_at', null).in('status', ['scheduled', 'in_progress']).gte('start_time', now.toISOString()).order('start_time').limit(5),
  ])
  const loadErrors = [
    assocError && `Associations could not be loaded: ${assocError.message}`,
    meetingsError && `Meetings could not be loaded: ${meetingsError.message}`,
  ].filter(Boolean) as string[]

  // Aggregate past-due receivables only (no owner names).
  let receivables: ReceivableSummary | null = null
  let receivablesError: string | null = null
  try {
    receivables = await receivableSummary(db, ids)
  } catch (e) {
    receivablesError = e instanceof Error ? e.message : String(e)
  }

  // Bank balances: posted journal lines summed onto each bank account's GL account.
  let balByGl = new Map<string, number>()
  let balancesError: string | null = bankError ? bankError.message : null
  if (!bankError) try {
    balByGl = await glDebitBalances(db, {
      glAccountIds: [...new Set((bankAccounts ?? []).map((b: any) => b.gl_account_id).filter(Boolean))] as string[],
      associationIds: ids,
    })
  } catch (e) {
    balancesError = e instanceof Error ? e.message : String(e)
  }
  let operating = 0
  let reserve = 0
  for (const b of bankAccounts ?? []) {
    const bal = b.gl_account_id ? (balByGl.get(b.gl_account_id) ?? 0) : 0
    if (b.fund_type === 'reserve' || (b.purpose ?? '').toLowerCase().includes('reserve')) reserve += bal
    else operating += bal
  }

  const assocNames = (assoc ?? []).map((a: any) => a.name).join(', ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Board Dashboard</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Financial overview for {assocNames || 'your association'}</p>
      </div>

      {loadErrors.map((msg) => <Alert key={msg} tone="danger">{msg}</Alert>)}
      {receivablesError && <Alert tone="danger" title="Receivables could not be loaded">{receivablesError}</Alert>}
      {balancesError && <Alert tone="danger" title="Bank balances could not be loaded">{balancesError}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Operating Balance" value={balancesError ? '—' : money(operating)} icon={Landmark} href="/board/financials" />
        <StatCard label="Reserve Balance" value={balancesError ? '—' : money(reserve)} icon={PiggyBank} href="/board/financials" />
        <StatCard label="Past-Due Receivables" value={receivablesError ? '—' : money(receivables?.overdueTotal ?? 0)} sub={receivablesError ? 'Unavailable' : `${receivables?.delinquentUnits ?? 0} unit${(receivables?.delinquentUnits ?? 0) === 1 ? '' : 's'}`} icon={Receipt} href="/board/financials" />
        <StatCard label="Upcoming Meetings" value={meetingsError ? '—' : (meetings ?? []).length} icon={CalendarDays} href="/board/meetings" />
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">Upcoming Meetings</h2>
          <Link href="/board/meetings" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            All meetings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {meetingsError ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">Meetings are unavailable right now.</p>
          ) : (meetings ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No upcoming meetings scheduled.</p>
          ) : (
            (meetings ?? []).map((m: any) => (
              <Link key={m.id} href={`/board/meetings/${m.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60">
                <div>
                  <div className="text-sm font-medium text-gray-900">{m.title}</div>
                  <div className="mt-0.5 text-xs capitalize text-gray-500">{(m.meeting_type ?? '').replace(/_/g, ' ')}{m.location ? ` · ${m.location}` : ''}</div>
                </div>
                <div className="text-[13px] tabular-nums text-gray-700">{date(m.start_time)}</div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
