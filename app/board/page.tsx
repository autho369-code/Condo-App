import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { date, money } from '@/lib/utils'
import {
  Heart,
  Landmark,
  PiggyBank,
  Users,
  Wrench,
  AlertTriangle,
  HardHat,
  CalendarDays,
  Truck,
  Siren,
  ArrowRight,
  Vote,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const OPEN_WO_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress']

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
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : tone === 'success' ? 'text-emerald-700' : 'text-gray-950'}`}>{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
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
  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString()

  if (ids.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Board Dashboard</h1>
        <div className={`${card} p-12 text-center`}>
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No associations assigned to your board membership.</p>
        </div>
      </div>
    )
  }

  const [
    { data: assoc },
    { data: openWOs },
    { data: viols },
    { data: balances },
    { data: bankAccounts },
    { data: bankLines },
    { data: meetings },
    { data: vendorVisits },
    { data: approvals },
  ] = await Promise.all([
    db.from('associations').select('id, name').in('id', ids),
    db.from('work_orders').select('id, association_id, status, priority, scheduled_date, category, title').in('association_id', ids).is('archived_at', null).in('status', OPEN_WO_STATUSES),
    db.from('violations').select('id').in('association_id', ids).is('archived_at', null).not('status', 'in', '("closed","cured","violation_dismissed")'),
    db.from('unit_balances').select('balance').in('association_id', ids),
    db.from('bank_accounts').select('id, gl_account_id, purpose, association_id').in('association_id', ids).is('archived_at', null),
    db.from('journal_lines').select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(posted)').in('association_id', ids).eq('journal_entries.posted', true),
    db.from('meetings').select('id, title, meeting_type, start_time, location').in('association_id', ids).is('archived_at', null).gte('start_time', today.toISOString()).order('start_time').limit(5),
    db.from('calendar_events').select('id, title, start_datetime, vendors(name)').in('association_id', ids).not('vendor_id', 'is', null).is('archived_at', null).gte('start_datetime', today.toISOString()).lte('start_datetime', in30).order('start_datetime').limit(5),
    db.from('approval_requests').select('id, title, status').in('association_id', ids).eq('status', 'pending').limit(10),
  ])

  const open = openWOs ?? []
  const overdue = open.filter((wo: any) => wo.scheduled_date && wo.scheduled_date < todayDate).length
  const emergencies = open.filter((wo: any) => wo.priority === 'emergency')
  const activeProjects = open.filter((wo: any) =>
    wo.category === 'project' || wo.category === 'major_repair' || /project/i.test(wo.title ?? '')).length
  const openViolations = (viols ?? []).length
  const delinquentUnits = (balances ?? []).filter((b: any) => Number(b.balance ?? 0) > 0).length
  const arTotal = (balances ?? []).reduce((s: number, b: any) => s + Math.max(0, Number(b.balance ?? 0)), 0)

  // Bank balances: roll posted journal lines up onto each bank account's GL account.
  const balByGl = new Map<string, number>()
  for (const l of bankLines ?? []) {
    balByGl.set(l.gl_account_id, (balByGl.get(l.gl_account_id) ?? 0) + Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0))
  }
  let operating = 0
  let reserve = 0
  for (const b of bankAccounts ?? []) {
    const bal = b.gl_account_id ? (balByGl.get(b.gl_account_id) ?? 0) : 0
    if ((b.purpose ?? '').toLowerCase().includes('reserve')) reserve += bal
    else operating += bal
  }

  // Health score — same weighting as the company-admin dashboard.
  const score = Math.max(5, Math.min(100,
    100 - overdue * 12 - open.length * 4 - openViolations * 6 - emergencies.length * 15))
  const health = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs attention' : 'Critical'

  const pendingVotes = (approvals ?? []).length
  const assocNames = (assoc ?? []).map((a: any) => a.name).join(', ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Board Dashboard</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Governance overview for {assocNames || 'your association'}</p>
      </div>

      {/* ── Emergency alerts ─────────────────────────── */}
      {emergencies.length > 0 && (
        <Link href="/board/work-orders" className="block rounded-2xl border border-red-200 bg-red-50/70 p-4 transition-colors hover:bg-red-50">
          <div className="flex items-start gap-3">
            <Siren className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <div className="text-sm font-semibold text-red-800">
                {emergencies.length} emergency work order{emergencies.length === 1 ? '' : 's'} open right now
              </div>
              <p className="mt-0.5 text-[13px] text-red-700">
                {emergencies.slice(0, 3).map((e: any) => e.title).join(' · ')}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* ── Pending votes ─────────────────────────────── */}
      {pendingVotes > 0 && (
        <Link href="/board/approvals" className="block rounded-2xl border border-blue-200 bg-blue-50/70 p-4 transition-colors hover:bg-blue-50">
          <div className="flex items-start gap-3">
            <Vote className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-blue-900">
                {pendingVotes} item{pendingVotes === 1 ? '' : 's'} awaiting your vote
              </div>
              <p className="mt-0.5 text-[13px] text-blue-800">
                {(approvals ?? []).slice(0, 3).map((a: any) => a.title).join(' · ')}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* ── KPI grid ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Health Score" value={`${score}`} sub={health} icon={Heart} tone={score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger'} />
        <StatCard label="Operating Balance" value={money(operating)} icon={Landmark} href="/board/financials" />
        <StatCard label="Reserve Balance" value={money(reserve)} icon={PiggyBank} href="/board/financials" />
        <StatCard label="Delinquent Owners" value={delinquentUnits} sub={`${money(arTotal)} outstanding`} icon={Users} href="/board/delinquencies" tone={delinquentUnits > 0 ? 'warning' : undefined} />
        <StatCard label="Open Work Orders" value={open.length} sub={`${overdue} overdue`} icon={Wrench} href="/board/work-orders" tone={overdue > 0 ? 'warning' : undefined} />
        <StatCard label="Open Violations" value={openViolations} icon={AlertTriangle} href="/board/violations" />
        <StatCard label="Active Projects" value={activeProjects} icon={HardHat} href="/board/projects" />
        <StatCard label="Upcoming Meetings" value={(meetings ?? []).length} icon={CalendarDays} href="/board/meetings" />
        <StatCard label="Vendor Visits (30d)" value={(vendorVisits ?? []).length} icon={Truck} href="/board/calendar" />
        <StatCard label="Emergencies" value={emergencies.length} icon={Siren} href="/board/work-orders" tone={emergencies.length > 0 ? 'danger' : undefined} />
      </div>

      {/* ── Upcoming meetings ─────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Upcoming Meetings</h2>
          <Link href="/board/meetings" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            All meetings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(meetings ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No upcoming meetings scheduled.</p>
          ) : (
            (meetings ?? []).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{m.title}</div>
                  <div className="mt-0.5 text-xs capitalize text-gray-500">{(m.meeting_type ?? '').replace(/_/g, ' ')}{m.location ? ` · ${m.location}` : ''}</div>
                </div>
                <div className="text-[13px] tabular-nums text-gray-700">{date(m.start_time)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Upcoming vendor visits ────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Upcoming Vendor Visits</h2>
          <Link href="/board/calendar" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            Full calendar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(vendorVisits ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No vendor visits scheduled in the next 30 days.</p>
          ) : (
            (vendorVisits ?? []).map((v: any) => (
              <div key={v.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{v.title}</div>
                  {v.vendors?.name && <div className="mt-0.5 text-xs text-gray-500">{v.vendors.name}</div>}
                </div>
                <div className="text-[13px] tabular-nums text-gray-700">{date(v.start_datetime)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
