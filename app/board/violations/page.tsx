import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date, money } from '@/lib/utils'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  Eye,
  Search,
  X,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-blue-500/10 text-blue-400 ring-blue-500/20' },
    pending: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-400 ring-amber-500/20' },
    in_progress: { label: 'In Progress', cls: 'bg-violet-500/10 text-violet-400 ring-violet-500/20' },
    under_review: { label: 'Under Review', cls: 'bg-orange-500/10 text-orange-400 ring-orange-500/20' },
    notice_sent: { label: 'Notice Sent', cls: 'bg-pink-500/10 text-pink-400 ring-pink-500/20' },
    hearing_scheduled: { label: 'Hearing', cls: 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20' },
    closed: { label: 'Closed', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' },
    cured: { label: 'Cured', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
    resolved: { label: 'Resolved', cls: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' },
  }
  const s = status?.toLowerCase() ?? ''
  const { label, cls } = map[s] ?? { label: status ?? '—', cls: 'bg-slate-500/10 text-slate-400 ring-slate-500/20' }
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ${cls}`}>{label}</span>
}

function FineBadge({ fineAmount, fineAssessedAt }: { fineAmount: number | null; fineAssessedAt: string | null }) {
  if (!fineAmount && !fineAssessedAt) {
    return <span className="text-xs text-slate-600">None</span>
  }
  if (fineAssessedAt) {
    return <span className="inline-flex h-6 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Assessed</span>
  }
  return <span className="inline-flex h-6 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">Pending</span>
}

function HearingBadge({ hearingAt, hearingDate }: { hearingAt: string | null; hearingDate: string | null }) {
  if (!hearingDate && !hearingAt) {
    return <span className="text-xs text-slate-600">None</span>
  }
  const hDate = hearingDate || hearingAt
  const isPast = hDate && new Date(hDate) < new Date()
  if (isPast) {
    return <span className="inline-flex h-6 items-center rounded-full bg-slate-500/10 px-2.5 text-xs font-medium text-slate-400 ring-1 ring-slate-500/20">Completed</span>
  }
  return <span className="inline-flex h-6 items-center rounded-full bg-yellow-500/10 px-2.5 text-xs font-medium text-yellow-400 ring-1 ring-yellow-500/20">Scheduled</span>
}

function daysOpen(createdAt: string | null): number {
  if (!createdAt) return 0
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

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
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'violet' | 'pink'
}) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  }
  return (
    <div className="rounded-xl border border-[#1E293B] p-4 transition-colors hover:border-[#334155]" style={{ backgroundColor: '#0B1121' }}>
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

export default async function BoardViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []

  const params = await searchParams
  const statusFilter = (params.status as string) || ''
  const repeatOffender = params.repeat === 'true'
  const finedOnly = params.fined === 'true'
  const escalatedOnly = params.escalated === 'true'
  const typeFilter = (params.type as string) || ''
  const fromDate = (params.from as string) || ''
  const toDate = (params.to as string) || ''
  const hasActiveFilters = !!(statusFilter || repeatOffender || finedOnly || escalatedOnly || typeFilter || fromDate || toDate)

  if (boardAssocIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Violations</h1>
          <p className="mt-1 text-sm text-slate-400">Board member violation oversight</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] p-12 text-center" style={{ backgroundColor: '#0B1121' }}>
          <AlertTriangle className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-400">No associations assigned to your board membership.</p>
          <p className="mt-1 text-sm text-slate-500">Contact your platform administrator for access.</p>
        </div>
      </div>
    )
  }

  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}-01`

  // ── Base query for all violations in board associations ──
  let baseQuery = db
    .from('violations')
    .select(`id, status, title, violation_type, date_observed, hearing_date, hearing_at, fine_amount, fine_assessed_at, created_at, updated_at, due_date, notice_sent_at, closed_at, escalated, association_id, unit_id, owner_id, created_by, associations!violations_association_id_fkey(name), units!violations_unit_id_fkey(unit_number), owners!violations_owner_id_fkey(full_name), profiles!violations_created_by_fkey(full_name)`)
    .in('association_id', boardAssocIds)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  // Apply filters
  if (statusFilter) {
    if (statusFilter === 'open') {
      baseQuery = baseQuery.in('status', ['open', 'pending', 'in_progress', 'under_review', 'notice_sent'])
    } else if (statusFilter === 'hearing_scheduled') {
      baseQuery = baseQuery.eq('status', 'hearing_scheduled')
    } else if (statusFilter === 'closed') {
      baseQuery = baseQuery.in('status', ['closed', 'cured', 'resolved'])
    }
  }
  if (typeFilter) {
    baseQuery = baseQuery.eq('violation_type', typeFilter)
  }
  if (fromDate) {
    baseQuery = baseQuery.gte('created_at', fromDate)
  }
  if (toDate) {
    baseQuery = baseQuery.lte('created_at', toDate)
  }
  if (finedOnly) {
    baseQuery = baseQuery.not('fine_amount', 'is', null)
  }
  if (escalatedOnly) {
    baseQuery = baseQuery.eq('escalated', true)
  }

  const { data: allViolations } = await baseQuery
  let violations = (allViolations ?? [])

  // Repeat offender filter — compute client-side
  if (repeatOffender) {
    const ownerCounts = new Map<string, number>()
    violations.forEach((v: any) => {
      if (v.owner_id) {
        ownerCounts.set(v.owner_id, (ownerCounts.get(v.owner_id) ?? 0) + 1)
      }
    })
    const repeatOwnerIds = new Set(
      Array.from(ownerCounts.entries())
        .filter(([_, count]) => count >= 2)
        .map(([id]) => id)
    )
    violations = violations.filter((v: any) => repeatOwnerIds.has(v.owner_id))
  }

  // ── Summary stats ──
  const openStatuses = ['open', 'pending', 'in_progress', 'under_review', 'notice_sent']
  const openViolations = violations.filter((v: any) => openStatuses.includes(v.status?.toLowerCase()))
  const newThisMonth = violations.filter((v: any) => v.created_at && v.created_at >= firstOfMonth)
  const closedThisMonth = violations.filter((v: any) => v.closed_at && v.closed_at >= firstOfMonth)
  const hearingsScheduled = violations.filter((v: any) => v.hearing_at && v.hearing_at >= todayDate)

  // Repeat offenders count
  const ownerCountsAll = new Map<string, number>()
  violations.forEach((v: any) => {
    if (v.owner_id) ownerCountsAll.set(v.owner_id, (ownerCountsAll.get(v.owner_id) ?? 0) + 1)
  })
  const repeatOffenderCount = Array.from(ownerCountsAll.values()).filter((c) => c >= 2).length

  // Avg resolution time
  const resolvedViolations = violations.filter((v: any) => v.closed_at && v.created_at)
  const avgResolutionDays = resolvedViolations.length > 0
    ? Math.round(
        resolvedViolations.reduce((sum: number, v: any) => {
          return sum + (new Date(v.closed_at).getTime() - new Date(v.created_at).getTime()) / 86400000
        }, 0) / resolvedViolations.length
      )
    : 0

  // ── Distinct violation types for filter dropdown ──
  const { data: typesData } = await db
    .from('violations')
    .select('violation_type')
    .in('association_id', boardAssocIds)
    .is('archived_at', null)
    .order('violation_type')
  const distinctTypes = [...new Set((typesData ?? []).map((t: any) => t.violation_type).filter(Boolean))] as string[]

  // ── Active filter chips ──
  const filterChips: { label: string; param: string }[] = []
  if (statusFilter) filterChips.push({ label: `Status: ${statusFilter}`, param: 'status' })
  if (typeFilter) filterChips.push({ label: `Type: ${typeFilter}`, param: 'type' })
  if (fromDate) filterChips.push({ label: `From: ${fromDate}`, param: 'from' })
  if (toDate) filterChips.push({ label: `To: ${toDate}`, param: 'to' })
  if (repeatOffender) filterChips.push({ label: 'Repeat Offenders', param: 'repeat' })
  if (finedOnly) filterChips.push({ label: 'Fined Only', param: 'fined' })
  if (escalatedOnly) filterChips.push({ label: 'Escalated', param: 'escalated' })

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Violations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Overview of all violations across your board&apos;s association
          {boardAssocIds.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Open Violations"
          value={openViolations.length}
          icon={AlertTriangle}
          accent={openViolations.length > 0 ? 'red' : 'emerald'}
        />
        <StatCard
          label="New This Month"
          value={newThisMonth.length}
          icon={Calendar}
          accent="blue"
        />
        <StatCard
          label="Closed This Month"
          value={closedThisMonth.length}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Hearings Scheduled"
          value={hearingsScheduled.length}
          icon={TrendingUp}
          accent="amber"
        />
        <StatCard
          label="Repeat Offenders"
          value={repeatOffenderCount}
          icon={Users}
          accent={repeatOffenderCount > 0 ? 'red' : 'violet'}
        />
        <StatCard
          label="Avg Resolution"
          value={`${avgResolutionDays}d`}
          icon={Clock}
          accent={avgResolutionDays > 30 ? 'amber' : 'emerald'}
        />
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
        <form className="flex flex-wrap items-end gap-3">
          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Status</label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="hearing_scheduled">Hearing Scheduled</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Violation Type</label>
            <select
              name="type"
              defaultValue={typeFilter}
              className="h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Types</option>
              {distinctTypes.map((t: string) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">From</label>
            <input
              type="date"
              name="from"
              defaultValue={fromDate}
              className="h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">To</label>
            <input
              type="date"
              name="to"
              defaultValue={toDate}
              className="h-9 rounded-lg border border-[#1E293B] bg-[#060B18] px-3 text-sm text-slate-300 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4 self-end pb-0.5">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" name="repeat" value="true" defaultChecked={repeatOffender} className="rounded border-[#1E293B] bg-[#060B18] accent-emerald-500" />
              Repeat Offenders
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" name="fined" value="true" defaultChecked={finedOnly} className="rounded border-[#1E293B] bg-[#060B18] accent-emerald-500" />
              Fined Only
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" name="escalated" value="true" defaultChecked={escalatedOnly} className="rounded border-[#1E293B] bg-[#060B18] accent-emerald-500" />
              Escalated
            </label>
          </div>

          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 transition-colors self-end"
          >
            <Search className="h-4 w-4" />
            Filter
          </button>
        </form>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#1E293B] pt-3">
            <span className="text-xs text-slate-500">Active filters:</span>
            {filterChips.map((chip) => (
              <span key={chip.param} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                {chip.label}
                <Link href={`/board/violations?${new URLSearchParams(
                  Object.fromEntries(
                    Object.entries(params).filter(([k]) => k !== chip.param).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? '' : v ?? ''])
                  ) as Record<string, string>
                ).toString()}`} className="ml-1 hover:text-white">
                  <X className="h-3 w-3" />
                </Link>
              </span>
            ))}
            <Link href="/board/violations" className="text-xs text-slate-500 hover:text-slate-300 ml-2">Clear all</Link>
          </div>
        )}
      </div>

      {/* ── Violations Table ── */}
      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Date Issued</th>
              <th className="px-4 py-3 text-right font-medium">Days Open</th>
              <th className="px-4 py-3 text-left font-medium">Hearing</th>
              <th className="px-4 py-3 text-right font-medium">Fine</th>
              <th className="px-4 py-3 text-left font-medium">Manager</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Last Activity</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {violations.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">No violations found.</td></tr>
            ) : (
              violations.map((v: any) => (
                <tr key={v.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{v.units?.unit_number ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{v.owners?.full_name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-400">{v.violation_type ?? v.title ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{date(v.date_observed || v.created_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={daysOpen(v.created_at) > 30 ? 'text-red-400' : 'text-slate-300'}>
                      {daysOpen(v.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <HearingBadge hearingAt={v.hearing_at} hearingDate={v.hearing_date} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <FineBadge fineAmount={v.fine_amount} fineAssessedAt={v.fine_assessed_at} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {v.profiles?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {date(v.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/board/violations/${v.id}`}
                        className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-emerald-400"
                        title="View Details"
                      >
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

      <div className="text-xs text-slate-600">
        Showing {violations.length} violation{violations.length !== 1 ? 's' : ''}
        {hasActiveFilters ? ' (filtered)' : ''} across {boardAssocIds.length} association{boardAssocIds.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
