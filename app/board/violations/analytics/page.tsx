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
  accent = 'emerald',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'violet'
}) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  }
  return (
    <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function HorizontalBar({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs text-slate-400 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-5 rounded bg-[#060B18] overflow-hidden">
        <div
          className={`h-full rounded transition-all ${color}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="w-10 text-xs text-right tabular-nums text-slate-300">{value}</span>
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
          <h1 className="text-2xl font-bold text-white">Violation Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">Data-driven insights for your association</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] p-12 text-center" style={{ backgroundColor: '#0B1121' }}>
          <AlertTriangle className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-400">No associations assigned to your board membership.</p>
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

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Violation Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Data-driven insights across {violations.length} violation{violations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/board/violations"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> All Violations
        </Link>
      </div>

      {/* ── Key Stats ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Violations"
          value={violations.length}
          icon={BarChart3}
          accent="blue"
        />
        <StatCard
          label="Avg Resolution"
          value={`${avgResolutionDays}d`}
          sub="From creation to closure"
          icon={Clock}
          accent={avgResolutionDays > 30 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="Repeat Offender Rate"
          value={`${repeatOffenderRate}%`}
          sub={`${repeatOffenderCount} of ${totalOwnersWithViolations} owners`}
          icon={Users}
          accent={repeatOffenderRate > 30 ? 'red' : repeatOffenderRate > 15 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="Open %"
          value={`${openPct}%`}
          sub={`${openCount} open / ${closedCount} closed`}
          icon={TrendingUp}
          accent={openPct > 50 ? 'amber' : 'emerald'}
        />
      </div>

      {/* ── Top Violation Categories ── */}
      <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
        <h2 className="mb-5 text-sm font-semibold text-white">Top Violation Categories</h2>
        <div className="space-y-2.5">
          {sortedCategories.length === 0 ? (
            <p className="text-sm text-slate-600">No violation data available.</p>
          ) : (
            sortedCategories.map(([type, count], idx) => {
              const colors = [
                'bg-red-500',
                'bg-orange-500',
                'bg-amber-500',
                'bg-yellow-500',
                'bg-emerald-500',
                'bg-blue-500',
                'bg-violet-500',
                'bg-pink-500',
              ]
              return (
                <HorizontalBar
                  key={type}
                  label={type}
                  value={count}
                  max={maxCategory}
                  color={colors[idx % colors.length]}
                />
              )
            })
          )}
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Violations by Month */}
        <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
          <h2 className="mb-5 text-sm font-semibold text-white">Violations by Month (Last 12 Months)</h2>
          <div className="space-y-3">
            {monthlyData.map((m) => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="w-12 text-xs text-slate-500 flex-shrink-0">{m.month}</span>
                <div className="flex-1 h-5 rounded bg-[#060B18] overflow-hidden flex">
                  {m.total > 0 ? (
                    <>
                      <div
                        className="h-full bg-emerald-600 transition-all"
                        style={{ width: `${(m.closed / maxMonthly) * 100}%` }}
                        title={`${m.closed} closed`}
                      />
                      <div
                        className="h-full bg-amber-600 transition-all"
                        style={{ width: `${(m.open / maxMonthly) * 100}%` }}
                        title={`${m.open} open`}
                      />
                    </>
                  ) : (
                    <div className="h-full w-0" />
                  )}
                </div>
                <span className="w-6 text-xs text-right tabular-nums text-slate-400">{m.total}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-emerald-600" />
              <span className="text-slate-500">Closed</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-600" />
              <span className="text-slate-500">Open</span>
            </span>
          </div>
        </div>

        {/* Open vs Closed Donut */}
        <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
          <h2 className="mb-5 text-sm font-semibold text-white">Open vs Closed Ratio</h2>
          {totalForRatio > 0 ? (
            <div className="flex items-center justify-center gap-8">
              <svg viewBox="0 0 120 120" className="h-36 w-36">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#1E293B" strokeWidth="12" />
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
                <text x="60" y="58" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
                  {totalForRatio}
                </text>
                <text x="60" y="75" textAnchor="middle" fill="#94A3B8" fontSize="10">
                  total
                </text>
              </svg>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <div>
                    <span className="text-sm text-slate-300">Open: <strong className="text-amber-400">{openCount}</strong></span>
                    <span className="text-xs text-slate-500 ml-2">({openPct}%)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <div>
                    <span className="text-sm text-slate-300">Closed: <strong className="text-emerald-400">{closedCount}</strong></span>
                    <span className="text-xs text-slate-500 ml-2">({closedPct}%)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-600">No violation data available.</div>
          )}
        </div>
      </div>

      {/* ── Additional Stats ── */}
      <div className="rounded-xl border border-[#1E293B] p-5" style={{ backgroundColor: '#0B1121' }}>
        <h2 className="mb-4 text-sm font-semibold text-white">Additional Statistics</h2>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">Total Fines Assessed</div>
            <div className="text-lg font-bold text-amber-400 tabular-nums">
              ${violations.filter((v: any) => v.fine_amount).reduce((sum: number, v: any) => sum + (v.fine_amount ?? 0), 0).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Avg Fine Amount</div>
            <div className="text-lg font-bold text-white tabular-nums">
              {(() => {
                const fined = violations.filter((v: any) => v.fine_amount)
                return fined.length > 0
                  ? `$${(fined.reduce((sum: number, v: any) => sum + (v.fine_amount ?? 0), 0) / fined.length).toFixed(2)}`
                  : '—'
              })()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Unique Violation Types</div>
            <div className="text-lg font-bold text-white tabular-nums">{categoryCounts.size}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Owners with Violations</div>
            <div className="text-lg font-bold text-white tabular-nums">{totalOwnersWithViolations}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
