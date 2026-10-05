import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { Alert } from '@/components/ui/shell'
import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { ACTIVE_VIOLATION_STATUSES } from '@/lib/violations/queries'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'
import { computeAssociationHealth, healthTone, HEALTH_DEDUCTIONS, HEALTH_LABELS, OPEN_WORK_ORDER_STATUSES, type HealthStatus } from '@/lib/company-admin/health'
import { todayInZone } from '@/lib/time/zoned'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

function Gauge({ value }: { value: number }) {
  const rotation = (value / 100) * 180 - 90
  return (
    <div className="relative mx-auto h-32 w-64">
      <svg viewBox="0 0 200 120" className="h-full w-full">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#F3F4F6" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#EF4444" strokeWidth="12" strokeLinecap="butt" />
        <path d="M 100 20 A 80 80 0 0 1 150 65" fill="none" stroke="#F59E0B" strokeWidth="12" strokeLinecap="butt" />
        <path d="M 150 65 A 80 80 0 0 1 180 100" fill="none" stroke="#10B981" strokeWidth="12" strokeLinecap="butt" />
        <line x1="100" y1="100" x2={100 + 75 * Math.cos((rotation * Math.PI) / 180)} y2={100 + 75 * Math.sin((rotation * Math.PI) / 180)} stroke="#030712" strokeWidth="2" strokeLinecap="round" />
        <circle cx="100" cy="100" r="4" fill="#030712" />
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <div className="text-3xl font-semibold tabular-nums text-gray-950">{value}%</div>
        <div className="text-xs text-gray-500">Overall Health</div>
      </div>
    </div>
  )
}

function HealthBadge({ status }: { status: HealthStatus }) {
  return <StatusChip tone={healthTone(status)}>{HEALTH_LABELS[status]}</StatusChip>
}

export default async function PortfolioHealthPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  // Calendar dates are the company's zone (server code runs in UTC).
  const todayDate = todayInZone()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  // Paged reads: a plain select stops at 1,000 rows and silently undercounted
  // larger portfolios.
  const [assocRes, woRes, violRes, amRes] = await Promise.all([
    fetchAllRows(() => db
      .from('associations')
      .select('id, slug, name, city, state, unit_count')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null)
      .order('name')
      .order('id')),
    fetchAllRows(() => db
      .from('work_orders')
      .select('association_id, id, status, priority, scheduled_date')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null)
      .in('status', [...OPEN_WORK_ORDER_STATUSES])
      .order('id')),
    fetchAllRows(() => db
      .from('violations')
      .select('association_id, id')
      .is('archived_at', null)
      .in('status', [...ACTIVE_VIOLATION_STATUSES])
      .order('id')),
    fetchAllRows(() => db
      .from('association_managers')
      .select('id, association_id, user_id')
      .is('ended_at', null)
      .order('id')),
  ])
  const associations = assocRes.rows as any[]
  const assocManagers = amRes.rows as any[]

  // `activity` is an internal agent log, not user sign-ins; last_login_at is
  // stamped by record_login_attempt on every successful login.
  const assignedManagerIds = [...new Set(assocManagers.map((am: any) => am.user_id).filter(Boolean))]
  const loginsRes = assignedManagerIds.length > 0
    ? await db.from('profiles').select('id').in('id', assignedManagerIds).gte('last_login_at', sevenDaysAgo)
    : { data: [], error: null }

  const loadErrors = collectLoadErrors({
    Associations: assocRes,
    'Work orders': woRes,
    Violations: violRes,
    'Manager assignments': amRes,
    'Manager sign-ins': loginsRes,
  })

  const activeManagerIds = new Set((loginsRes.data ?? []).map((p: any) => p.id))
  const managerByAssoc = new Map<string, string[]>()
  for (const am of assocManagers) {
    if (!managerByAssoc.has(am.association_id)) managerByAssoc.set(am.association_id, [])
    managerByAssoc.get(am.association_id)!.push(am.user_id)
  }

  // Shared formula (lib/company-admin/health) so this page, the Executive
  // Dashboard and the Associations list agree on every score.
  const healthByAssoc = computeAssociationHealth(associations.map((a: any) => a.id), woRes.rows, violRes.rows, todayDate)

  const healthRows = associations.map((assoc: any) => {
    const h = healthByAssoc.get(assoc.id)!
    const mgrIds = managerByAssoc.get(assoc.id) ?? []
    const anyManagerActive = mgrIds.length === 0 || mgrIds.some((uid) => activeManagerIds.has(uid))
    return {
      id: assoc.id,
      slug: assoc.slug,
      name: assoc.name,
      city: assoc.city,
      state: assoc.state,
      unitCount: assoc.unit_count ?? 0,
      openWorkOrders: h.open,
      overdueWorkOrders: h.overdue,
      emergencies: h.emergency,
      openViolations: h.violations,
      managerActive: anyManagerActive,
      status: h.status,
      score: h.score,
    }
  })

  const overallScore = healthRows.length > 0 ? Math.round(healthRows.reduce((sum: number, r: any) => sum + r.score, 0) / healthRows.length) : 0
  const healthy = healthRows.filter((r: any) => r.status === 'healthy')
  const warning = healthRows.filter((r: any) => r.status === 'warning')
  const critical = healthRows.filter((r: any) => r.status === 'critical')

  const summaryCards = [
    { href: '#healthy', icon: CheckCircle2, count: healthy.length, label: 'Healthy', note: 'Score 80 or above' },
    { href: '#warning', icon: AlertTriangle, count: warning.length, label: 'Warning', note: 'Score 50–79' },
    { href: '#critical', icon: AlertOctagon, count: critical.length, label: 'Critical', note: 'Score below 50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Portfolio Health</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Real-time health monitoring across all associations</p>
      </div>

      {loadErrors.length > 0 && <Alert tone="danger" title="Some data could not be loaded; scores below may be incomplete.">{loadErrors.join(' · ')}</Alert>}

      <div className={`${card} p-8 text-center`}>
        <Gauge value={overallScore} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaryCards.map((c) => {
          const Icon = c.icon
          return (
            <Link key={c.label} href={c.href} className={`${card} p-5 transition-colors hover:border-gray-300`}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70"><Icon className="h-5 w-5 text-gray-400" /></div>
                <div><div className="text-2xl font-semibold tabular-nums text-gray-950">{c.count}</div><div className="text-xs text-gray-500">{c.label}</div></div>
              </div>
              <div className="mt-3 text-xs text-gray-500">{c.note}</div>
            </Link>
          )
        })}
      </div>

      <div className={`${card} p-6`}>
        <h2 className="text-sm font-semibold text-gray-950">Health Score Factors</h2>
        <p className="mt-1 text-xs text-gray-500">Each association starts at 100; every open item deducts points (minimum 0).</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Open work order', points: HEALTH_DEDUCTIONS.open },
            { label: 'Overdue work order (extra)', points: HEALTH_DEDUCTIONS.overdue },
            { label: 'Emergency work order (extra)', points: HEALTH_DEDUCTIONS.emergency },
            { label: 'Open violation', points: HEALTH_DEDUCTIONS.violations },
          ].map((factor) => (
            <div key={factor.label} className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-gray-50/60 px-4 py-3">
              <span className="text-sm text-gray-600">{factor.label}</span>
              <span className="text-sm font-medium tabular-nums text-gray-950">−{factor.points}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Association Health Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-2.5 text-left font-medium">Association</th>
                <th className="px-6 py-2.5 text-left font-medium">Location</th>
                <th className="px-6 py-2.5 text-right font-medium">Units</th>
                <th className="px-6 py-2.5 text-right font-medium">Open WO</th>
                <th className="px-6 py-2.5 text-right font-medium">Overdue WO</th>
                <th className="px-6 py-2.5 text-right font-medium">Violations</th>
                <th className="px-6 py-2.5 text-right font-medium">Score</th>
                <th className="px-6 py-2.5 text-center font-medium">Status</th>
                <th className="px-6 py-2.5 text-center font-medium">Mgr Active</th>
              </tr>
            </thead>
            <tbody>
              {healthRows.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">No associations found.</td></tr>
              ) : (
                healthRows.sort((a: any, b: any) => { const order: Record<string, number> = { critical: 0, warning: 1, healthy: 2 }; return order[a.status] - order[b.status] })
                  .map((row: any, i: number, sorted: any[]) => (
                    <tr key={row.id} id={i === 0 || sorted[i - 1].status !== row.status ? row.status : undefined} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-6 py-3">
                        <Link href={`/associations/${row.slug ?? row.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{row.name}</Link>
                      </td>
                      <td className="px-6 py-3 text-[13px] text-gray-700">{[row.city, row.state].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-gray-700">{row.unitCount}</td>
                      <td className={`px-6 py-3 text-right tabular-nums ${row.openWorkOrders > 0 ? 'font-medium text-amber-700' : 'text-gray-700'}`}>{row.openWorkOrders}</td>
                      <td className={`px-6 py-3 text-right tabular-nums ${row.overdueWorkOrders > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{row.overdueWorkOrders}</td>
                      <td className={`px-6 py-3 text-right tabular-nums ${row.openViolations > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{row.openViolations}</td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        <span className={row.score >= 80 ? 'text-emerald-700' : row.score >= 50 ? 'text-amber-700' : 'text-red-700'}>{row.score}%</span>
                      </td>
                      <td className="px-6 py-3 text-center"><HealthBadge status={row.status} /></td>
                      <td className="px-6 py-3 text-center">
                        {row.managerActive ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" /> : <AlertTriangle className="mx-auto h-4 w-4 text-amber-600" />}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
