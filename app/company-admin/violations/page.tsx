import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { Alert, Badge } from '@/components/ui/shell'
import { date, money } from '@/lib/utils'
import { AlertTriangle, Calendar, FileText, Eye } from 'lucide-react'
import { isHearingPendingViolationStatus, isOpenViolationStatus } from '@/lib/violations/queries'
import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned'
import { displayTimeZone } from '@/lib/time/display-zone'
import { collectLoadErrors } from '@/lib/company-admin/load-errors'

export const dynamic = 'force-dynamic'

function daysOpen(createdAt: string | null): number {
  if (!createdAt) return 0
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

export default async function ViolationsOversightPage() {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio?.id
  // Calendar dates are the company's zone (server code runs in UTC). notice_sent_at is a timestamp, so
  // compare against the instant the month began in that zone.
  const zone = displayTimeZone()
  const monthStartDate = `${todayInZone(zone).slice(0, 7)}-01`
  const firstOfMonth = (zonedWallTimeToUtc(monthStartDate, '00:00', zone) ?? new Date(`${monthStartDate}T00:00:00Z`)).toISOString()

  // violations has no portfolio_id column — scope by the portfolio's associations.
  const { data: assocRows, error: assocRowsError } = await db
    .from('associations')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
  const assocIds = (assocRows ?? []).map((a: any) => a.id)

  const { data: allViolations, error: allViolationsError } = assocIds.length
    ? await db
        .from('violations')
        .select(`id, status, title, violation_type, date_observed, hearing_date, fine_amount, created_at, due_date, notice_sent_at, association_id, unit_id, owner_id, associations!violations_association_id_fkey(name), units!violations_unit_id_fkey(unit_number), owners!violations_owner_id_fkey(full_name)`)
        .in('association_id', assocIds)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
    : { data: [] as any[], error: null }

  const violations = allViolations ?? []

  const loadErrors = collectLoadErrors({
    Associations: { error: assocRowsError },
    Violations: { error: allViolationsError },
  })

  // Stats
  const openCount = violations.filter((v: any) => isOpenViolationStatus(v.status?.toLowerCase())).length
  const pendingHearingCount = violations.filter((v: any) => isHearingPendingViolationStatus(v.status?.toLowerCase())).length
  const noticesThisMonth = violations.filter((v: any) => v.notice_sent_at && v.notice_sent_at >= firstOfMonth).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Violations Oversight</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Track all violations across your portfolio</p>
        </div>
      </div>

      {loadErrors.length > 0 && <Alert tone="danger" title="Could not load violations; the list below may be incomplete.">{loadErrors.join(' · ')}</Alert>}

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Open Violations', value: openCount, icon: AlertTriangle },
          { label: 'Pending Hearings', value: pendingHearingCount, icon: Calendar },
          { label: 'Notices This Month', value: noticesThisMonth, icon: FileText },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] font-medium text-gray-500">{item.label}</div>
                  <div className="mt-1.5 font-display text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{item.value}</div>
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
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Association</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Unit</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Owner</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Type</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Status</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Date Observed</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Days Open</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Hearing</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Fine</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-500">No violations found.</td></tr>
            ) : (
              violations.map((v: any) => (
                <tr key={v.id} className="border-b border-line/70 last:border-0 hover:bg-gray-50/70">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.associations?.name ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{v.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{v.owners?.full_name ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-700">{v.violation_type ?? v.title ?? '—'}</td>
                  <td className="px-4 py-3.5"><Badge status={v.status ?? '—'} /></td>
                  <td className="px-4 py-3.5 text-sm tabular-nums text-gray-700">{date(v.date_observed)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${daysOpen(v.created_at) > 30 ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                    {daysOpen(v.created_at)}
                  </td>
                  <td className="px-4 py-3.5 text-sm tabular-nums text-gray-700">{v.hearing_date ? date(v.hearing_date) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                    {v.fine_amount ? money(v.fine_amount) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/violations/${v.id}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-950" title="View">
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

      <div className="text-[13px] text-gray-500">Showing {violations.length} violations across all associations</div>
    </div>
  )
}
