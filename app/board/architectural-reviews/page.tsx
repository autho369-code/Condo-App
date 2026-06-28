import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { StatusChip, type Tone } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const OPEN_STATUSES = ['submitted', 'under_review', 'more_info']
const STATUS_TONE: Record<string, Tone> = {
  submitted: 'info', under_review: 'warning', more_info: 'warning',
  approved: 'success', denied: 'danger', withdrawn: 'neutral',
}
const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default async function BoardArchitecturalReviewsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  const { data: reviews } = await db
    .from('architectural_requests')
    .select('id, title, status, category, created_at, units(unit_number), owners(full_name)')
    .in('association_id', ids)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (reviews ?? []) as any[]
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status))
  const approved = rows.filter((r) => r.status === 'approved')
  const denied = rows.filter((r) => r.status === 'denied')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Architectural Reviews</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Homeowner modification requests for your association. Open a request to discuss with management and the homeowner.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Open', value: open.length },
          { label: 'Approved', value: approved.length },
          { label: 'Denied', value: denied.length },
        ].map((s) => (
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
              <th className="px-4 py-2.5 text-left font-medium">Unit</th>
              <th className="px-4 py-2.5 text-left font-medium">Homeowner</th>
              <th className="px-4 py-2.5 text-left font-medium">Request</th>
              <th className="px-4 py-2.5 text-center font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">No architectural review requests found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-[13px] text-gray-700">{r.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{r.owners?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/board/architectural-reviews/${r.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{r.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-center"><StatusChip tone={STATUS_TONE[r.status] ?? 'neutral'}>{label(r.status)}</StatusChip></td>
                  <td className="px-4 py-3 text-right text-[13px] tabular-nums text-gray-700">{date(r.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
