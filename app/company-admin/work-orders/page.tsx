import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
import { Wrench, Clock, AlertOctagon, ArrowUp, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

const priorityTone = (p: string | null): Tone => {
  const m: Record<string, Tone> = { emergency: 'danger', high: 'warning', medium: 'warning', low: 'info' }
  return m[p?.toLowerCase() ?? ''] ?? 'neutral'
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

  const selectCls = 'mt-1 block h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Work Orders Oversight</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Monitor all work orders across your portfolio</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Open', value: openCount, icon: Wrench },
          { label: 'Overdue', value: overdueCount, icon: Clock },
          { label: 'Emergency', value: emergencyCount, icon: AlertOctagon },
          { label: 'High Priority', value: highCount, icon: ArrowUp },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                  <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{item.value}</div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <form action="/company-admin/work-orders" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <label className="text-xs font-medium text-gray-500">
          Association
          <select name="association" defaultValue={sp.association ?? ''} className={selectCls}>
            <option value="">All Associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Priority
          <select name="priority" defaultValue={sp.priority ?? ''} className={selectCls}>
            <option value="">All</option>
            <option value="emergency">Emergency</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Status
          <select name="status" defaultValue={sp.status ?? ''} className={selectCls}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition hover:bg-gray-800">Apply</button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">#</th>
              <th className="px-4 py-2.5 text-left font-medium">Association</th>
              <th className="px-4 py-2.5 text-left font-medium">Title</th>
              <th className="px-4 py-2.5 text-left font-medium">Priority</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">Created</th>
              <th className="px-4 py-2.5 text-right font-medium">Days Open</th>
              <th className="px-4 py-2.5 text-left font-medium">Overdue</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(workOrders ?? []).length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">No work orders found.</td></tr>
            ) : (
              (workOrders ?? []).map((wo: any) => {
                const isOverdue = wo.scheduled_date && wo.scheduled_date < today && !['completed', 'closed', 'cancelled'].includes(wo.status?.toLowerCase())
                const assocName = wo.associations?.name ?? '—'
                return (
                  <tr key={wo.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-500">{wo.number ?? `WO-${wo.id?.slice(0, 8)}`}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{assocName}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{wo.title ?? 'Untitled'}</div>
                      {wo.category && <div className="mt-0.5 text-xs capitalize text-gray-500">{wo.category}</div>}
                    </td>
                    <td className="px-4 py-3"><StatusChip tone={priorityTone(wo.priority)}>{wo.priority ?? '—'}</StatusChip></td>
                    <td className="px-4 py-3"><Badge status={wo.status ?? '—'} /></td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{date(wo.created_at)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${daysOpen(wo.created_at) > 30 ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                      {daysOpen(wo.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {isOverdue ? (
                        <StatusChip tone="danger">Overdue</StatusChip>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/work-orders/${wo.id}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-950" title="View">
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

      <div className="text-xs text-gray-500">
        Showing {(workOrders ?? []).length} of {wos.length} work orders
        {sp.association && ` for selected association`}
        {sp.priority && ` • Priority: ${sp.priority}`}
        {sp.status && ` • Status: ${sp.status}`}
      </div>
    </div>
  )
}
