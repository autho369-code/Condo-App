import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

function Gauge({ value }: { value: number }) {
  const rotation = (value / 100) * 180 - 90
  return (
    <div className="relative h-32 w-64 mx-auto">
      <svg viewBox="0 0 200 120" className="h-full w-full">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1E293B" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#EF4444" strokeWidth="12" strokeLinecap="butt" />
        <path d="M 100 20 A 80 80 0 0 1 150 65" fill="none" stroke="#F59E0B" strokeWidth="12" strokeLinecap="butt" />
        <path d="M 150 65 A 80 80 0 0 1 180 100" fill="none" stroke="#10B981" strokeWidth="12" strokeLinecap="butt" />
        <line x1="100" y1="100" x2={100 + 75 * Math.cos((rotation * Math.PI) / 180)} y2={100 + 75 * Math.sin((rotation * Math.PI) / 180)} stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="100" cy="100" r="4" fill="#FFFFFF" />
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <div className="text-3xl font-bold text-white">{value}%</div>
        <div className="text-xs text-slate-500">Overall Health</div>
      </div>
    </div>
  )
}

function HealthBadge({ status }: { status: 'healthy' | 'warning' | 'attention' | 'critical' }) {
  const styles: Record<string, string> = {
    healthy: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
    attention: 'bg-orange-500/10 text-orange-400 ring-orange-500/20',
    critical: 'bg-red-500/10 text-red-400 ring-red-500/20',
  }
  const labels = { healthy: 'Healthy', warning: 'Warning', attention: 'Attention', critical: 'Critical' }
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${styles[status]}`}>{labels[status]}</span>
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
    .select('id, name, city, state, unit_count')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')

  const assocIds = (associations ?? []).map((a: any) => a.id)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Portfolio Health</h1>
        <p className="mt-1 text-sm text-slate-400">Real-time health monitoring across all associations</p>
      </div>

      <div className="rounded-xl border border-[#1E293B] p-8 text-center" style={{ backgroundColor: '#0B1121' }}>
        <Gauge value={overallScore} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="#healthy" className="rounded-xl border border-emerald-500/20 p-5 transition-colors hover:border-emerald-500/40" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10"><CheckCircle2 className="h-5 w-5 text-emerald-400" /></div>
            <div><div className="text-2xl font-bold text-emerald-400">{healthy.length}</div><div className="text-xs text-slate-500">Healthy</div></div>
          </div>
          <div className="mt-3 text-xs text-slate-500">No issues</div>
        </Link>
        <Link href="#warning" className="rounded-xl border border-amber-500/20 p-5 transition-colors hover:border-amber-500/40" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10"><HelpCircle className="h-5 w-5 text-amber-400" /></div>
            <div><div className="text-2xl font-bold text-amber-400">{warning.length}</div><div className="text-xs text-slate-500">Warning</div></div>
          </div>
          <div className="mt-3 text-xs text-slate-500">Some overdue items</div>
        </Link>
        <Link href="#attention" className="rounded-xl border border-orange-500/20 p-5 transition-colors hover:border-orange-500/40" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10"><AlertTriangle className="h-5 w-5 text-orange-400" /></div>
            <div><div className="text-2xl font-bold text-orange-400">{attention.length}</div><div className="text-xs text-slate-500">Attention</div></div>
          </div>
          <div className="mt-3 text-xs text-slate-500">Multiple overdue items</div>
        </Link>
        <Link href="#critical" className="rounded-xl border border-red-500/20 p-5 transition-colors hover:border-red-500/40" style={{ backgroundColor: '#0B1121' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10"><AlertOctagon className="h-5 w-5 text-red-400" /></div>
            <div><div className="text-2xl font-bold text-red-400">{critical.length}</div><div className="text-xs text-slate-500">Critical</div></div>
          </div>
          <div className="mt-3 text-xs text-slate-500">High overdue, no activity</div>
        </Link>
      </div>

      <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
        <h2 className="text-sm font-semibold text-white">Health Score Factors</h2>
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
            <div key={factor.label} className="flex items-center justify-between rounded-lg border border-[#1E293B] px-4 py-3" style={{ backgroundColor: '#060B18' }}>
              <span className="text-sm text-slate-400">{factor.label}</span>
              <span className="text-sm font-medium text-emerald-400">{factor.weight}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="border-b border-[#1E293B] px-6 py-4">
          <h2 className="text-sm font-semibold text-white">Association Health Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
                <th className="px-6 py-3 text-left font-medium">Association</th>
                <th className="px-6 py-3 text-left font-medium">Location</th>
                <th className="px-6 py-3 text-right font-medium">Units</th>
                <th className="px-6 py-3 text-right font-medium">Open WO</th>
                <th className="px-6 py-3 text-right font-medium">Overdue WO</th>
                <th className="px-6 py-3 text-right font-medium">Violations</th>
                <th className="px-6 py-3 text-right font-medium">Score</th>
                <th className="px-6 py-3 text-center font-medium">Status</th>
                <th className="px-6 py-3 text-center font-medium">Mgr Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {healthRows.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-500">No associations found.</td></tr>
              ) : (
                healthRows.sort((a: any, b: any) => { const order: Record<string, number> = { critical: 0, attention: 1, warning: 2, healthy: 3 }; return order[a.status] - order[b.status] })
                  .map((row: any) => (
                    <tr key={row.id} id={row.status} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-3">
                        <Link href={`/associations/${row.id}`} className="font-medium text-slate-200 hover:text-emerald-400">{row.name}</Link>
                      </td>
                      <td className="px-6 py-3 text-slate-400">{[row.city, row.state].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-slate-400">{row.unitCount}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{row.openWorkOrders > 0 ? <span className="text-amber-400">{row.openWorkOrders}</span> : <span className="text-emerald-400">0</span>}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{row.overdueWorkOrders > 0 ? <span className="text-red-400">{row.overdueWorkOrders}</span> : <span className="text-emerald-400">0</span>}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{row.openViolations > 0 ? <span className="text-red-400">{row.openViolations}</span> : <span className="text-emerald-400">0</span>}</td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        <span className={row.score >= 80 ? 'text-emerald-400' : row.score >= 50 ? 'text-amber-400' : 'text-red-400'}>{row.score}%</span>
                      </td>
                      <td className="px-6 py-3 text-center"><HealthBadge status={row.status} /></td>
                      <td className="px-6 py-3 text-center">
                        {row.managerActive ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-400" /> : <AlertTriangle className="mx-auto h-4 w-4 text-amber-400" />}
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
