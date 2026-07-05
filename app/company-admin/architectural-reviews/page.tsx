import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { date } from '@/lib/utils'
import { ClipboardCheck, Clock, CheckCircle, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PENDING_STATUSES = ['submitted', 'under_review', 'more_info']

const CATEGORY_LABEL: Record<string, string> = {
  exterior_paint: 'Exterior paint', fence: 'Fence', landscaping: 'Landscaping',
  roof: 'Roof', addition: 'Addition', deck_patio: 'Deck / patio',
  windows_doors: 'Windows / doors', solar: 'Solar', pool: 'Pool', other: 'Other',
}

export default async function ArchitecturalReviewsOversightPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id

  const { data: rows } = await db
    .from('architectural_requests')
    .select('id, title, category, status, created_at, decided_at, association_id, unit_id, owner_id, associations(name), units(unit_number), owners(full_name)')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })
    .limit(500)

  const requests = (rows ?? []) as any[]

  const pendingCount = requests.filter((r) => PENDING_STATUSES.includes(r.status)).length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const deniedCount = requests.filter((r) => r.status === 'denied').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Architectural Reviews</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Track architectural modification requests across your portfolio</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Pending', value: pendingCount, icon: Clock },
          { label: 'Approved', value: approvedCount, icon: CheckCircle },
          { label: 'Denied', value: deniedCount, icon: XCircle },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{item.label}</div>
                  <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{item.value}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                  <Icon className="h-4.5 w-4.5 text-gray-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Request</th>
              <th className="px-4 py-2.5 text-left font-medium">Type</th>
              <th className="px-4 py-2.5 text-left font-medium">Association</th>
              <th className="px-4 py-2.5 text-left font-medium">Unit</th>
              <th className="px-4 py-2.5 text-left font-medium">Homeowner</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                  No architectural requests yet. Homeowner submissions from the owner portal appear here for portfolio-wide oversight.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="max-w-xs px-4 py-3 font-medium text-gray-900">{r.title}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{CATEGORY_LABEL[r.category] ?? 'Other'}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{r.associations?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{r.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{r.owners?.full_name ?? '—'}</td>
                  <td className="px-4 py-3"><Badge status={r.status ?? '—'} /></td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{date(r.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>Showing {requests.length} request{requests.length === 1 ? '' : 's'} across all associations</span>
      </div>
    </div>
  )
}
