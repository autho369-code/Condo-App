import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { date, money } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const ACTIVE_STATUSES = ['board_review', 'approved', 'active', 'on_hold']

export default async function BoardProjectsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  // Capital projects (RLS capital_projects_board_read: the board's own
  // associations, past the internal planning stage). This page used to search
  // work-order titles for "project", so it was always empty.
  const { data: projects } = ids.length
    ? await db
        .from('capital_projects')
        .select('id, name, description, status, priority, start_date, target_end_date, completed_at, budget_amount, approved_budget_amount, board_approval_required, board_approved_at, associations(name)')
        .in('association_id', ids)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(200)
    : { data: [] }

  const all = (projects ?? []) as any[]
  const active = all.filter((p) => ACTIVE_STATUSES.includes(p.status))
  const completed = all.filter((p) => p.status === 'completed')
  const awaitingBoard = all.filter((p) => p.status === 'board_review' || (p.board_approval_required && !p.board_approved_at && p.status !== 'cancelled'))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Projects</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Association capital projects and major repairs</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active Projects', value: active.length },
          { label: 'Awaiting board', value: awaitingBoard.length },
          { label: 'Completed', value: completed.length },
          { label: 'Total', value: all.length },
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
              <th className="px-4 py-2.5 text-center font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Budget</th>
              <th className="px-4 py-2.5 text-right font-medium">Timeline</th>
            </tr>
          </thead>
          <tbody>
            {all.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500">No capital projects have been shared with the board yet.</td></tr>
            ) : (
              all.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {p.associations?.name ?? 'Association'} · <span className="capitalize">{p.priority ?? 'standard'}</span> priority
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center"><Badge status={p.status} /></td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-700">
                    {money(p.approved_budget_amount ?? p.budget_amount ?? 0)}
                    {p.approved_budget_amount != null && <div className="text-[11px] text-gray-400">approved</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-700">
                    {p.completed_at ? `Done ${date(p.completed_at)}` : p.target_end_date ? `Target ${date(p.target_end_date)}` : p.start_date ? `Starts ${date(p.start_date)}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
