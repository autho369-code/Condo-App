import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import Link from 'next/link'

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

  const active = (projects ?? []).filter((p: any) => !['completed','closed','cancelled'].includes(p.status))
  const completed = (projects ?? []).filter((p: any) => p.status === 'completed')

  const statusB = (s: string) => {
    const m: Record<string, string> = { open: 'bg-blue-500/10 text-blue-400 border-blue-500/20', in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20', completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20', cancelled: 'bg-red-500/10 text-red-400 border-red-500/20', pending: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
    return m[s] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        <p className="mt-1 text-sm text-slate-400">Association capital projects and major repairs</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Active Projects', value: active.length, cls: 'text-blue-400' },
          { label: 'Completed', value: completed.length, cls: 'text-emerald-400' },
          { label: 'Total', value: (projects ?? []).length, cls: 'text-white' },
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
              <th className="px-4 py-3 text-left font-medium">Project</th>
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {(projects ?? []).length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500">No projects found. Projects will appear here once created from work orders.</td></tr>
            ) : (
              (projects ?? []).map((p: any) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/work-orders/${p.id}`} className="font-medium text-slate-200 hover:text-emerald-400">{p.title}</Link>
                    <div className="mt-0.5 text-xs text-slate-600 capitalize">{p.category?.replace('_',' ') ?? 'Project'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{p.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusB(p.status)}`}>{p.status.replace('_',' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{date(p.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
