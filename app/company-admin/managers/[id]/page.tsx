import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { ArrowLeft, Activity, CheckCircle2, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-300 text-right">{value}</span>
    </div>
  )
}

export default async function ManagerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const { id } = await params
  const today = new Date().toISOString().slice(0, 10)

  const { data: manager } = await db
    .from('profiles')
    .select('id, full_name, email, hoa_role, last_login_at, created_at')
    .eq('id', id)
    .eq('portfolio_id', portfolioId)
    .maybeSingle()

  if (!manager) notFound()

  const { data: assocManagers } = await db
    .from('association_managers')
    .select(`association_id, assigned_at, associations:association_id(id, name, unit_count, city, state)`)
    .eq('user_id', id)
    .is('ended_at', null)

  const assignedAssocs = (assocManagers ?? []).map((am: any) => ({
    id: am.associations?.id,
    name: am.associations?.name ?? 'Unknown',
    unitCount: am.associations?.unit_count ?? 0,
    city: am.associations?.city,
    state: am.associations?.state,
    assignedAt: am.assigned_at,
  }))

  const assocIds = assignedAssocs.map((a: any) => a.id)

  const { data: allWorkOrders } = await db
    .from('work_orders')
    .select('id, status, scheduled_date')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .eq('assignee_id', id)

  const openWorkOrders = (allWorkOrders ?? []).filter((wo: any) => !['completed', 'closed', 'cancelled'].includes(wo.status))
  const overdueWorkOrders = openWorkOrders.filter((wo: any) => wo.scheduled_date && wo.scheduled_date < today)

  let openViolations = 0
  if (assocIds.length > 0) {
    const { count } = await db
      .from('violations')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .not('status', 'in', '("closed","cured")')
      .in('association_id', assocIds)
    openViolations = count ?? 0
  }

  const { data: recentActivity } = await db
    .from('activity')
    .select('action, details, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(15)

  const totalDoorsManaged = assignedAssocs.reduce((sum: number, a: any) => sum + a.unitCount, 0)
  const workloadRatio = openWorkOrders.length > 0 ? Math.round((1 - overdueWorkOrders.length / openWorkOrders.length) * 100) : 100

  return (
    <div className="space-y-6">
      <Link href="/company-admin/managers" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to Managers
      </Link>

      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="border-b border-[#1E293B] px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/10 text-xl font-bold text-emerald-400">
              {(manager.full_name ?? manager.email ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{manager.full_name ?? manager.email}</h1>
              <div className="mt-1 text-sm text-slate-400 capitalize">{(manager.hoa_role ?? 'manager').replace('_', ' ')}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-0 divide-y divide-[#1E293B] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-6">
            <div className="text-xs font-semibold uppercase text-slate-500">Contact</div>
            <div className="mt-3 space-y-1">
              <InfoRow label="Email" value={manager.email ?? '—'} />
              <InfoRow label="Last Login" value={date(manager.last_login_at)} />
              <InfoRow label="Joined" value={date(manager.created_at)} />
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs font-semibold uppercase text-slate-500">Workload</div>
            <div className="mt-3 space-y-1">
              <InfoRow label="Associations" value={assignedAssocs.length} />
              <InfoRow label="Doors Managed" value={totalDoorsManaged.toLocaleString()} />
              <InfoRow label="Open Work Orders" value={<span className={openWorkOrders.length > 0 ? 'text-amber-400' : 'text-emerald-400'}>{openWorkOrders.length}</span>} />
              <InfoRow label="Overdue WO" value={<span className={overdueWorkOrders.length > 0 ? 'text-red-400' : 'text-emerald-400'}>{overdueWorkOrders.length}</span>} />
              <InfoRow label="Open Violations" value={<span className={openViolations > 0 ? 'text-red-400' : 'text-emerald-400'}>{openViolations}</span>} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1E293B] p-6" style={{ backgroundColor: '#0B1121' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Workload Score</div>
            <div className="mt-1 text-lg text-slate-400">
              {openWorkOrders.length > 0 ? `${overdueWorkOrders.length} overdue / ${openWorkOrders.length} open` : 'No open work orders'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#1E293B" strokeWidth="6" />
                <circle cx="32" cy="32" r="28" fill="none" stroke={workloadRatio >= 80 ? '#10B981' : workloadRatio >= 50 ? '#F59E0B' : '#EF4444'} strokeWidth="6" strokeDasharray={`${(workloadRatio / 100) * 176} 176`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-white">{workloadRatio}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="border-b border-[#1E293B] px-6 py-4">
          <h2 className="text-sm font-semibold text-white">Associations Assigned</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
                <th className="px-6 py-3 text-left font-medium">Association</th>
                <th className="px-6 py-3 text-right font-medium">Units</th>
                <th className="px-6 py-3 text-left font-medium">Location</th>
                <th className="px-6 py-3 text-left font-medium">Assigned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {assignedAssocs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No associations assigned.</td></tr>
              ) : (
                assignedAssocs.map((assoc: any) => (
                  <tr key={assoc.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3">
                      <Link href={`/associations/${assoc.id}`} className="font-medium text-slate-200 hover:text-emerald-400">{assoc.name}</Link>
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums text-slate-400">{assoc.unitCount}</td>
                    <td className="px-6 py-3 text-slate-400">{[assoc.city, assoc.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-6 py-3 text-slate-400">{date(assoc.assignedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <div className="border-b border-[#1E293B] px-6 py-4">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
        </div>
        <div className="divide-y divide-[#1E293B]">
          {(recentActivity ?? []).length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">No recent activity recorded.</div>
          ) : (
            (recentActivity ?? []).map((act: any, i: number) => (
              <div key={i} className="flex items-start gap-3 px-6 py-3">
                <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-300">{act.action}</div>
                  {act.details && <div className="mt-0.5 text-xs text-slate-500">{act.details}</div>}
                </div>
                <div className="flex-shrink-0 text-xs text-slate-600">{date(act.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
