import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react'

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

function HealthBadge({ status }: { status: 'healthy' | 'warning' | 'attention' | 'critical' }) {
  const tones: Record<string, Tone> = { healthy: 'success', warning: 'warning', attention: 'warning', critical: 'danger' }
  const labels = { healthy: 'Healthy', warning: 'Warning', attention: 'Attention', critical: 'Critical' }
  return <StatusChip tone={tones[status]}>{labels[status]}</StatusChip>
}

export default async function PortfolioHealthPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString()

  const { data: associations } = await db
    .from('associations')
    .select('id, slug, name, city, state, unit_count')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')

  const { data: allWorkOrders } = await db
    .from('work_orders')
    .select('association_id, id, status, scheduled_date')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')

  const { data: allViolations } = await db
    .from('violations')
    .select('association_id, id')
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')

  const { data: assocManagers } = await db
    .from('association_managers')
    .select('association_id, user_id')
    .is('ended_at', null)

  const { data: recentActivity } = await db
    .from('activity')
    .select('user_id, created_at')
    .gte('created_at', sevenDaysAgo)

  const activeManagerIds = new Set((recentActivity ?? []).map((a: any) => a.user_id))
  const managerByAssoc = new Map<string, string[]>()
  for (const am of assocManagers ?? []) {
    if (!managerByAssoc.has(am.association_id)) managerByAssoc.set(am.association_id, [])
    managerByAssoc.get(am.association_id)!.push(am.user_id)
  }

  const healthRows = (associations ?? []).map((assoc: any) => {
    const openWO = (allWorkOrders ?? []).filter((wo: any) => wo.association_id === assoc.id)
    const overdueWO = openWO.filter((wo: any) => wo.scheduled_date && wo.scheduled_date < todayDate)
    const viols = (allViolations ?? []).filter((v: any) => v.association_id === assoc.id)
    const mgrIds = managerByAssoc.get(assoc.id) ?? []
    const anyManagerActive = mgrIds.length === 0 || mgrIds.some((uid) => activeManagerIds.has(uid))

    const woScore = Math.min(100, openWO.length * 25)
    const overdueScore = Math.min(100, overdueWO.length * 20)
    const violationScore = Math.min(100, viols.length * 15)
    const managerScore = anyManagerActive ? 0 : 5
    const deductionScore = woScore + overdueScore + violationScore + managerScore
    const score = Math.max(0, 100 - deductionScore)

    let status: 'healthy' | 'warning' | 'attention' | 'critical'
    if (overdueWO.length > 3 || viols.length > 5 || !anyManagerActive) {
      status = 'critical'
    } else if (overdueWO.length > 1 || openWO.length > 5 || viols.length > 2) {
      status = 'attention'
    } else if (overdueWO.length > 0 || openWO.length > 2 || viols.length > 0) {
      status = 'warning'
    } else {
      status = 'healthy'
    }

    return {
      id: assoc.id,
      slug: assoc.slug,
      name: assoc.name,
      city: assoc.city,
      state: assoc.state,
      unitCount: assoc.unit_count ?? 0,
      openWorkOrders: openWO.length,
      overdueWorkOrders: overdueWO.length,
      openViolations: viols.length,
      managerActive: anyManagerActive,
      status,
      score,
    }
  })

  const overallScore = healthRows.length > 0 ? Math.round(healthRows.reduce((sum: number, r: any) => sum + r.score, 0) / healthRows.length) : 0
  const healthy = healthRows.filter((r: any) => r.status === 'healthy')
  const warning = healthRows.filter((r: any) => r.status === 'warning')
  const attention = healthRows.filter((r: any) => r.status === 'attention')
  const critical = healthRows.filter((r: any) => r.status === 'critical')

  const summaryCards = [
    { href: '#healthy', icon: CheckCircle2, count: healthy.length, label: 'Healthy', note: 'No issues' },
    { href: '#warning', icon: HelpCircle, count: warning.length, label: 'Warning', note: 'Some overdue items' },
    { href: '#attention', icon: AlertTriangle, count: attention.length, label: 'Attention', note: 'Multiple overdue items' },
    { href: '#critical', icon: AlertOctagon, count: critical.length, label: 'Critical', note: 'High overdue, no activity' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Portfolio Health</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Real-time health monitoring across all associations</p>
      </div>

      <div className={`${card} p-8 text-center`}>
        <Gauge value={overallScore} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Open Work Orders', weight: '25%' },
            { label: 'Overdue Work Orders', weight: '20%' },
            { label: 'Unanswered Messages', weight: '15%' },
            { label: 'Open Violations', weight: '15%' },
            { label: 'Vendor Delays', weight: '10%' },
            { label: 'Delinquency Level', weight: '10%' },
            { label: 'Manager Inactivity', weight: '5%' },
          ].map((factor) => (
            <div key={factor.label} className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-gray-50/60 px-4 py-3">
              <span className="text-sm text-gray-600">{factor.label}</span>
              <span className="text-sm font-medium tabular-nums text-gray-950">{factor.weight}</span>
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
                healthRows.sort((a: any, b: any) => { const order: Record<string, number> = { critical: 0, attention: 1, warning: 2, healthy: 3 }; return order[a.status] - order[b.status] })
                  .map((row: any) => (
                    <tr key={row.id} id={row.status} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
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
