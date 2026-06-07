import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function BoardWorkOrdersPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  const { data: wos } = await db
    .from('work_orders')
    .select('id, title, category, priority, status, created_at, scheduled_date, vendor_id, units!inner(unit_number), vendors(name)')
    .in('association_id', ids)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const all = wos ?? []
  const open = all.filter((w: any) => !['completed','closed','cancelled'].includes(w.status))
  const inProgress = all.filter((w: any) => w.status === 'in_progress')
  const done = all.filter((w: any) => w.status === 'completed')
  const overdue = open.filter((w: any) => w.scheduled_date && new Date(w.scheduled_date) < new Date())

  const priorityBadge = (p: string) => {
    const m: Record<string, string> = { emergency: 'bg-red-500/10 text-red-400 border-red-500/20', high: 'bg-orange-500/10 text-orange-400 border-orange-500/20', medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20', low: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    return m[p] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
  const statusB = (s: string) => {
    const m: Record<string, string> = { open: 'bg-blue-500/10 text-blue-400 border-blue-500/20', in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20', completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', cancelled: 'bg-red-500/10 text-red-400 border-red-500/20' }
    return m[s] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Work Orders</h1>
        <p className="mt-1 text-sm text-slate-400">Maintenance and repair work across your association</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Open', value: open.length, cls: 'text-blue-400' },
          { label: 'In Progress', value: inProgress.length, cls: 'text-amber-400' },
          { label: 'Completed', value: done.length, cls: 'text-emerald-400' },
          { label: 'Overdue', value: overdue.length, cls: overdue.length > 0 ? 'text-red-400' : 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
            <div className="text-xs font-medium uppercase text-slate-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1E293B] overflow-hidden" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Work Order</th>
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-center font-medium">Priority</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Vendor</th>
              <th className="px-4 py-3 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {all.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No work orders found for your association.</td></tr>
            ) : (
              all.map((w: any) => (
                <tr key={w.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/work-orders/${w.id}`} className="font-medium text-slate-200 hover:text-emerald-400">{w.title}</Link>
                    <div className="mt-0.5 text-xs text-slate-600 capitalize">{w.category?.replace('_',' ') ?? 'General'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{w.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${priorityBadge(w.priority)}`}>{w.priority ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusB(w.status)}`}>{w.status.replace('_',' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{w.vendors?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{date(w.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
