import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { StatusChip } from '@/components/operations/status-chip'
import { Trophy, Timer, Wrench, AlertTriangle, ClipboardCheck, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
const OPEN_WO_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress']
const DONE_WO_STATUSES = ['done', 'completed', 'billed', 'closed']

type ManagerPerf = {
  id: string
  name: string
  email: string
  properties: number
  doors: number
  openRequests: number
  overdue: number
  closed90d: number
  avgResolutionDays: number | null
  emergencyAvgDays: number | null
  openViolations: number
  inspectionsDone: number
  inspectionsTotal: number
  performance: number
}

export default async function ManagerPerformancePage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 86400000).toISOString()

  const [
    { data: managers },
    { data: assocManagers },
    { data: assocs },
    { data: openWOs },
    { data: doneWOs },
    { data: viols },
    { data: inspections },
  ] = await Promise.all([
    db.from('profiles').select('id, full_name, email').eq('portfolio_id', portfolioId).in('hoa_role', ['manager', 'company_admin']),
    db.from('association_managers').select('user_id, association_id').is('ended_at', null),
    db.from('associations').select('id, unit_count').eq('portfolio_id', portfolioId).is('archived_at', null),
    db.from('work_orders').select('association_id, assignee_id, scheduled_date, priority').eq('portfolio_id', portfolioId).is('archived_at', null).in('status', OPEN_WO_STATUSES),
    db.from('work_orders').select('association_id, assignee_id, created_at, completed_date, priority').eq('portfolio_id', portfolioId).is('archived_at', null).in('status', DONE_WO_STATUSES).gte('created_at', ninetyDaysAgo),
    db.from('violations').select('association_id').is('archived_at', null).not('status', 'in', '("closed","cured","violation_dismissed")'),
    db.from('inspections').select('association_id, status, completed_date').eq('portfolio_id', portfolioId).is('archived_at', null),
  ])

  const unitCountByAssoc = new Map<string, number>((assocs ?? []).map((a: any) => [a.id, a.unit_count ?? 0]))
  const assocsByManager = new Map<string, Set<string>>()
  for (const am of assocManagers ?? []) {
    if (!assocsByManager.has(am.user_id)) assocsByManager.set(am.user_id, new Set())
    assocsByManager.get(am.user_id)!.add(am.association_id)
  }

  const resolutionDays = (createdAt: string, completedDate: string) => {
    const ms = new Date(completedDate).getTime() - new Date(createdAt).getTime()
    return Math.max(0, ms / 86400000)
  }

  const perfs: ManagerPerf[] = (managers ?? []).map((mgr: any) => {
    const myAssocs = assocsByManager.get(mgr.id) ?? new Set<string>()
    // A work order counts toward a manager if directly assigned to them, or
    // if it belongs to one of their assigned associations.
    const mine = (wo: any) => wo.assignee_id === mgr.id || myAssocs.has(wo.association_id)

    const open = (openWOs ?? []).filter(mine)
    const done = (doneWOs ?? []).filter(mine)
    const overdue = open.filter((wo: any) => wo.scheduled_date && wo.scheduled_date < todayDate).length

    const resolved = done.filter((wo: any) => wo.completed_date)
    const avgResolutionDays = resolved.length > 0
      ? resolved.reduce((s: number, wo: any) => s + resolutionDays(wo.created_at, wo.completed_date), 0) / resolved.length
      : null
    const emergenciesResolved = resolved.filter((wo: any) => wo.priority === 'emergency')
    const emergencyAvgDays = emergenciesResolved.length > 0
      ? emergenciesResolved.reduce((s: number, wo: any) => s + resolutionDays(wo.created_at, wo.completed_date), 0) / emergenciesResolved.length
      : null

    const openViolations = (viols ?? []).filter((v: any) => myAssocs.has(v.association_id)).length
    const myInspections = (inspections ?? []).filter((i: any) => myAssocs.has(i.association_id))
    const inspectionsDone = myInspections.filter((i: any) => i.completed_date || i.status === 'completed').length

    // Deterministic performance score from live operations data:
    // start at 100, deduct for overdue work, slow resolution, and open violations.
    const performance = Math.max(5, Math.min(100, Math.round(
      100
      - overdue * 8
      - (avgResolutionDays !== null ? Math.max(0, avgResolutionDays - 7) * 3 : 0)
      - openViolations * 4,
    )))

    return {
      id: mgr.id,
      name: mgr.full_name ?? mgr.email ?? 'Unknown',
      email: mgr.email ?? '—',
      properties: myAssocs.size,
      doors: [...myAssocs].reduce((s, aid) => s + (unitCountByAssoc.get(aid) ?? 0), 0),
      openRequests: open.length,
      overdue,
      closed90d: done.length,
      avgResolutionDays,
      emergencyAvgDays,
      openViolations,
      inspectionsDone,
      inspectionsTotal: myInspections.length,
      performance,
    }
  })

  const fmtDays = (d: number | null) =>
    d === null ? '—' : d < 1 ? `${Math.round(d * 24)}h` : `${d.toFixed(1)}d`

  const withResolution = perfs.filter((p) => p.avgResolutionDays !== null)
  const rankings: { label: string; icon: React.ElementType; entries: { name: string; value: string }[] }[] = [
    {
      label: 'Fastest Avg Resolution',
      icon: Timer,
      entries: [...withResolution].sort((a, b) => (a.avgResolutionDays! - b.avgResolutionDays!)).slice(0, 3)
        .map((p) => ({ name: p.name, value: fmtDays(p.avgResolutionDays) })),
    },
    {
      label: 'Most Closed (90 days)',
      icon: Wrench,
      entries: [...perfs].sort((a, b) => b.closed90d - a.closed90d).slice(0, 3)
        .map((p) => ({ name: p.name, value: String(p.closed90d) })),
    },
    {
      label: 'Fewest Open Violations',
      icon: AlertTriangle,
      entries: [...perfs].sort((a, b) => a.openViolations - b.openViolations).slice(0, 3)
        .map((p) => ({ name: p.name, value: String(p.openViolations) })),
    },
    {
      label: 'Inspection Completion',
      icon: ClipboardCheck,
      entries: [...perfs].filter((p) => p.inspectionsTotal > 0)
        .sort((a, b) => (b.inspectionsDone / b.inspectionsTotal) - (a.inspectionsDone / a.inspectionsTotal)).slice(0, 3)
        .map((p) => ({ name: p.name, value: `${Math.round((p.inspectionsDone / p.inspectionsTotal) * 100)}%` })),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Manager Performance</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Response times, throughput, and workload — computed live from work orders, violations, and inspections
        </p>
      </div>

      {/* ── Manager cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {perfs.length === 0 ? (
          <div className={`${card} col-span-full px-5 py-10 text-center text-sm text-gray-500`}>No managers found in your portfolio.</div>
        ) : (
          perfs.map((p) => (
            <div key={p.id} className={`${card} p-5`}>
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/company-admin/managers/${p.id}`} className="text-[15px] font-semibold text-gray-950 hover:underline">{p.name}</Link>
                  <div className="mt-0.5 text-xs text-gray-500">{p.email}</div>
                </div>
                <StatusChip tone={p.performance >= 80 ? 'success' : p.performance >= 50 ? 'warning' : 'danger'}>
                  {p.performance}%
                </StatusChip>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Properties</dt><dd className="mt-0.5 font-semibold tabular-nums text-gray-950">{p.properties}</dd></div>
                <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Units</dt><dd className="mt-0.5 font-semibold tabular-nums text-gray-950">{p.doors.toLocaleString()}</dd></div>
                <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Open Requests</dt><dd className={`mt-0.5 font-semibold tabular-nums ${p.openRequests > 0 ? 'text-amber-700' : 'text-gray-950'}`}>{p.openRequests}</dd></div>
                <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Avg Resolution</dt><dd className="mt-0.5 font-semibold tabular-nums text-gray-950">{fmtDays(p.avgResolutionDays)}</dd></div>
                <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Closed (90d)</dt><dd className="mt-0.5 font-semibold tabular-nums text-gray-950">{p.closed90d}</dd></div>
                <div><dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Overdue</dt><dd className={`mt-0.5 font-semibold tabular-nums ${p.overdue > 0 ? 'text-red-700' : 'text-gray-950'}`}>{p.overdue}</dd></div>
              </dl>
            </div>
          ))
        )}
      </div>

      {/* ── Rankings ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {rankings.map((r) => {
          const Icon = r.icon
          return (
            <div key={r.label} className={`${card} p-5`}>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4 w-4 text-gray-400" />
                </div>
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{r.label}</div>
              </div>
              <ol className="mt-4 space-y-2.5">
                {r.entries.length === 0 ? (
                  <li className="text-sm text-gray-400">Not enough data yet</li>
                ) : (
                  r.entries.map((e, i) => (
                    <li key={e.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-700">
                        {i === 0 ? <Trophy className="h-3.5 w-3.5 text-amber-500" /> : <span className="w-3.5 text-center text-xs text-gray-400">{i + 1}</span>}
                        {e.name}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-950">{e.value}</span>
                    </li>
                  ))
                )}
              </ol>
            </div>
          )
        })}
      </div>

      {/* ── Full table ────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">All Managers</h2>
            <p className="mt-0.5 text-xs text-gray-500">Complete performance detail — resolution times use the last 90 days of completed work</p>
          </div>
          <Link href="/company-admin/managers" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline">
            Manage team <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Manager</th>
                <th className="px-4 py-2.5 text-right font-medium">Properties</th>
                <th className="px-4 py-2.5 text-right font-medium">Units</th>
                <th className="px-4 py-2.5 text-right font-medium">Open</th>
                <th className="px-4 py-2.5 text-right font-medium">Overdue</th>
                <th className="px-4 py-2.5 text-right font-medium">Closed 90d</th>
                <th className="px-4 py-2.5 text-right font-medium">Avg Resolution</th>
                <th className="px-4 py-2.5 text-right font-medium">Emergency Avg</th>
                <th className="px-4 py-2.5 text-right font-medium">Violations</th>
                <th className="px-4 py-2.5 text-right font-medium">Inspections</th>
                <th className="px-4 py-2.5 text-right font-medium">Performance</th>
              </tr>
            </thead>
            <tbody>
              {perfs.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-500">No managers found.</td></tr>
              ) : (
                [...perfs].sort((a, b) => b.performance - a.performance).map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/company-admin/managers/${p.id}`} className="font-medium text-gray-900 hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{p.properties}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{p.doors.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{p.openRequests}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${p.overdue > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{p.overdue}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{p.closed90d}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtDays(p.avgResolutionDays)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtDays(p.emergencyAvgDays)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${p.openViolations > 0 ? 'font-medium text-red-700' : 'text-gray-700'}`}>{p.openViolations}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{p.inspectionsTotal > 0 ? `${p.inspectionsDone}/${p.inspectionsTotal}` : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold tabular-nums ${p.performance >= 80 ? 'text-emerald-700' : p.performance >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{p.performance}%</span>
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
