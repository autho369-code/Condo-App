import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { BarChart3, ArrowLeft, AlertTriangle, TrendingUp, Clock, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

function HorizontalBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 flex-shrink-0 truncate text-right text-xs text-gray-500">{label}</span>
      <div className="h-5 flex-1 overflow-hidden rounded bg-gray-100">
        <div
          className="h-full rounded bg-blue-500 transition-all"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-gray-700">{value}</span>
    </div>
  )
}

export default async function ViolationAnalyticsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []

  if (boardAssocIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Violation Analytics</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Data-driven insights for your association</p>
        </div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No associations assigned to your board membership.</p>
        </div>
      </div>
    )
  }

  // Fetch all violations
  const { data: allViolations } = await db
    .from('violations')
    .select(`id, status, title, violation_type, created_at, closed_at, owner_id, fine_amount`)
    .in('association_id', boardAssocIds)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  const violations = (allViolations ?? [])

  // ── Top Violation Categories ──
  const categoryCounts = new Map<string, number>()
  violations.forEach((v: any) => {
    const type = v.violation_type ?? 'Other'
    categoryCounts.set(type, (categoryCounts.get(type) ?? 0) + 1)
  })
  const sortedCategories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
  const maxCategory = sortedCategories[0]?.[1] ?? 1

  // ── Open vs Closed ──
  const openStatuses = ['open', 'pending', 'in_progress', 'under_review', 'notice_sent', 'hearing_scheduled']
  const openCount = violations.filter((v: any) => openStatuses.includes(v.status?.toLowerCase())).length
  const closedCount = violations.filter((v: any) => ['closed', 'cured', 'resolved'].includes(v.status?.toLowerCase())).length
  const totalForRatio = openCount + closedCount
  const openPct = totalForRatio > 0 ? Math.round((openCount / totalForRatio) * 100) : 0
  const closedPct = totalForRatio > 0 ? Math.round((closedCount / totalForRatio) * 100) : 0

  // ── Avg Resolution Time ──
  const resolved = violations.filter((v: any) => v.closed_at && v.created_at)
  const avgResolutionDays = resolved.length > 0
    ? Math.round(
        resolved.reduce((sum: number, v: any) => {
          return sum + (new Date(v.closed_at).getTime() - new Date(v.created_at).getTime()) / 86400000
        }, 0) / resolved.length
      )
    : 0

  // ── Repeat Offender Rate ──
  const ownerCounts = new Map<string, number>()
  violations.forEach((v: any) => {
    if (v.owner_id) ownerCounts.set(v.owner_id, (ownerCounts.get(v.owner_id) ?? 0) + 1)
  })
  const totalOwnersWithViolations = ownerCounts.size
  const repeatOffenderCount = Array.from(ownerCounts.values()).filter((c) => c >= 2).length
  const repeatOffenderRate = totalOwnersWithViolations > 0
    ? Math.round((repeatOffenderCount / totalOwnersWithViolations) * 100)
    : 0

  // ── Violations by Month (last 12 months) ──
  const now = new Date()
  const monthlyData: { month: string; total: number; open: number; closed: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`

    const monthViolations = violations.filter((v: any) => {
      if (!v.created_at) return false
      return v.created_at >= `${monthKey}-01` && v.created_at < `${nextMonthKey}-01`
    })
    const monthOpen = monthViolations.filter((v: any) => openStatuses.includes(v.status?.toLowerCase())).length
    const monthClosed = monthViolations.filter((v: any) => ['closed', 'cured', 'resolved'].includes(v.status?.toLowerCase())).length

    monthlyData.push({
      month: monthLabel,
      total: monthViolations.length,
      open: monthOpen,
      closed: monthClosed,
    })
  }
  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1)

  const card = 'rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Violation Analytics</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">
            Data-driven insights across {violations.length} violation{violations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/board/violations"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-950"
        >
          <ArrowLeft className="h-4 w-4" /> All Violations
        </Link>
      </div>

      {/* ── Key Stats ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Violations"
          value={violations.length}
          icon={BarChart3}
        />
        <StatCard
          label="Avg Resolution"
          value={`${avgResolutionDays}d`}
          sub="From creation to closure"
          icon={Clock}
        />
        <StatCard
          label="Repeat Offender Rate"
          value={`${repeatOffenderRate}%`}
          sub={`${repeatOffenderCount} of ${totalOwnersWithViolations} owners`}
          icon={Users}
        />
        <StatCard
          label="Open %"
          value={`${openPct}%`}
          sub={`${openCount} open / ${closedCount} closed`}
          icon={TrendingUp}
        />
      </div>

      {/* ── Top Violation Categories ── */}
      <div className={card}>
        <h2 className="mb-5 text-sm font-semibold text-gray-950">Top Violation Categories</h2>
        <div className="space-y-2.5">
          {sortedCategories.length === 0 ? (
            <p className="text-sm text-gray-500">No violation data available.</p>
          ) : (
            sortedCategories.map(([type, count]) => (
              <HorizontalBar
                key={type}
                label={type}
                value={count}
                max={maxCategory}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Violations by Month */}
        <div className={card}>
          <h2 className="mb-5 text-sm font-semibold text-gray-950">Violations by Month (Last 12 Months)</h2>
          <div className="space-y-3">
            {monthlyData.map((m) => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="w-12 flex-shrink-0 text-xs text-gray-500">{m.month}</span>
                <div className="flex h-5 flex-1 overflow-hidden rounded bg-gray-100">
                  {m.total > 0 ? (
                    <>
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${(m.closed / maxMonthly) * 100}%` }}
                        title={`${m.closed} closed`}
                      />
                      <div
                        className="h-full bg-amber-500 transition-all"
                        style={{ width: `${(m.open / maxMonthly) * 100}%` }}
                        title={`${m.open} open`}
                      />
                    </>
                  ) : (
                    <div className="h-full w-0" />
                  )}
                </div>
                <span className="w-6 text-right text-xs tabular-nums text-gray-700">{m.total}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-500" />
              <span className="text-gray-500">Closed</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-500" />
              <span className="text-gray-500">Open</span>
            </span>
          </div>
        </div>

        {/* Open vs Closed Donut */}
        <div className={card}>
          <h2 className="mb-5 text-sm font-semibold text-gray-950">Open vs Closed Ratio</h2>
          {totalForRatio > 0 ? (
            <div className="flex items-center justify-center gap-8">
              <svg viewBox="0 0 120 120" className="h-36 w-36">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#F3F4F6" strokeWidth="12" />
                {/* Open arc */}
                {(() => {
                  const openLen = (openPct / 100) * 314
                  const closedLen = (closedPct / 100) * 314
                  return (
                    <>
                      <circle
                        cx="60" cy="60" r="50"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="12"
                        strokeDasharray={`${openLen} ${314 - openLen}`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="60" cy="60" r="50"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="12"
                        strokeDasharray={`${closedLen} ${314 - closedLen}`}
                        strokeDashoffset={-openLen}
                        strokeLinecap="round"
                      />
                    </>
                  )
                })()}
                <text x="60" y="58" textAnchor="middle" fill="#030712" fontSize="16" fontWeight="600">
                  {totalForRatio}
                </text>
                <text x="60" y="75" textAnchor="middle" fill="#6B7280" fontSize="10">
                  total
                </text>
              </svg>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <div>
                    <span className="text-sm text-gray-700">Open: <strong className="text-gray-950">{openCount}</strong></span>
                    <span className="ml-2 text-xs text-gray-500">({openPct}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <div>
                    <span className="text-sm text-gray-700">Closed: <strong className="text-gray-950">{closedCount}</strong></span>
                    <span className="ml-2 text-xs text-gray-500">({closedPct}%)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">No violation data available.</div>
          )}
        </div>
      </div>

      {/* ── Additional Stats ── */}
      <div className={card}>
        <h2 className="mb-4 text-sm font-semibold text-gray-950">Additional Statistics</h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <div className="mb-1 text-xs text-gray-500">Total Fines Assessed</div>
            <div className="text-lg font-semibold tabular-nums text-gray-950">
              ${violations.filter((v: any) => v.fine_amount).reduce((sum: number, v: any) => sum + (v.fine_amount ?? 0), 0).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-500">Avg Fine Amount</div>
            <div className="text-lg font-semibold tabular-nums text-gray-950">
              {(() => {
                const fined = violations.filter((v: any) => v.fine_amount)
                return fined.length > 0
                  ? `$${(fined.reduce((sum: number, v: any) => sum + (v.fine_amount ?? 0), 0) / fined.length).toFixed(2)}`
                  : '—'
              })()}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-500">Unique Violation Types</div>
            <div className="text-lg font-semibold tabular-nums text-gray-950">{categoryCounts.size}</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-500">Owners with Violations</div>
            <div className="text-lg font-semibold tabular-nums text-gray-950">{totalOwnersWithViolations}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
