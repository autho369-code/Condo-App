import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { date } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BoardProjectsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  const { data: projects } = await db
    .from('work_orders')
    .select('id, title, category, priority, status, created_at, scheduled_date, completed_date, units!inner(unit_number)')
    .in('association_id', ids)
    .is('archived_at', null)
    .or('category.eq.project,category.eq.major_repair,title.ilike.%project%')
    .order('created_at', { ascending: false })
    .limit(100)

  const active = (projects ?? []).filter((p: any) => !['completed', 'closed', 'cancelled'].includes(p.status))
  const completed = (projects ?? []).filter((p: any) => p.status === 'completed')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Projects</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Association capital projects and major repairs</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Active Projects', value: active.length },
          { label: 'Completed', value: completed.length },
          { label: 'Total', value: (projects ?? []).length },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Project</th>
              <th className="px-4 py-2.5 text-left font-medium">Unit</th>
              <th className="px-4 py-2.5 text-center font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">No projects found. Projects will appear here once created from work orders.</td></tr>
            ) : (
              (projects ?? []).map((p: any) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.title}</div>
                    <div className="mt-0.5 text-xs capitalize text-gray-500">{p.category?.replace('_', ' ') ?? 'Project'}</div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{p.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3 text-center"><Badge status={p.status} /></td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-700">{date(p.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
