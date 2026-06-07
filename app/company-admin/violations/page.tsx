import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { date, money } from '@/lib/utils'
import { AlertTriangle, Calendar, FileText, DollarSign, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-blue-500/10 text-blue-400 ring-blue-500/20' },
    pending: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
    notice_sent: { label: 'Notice Sent', cls: 'bg-violet-500/10 text-violet-400 ring-violet-500/20' },
    hearing_scheduled: { label: 'Hearing', cls: 'bg-orange-500/10 text-orange-400 ring-orange-500/20' },
    closed: { label: 'Closed', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' },
    cured: { label: 'Cured', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
    resolved: { label: 'Resolved', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
  }
  const s = status?.toLowerCase() ?? ''
  const { label, cls } = map[s] ?? { label: status ?? '—', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' }
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${cls}`}>{label}</span>
}

function daysOpen(createdAt: string | null): number {
  if (!createdAt) return 0
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

export default async function ViolationsOversightPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  // Fetch all violations with joins
  const { data: allViolations } = await db
    .from('violations')
    .select(`id, status, title, violation_type, date_observed, hearing_date, fine_amount, created_at, due_date, notice_sent_at, association_id, unit_id, owner_id, associations!violations_association_id_fkey(name), units!violations_unit_id_fkey(unit_number), owners!violations_owner_id_fkey(full_name)`)
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  const violations = allViolations ?? []

  // Stats
  const openCount = violations.filter((v: any) => !['closed', 'cured', 'resolved'].includes(v.status?.toLowerCase())).length
  const pendingHearingCount = violations.filter((v: any) => v.status?.toLowerCase() === 'hearing_scheduled').length
  const noticesThisMonth = violations.filter((v: any) => v.notice_sent_at && v.notice_sent_at >= firstOfMonth).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Violations Oversight</h1>
          <p className="mt-1 text-sm text-slate-400">Track all violations across your portfolio</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Open Violations', value: openCount, icon: AlertTriangle, accent: openCount > 0 ? 'red' : 'emerald' },
          { label: 'Pending Hearings', value: pendingHearingCount, icon: Calendar, accent: pendingHearingCount > 0 ? 'amber' : 'emerald' },
          { label: 'Notices This Month', value: noticesThisMonth, icon: FileText, accent: noticesThisMonth > 0 ? 'violet' : 'emerald' },
        ].map((item) => {
          const accents: Record<string, string> = {
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            red: 'bg-red-500/10 text-red-400 border-red-500/20',
            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
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

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Association</th>
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Date Observed</th>
              <th className="px-4 py-3 text-right font-medium">Days Open</th>
              <th className="px-4 py-3 text-left font-medium">Hearing</th>
              <th className="px-4 py-3 text-right font-medium">Fine</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {violations.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No violations found.</td></tr>
            ) : (
              violations.map((v: any) => (
                <tr key={v.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{v.associations?.name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{v.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{v.owners?.full_name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-400">{v.violation_type ?? v.title ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{date(v.date_observed)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={daysOpen(v.created_at) > 30 ? 'text-red-400' : 'text-slate-300'}>
                      {daysOpen(v.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{v.hearing_date ? date(v.hearing_date) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {v.fine_amount ? (
                      <span className="text-amber-400">{money(v.fine_amount)}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/violations/${v.id}`} className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300" title="View">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-600">Showing {violations.length} violations across all associations</div>
    </div>
  )
}
