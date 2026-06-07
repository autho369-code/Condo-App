import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { Wrench, Clock, AlertOctagon, ArrowUp, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

function PriorityBadge({ priority }: { priority: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    emergency: { label: 'Emergency', cls: 'bg-red-500/10 text-red-400 ring-red-500/20' },
    high: { label: 'High', cls: 'bg-orange-500/10 text-orange-400 ring-orange-500/20' },
    medium: { label: 'Medium', cls: 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20' },
    low: { label: 'Low', cls: 'bg-blue-500/10 text-blue-400 ring-blue-500/20' },
  }
  const p = priority?.toLowerCase() ?? ''
  const { label, cls } = map[p] ?? { label: priority ?? '—', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' }
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${cls}`}>{label}</span>
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-blue-500/10 text-blue-400 ring-blue-500/20' },
    in_progress: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
    pending: { label: 'Pending', cls: 'bg-violet-500/10 text-violet-400 ring-violet-500/20' },
    completed: { label: 'Completed', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
    closed: { label: 'Closed', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' },
  }
  const s = status?.toLowerCase() ?? ''
  const { label, cls } = map[s] ?? { label: status ?? '—', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' }
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${cls}`}>{label}</span>
}

function daysOpen(createdAt: string | null): number {
  if (!createdAt) return 0
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

export default async function WorkOrdersOversightPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; priority?: string; status?: string }>
}) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const sp = await searchParams
  const today = new Date().toISOString().slice(0, 10)

  // Base query for work orders with associations
  let query = db
    .from('work_orders')
    .select(`id, number, title, category, priority, status, scheduled_date, completed_date, created_at, association_id, unit_id, vendor_id, assigned_to, associations!work_orders_association_id_fkey(name)`)
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  // Fetch all for stats
  const { data: allWOs } = await db
    .from('work_orders')
    .select('id, priority, status, scheduled_date, created_at')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)

  const wos = allWOs ?? []
  const openCount = wos.filter((wo: any) => !['completed', 'closed', 'cancelled'].includes(wo.status?.toLowerCase())).length
  const overdueCount = wos.filter((wo: any) => {
    if (['completed', 'closed', 'cancelled'].includes(wo.status?.toLowerCase())) return false
    return wo.scheduled_date && wo.scheduled_date < today
  }).length
  const emergencyCount = wos.filter((wo: any) => wo.priority?.toLowerCase() === 'emergency').length
  const highCount = wos.filter((wo: any) => wo.priority?.toLowerCase() === 'high').length

  // Fetch associations for filter
  const { data: associations } = await db
    .from('associations')
    .select('id, name')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name')

  // Apply filters
  if (sp.association) query = query.eq('association_id', sp.association)
  if (sp.priority) query = query.eq('priority', sp.priority.toLowerCase())
  if (sp.status) query = query.eq('status', sp.status.toLowerCase())

  const { data: workOrders } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Work Orders Oversight</h1>
          <p className="mt-1 text-sm text-slate-400">Monitor all work orders across your portfolio</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Open', value: openCount, icon: Wrench, accent: 'emerald' },
          { label: 'Overdue', value: overdueCount, icon: Clock, accent: overdueCount > 0 ? 'red' : 'emerald' },
          { label: 'Emergency', value: emergencyCount, icon: AlertOctagon, accent: emergencyCount > 0 ? 'red' : 'emerald' },
          { label: 'High Priority', value: highCount, icon: ArrowUp, accent: highCount > 0 ? 'orange' : 'emerald' },
        ].map((item) => {
          const accents: Record<string, string> = {
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            red: 'bg-red-500/10 text-red-400 border-red-500/20',
            orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          }
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-white">{item.value}</div>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[item.accent]}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <form action="/company-admin/work-orders" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
        <label className="text-xs font-medium uppercase text-slate-500">
          Association
          <select name="association" defaultValue={sp.association ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All Associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium uppercase text-slate-500">
          Priority
          <select name="priority" defaultValue={sp.priority ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All</option>
            <option value="emergency">Emergency</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="text-xs font-medium uppercase text-slate-500">
          Status
          <select name="status" defaultValue={sp.status ?? ''} className="mt-1 block h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">Apply</button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">Association</th>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Days Open</th>
              <th className="px-4 py-3 text-left font-medium">Overdue</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {(workOrders ?? []).length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No work orders found.</td></tr>
            ) : (
              (workOrders ?? []).map((wo: any) => {
                const isOverdue = wo.scheduled_date && wo.scheduled_date < today && !['completed', 'closed', 'cancelled'].includes(wo.status?.toLowerCase())
                const assocName = wo.associations?.name ?? '—'
                return (
                  <tr key={wo.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{wo.number ?? `WO-${wo.id?.slice(0, 8)}`}</td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300">{assocName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{wo.title ?? 'Untitled'}</div>
                      {wo.category && <div className="mt-0.5 text-xs text-slate-500">{wo.category}</div>}
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={wo.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={wo.status} /></td>
                    <td className="px-4 py-3 text-slate-400">{date(wo.created_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={daysOpen(wo.created_at) > 30 ? 'text-red-400' : 'text-slate-300'}>
                        {daysOpen(wo.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isOverdue ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-red-500/10 px-2.5 text-xs font-medium text-red-400 ring-1 ring-red-500/20">Overdue</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/work-orders/${wo.id}`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="View">
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-600">
        Showing {(workOrders ?? []).length} of {wos.length} work orders
        {sp.association && ` for selected association`}
        {sp.priority && ` • Priority: ${sp.priority}`}
        {sp.status && ` • Status: ${sp.status}`}
      </div>
    </div>
  )
}
