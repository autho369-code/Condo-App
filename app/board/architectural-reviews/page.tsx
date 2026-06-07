import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { ClipboardCheck } from 'lucide-react'
import { date } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function BoardArchitecturalReviewsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  const { data: reviews } = await db
    .from('violations')
    .select('id, unit_id, owner_id, title, violation_type, status, created_at, updated_at, association_id, units!inner(unit_number), owners!inner(full_name)')
    .in('association_id', ids)
    .is('archived_at', null)
    .or('violation_type.ilike.%architect%,title.ilike.%architect%,title.ilike.%reno%,title.ilike.%modif%')
    .order('created_at', { ascending: false })
    .limit(100)

  const open = (reviews ?? []).filter((r: any) => !['closed','cured','dismissed'].includes(r.status))
  const approved = (reviews ?? []).filter((r: any) => r.status === 'cured' || r.status === 'approved')
  const denied = (reviews ?? []).filter((r: any) => r.status === 'dismissed' || r.status === 'denied')

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { open: 'bg-amber-500/10 text-amber-400 border-amber-500/20', closed: 'bg-slate-500/10 text-slate-400 border-slate-500/20', cured: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dismissed: 'bg-red-500/10 text-red-400 border-red-500/20', under_review: 'bg-blue-500/10 text-blue-400 border-blue-500/20', pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    return map[s] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Architectural Reviews</h1>
        <p className="mt-1 text-sm text-slate-400">Architectural modification requests for your association</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Open', value: open.length, cls: 'text-amber-400' },
          { label: 'Approved', value: approved.length, cls: 'text-emerald-400' },
          { label: 'Denied', value: denied.length, cls: 'text-red-400' },
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
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-left font-medium">Request</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {(reviews ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No architectural review requests found.</td></tr>
            ) : (
              (reviews ?? []).map((r: any) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-300">{r.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{r.owners?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/board/violations/${r.id}`} className="font-medium text-slate-200 hover:text-emerald-400">{r.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(r.status)}`}>{r.status.replace('_',' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{date(r.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
