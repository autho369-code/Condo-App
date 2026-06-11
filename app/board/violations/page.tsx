import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { StatusChip } from '@/components/operations/status-chip'
import { date } from '@/lib/utils'
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

function FineBadge({ fineAmount, fineAssessedAt }: { fineAmount: number | null; fineAssessedAt: string | null }) {
  if (!fineAmount && !fineAssessedAt) {
    return <span className="text-xs text-gray-400">None</span>
  }
  return <StatusChip tone="warning">{fineAssessedAt ? 'Assessed' : 'Pending'}</StatusChip>
}

function HearingBadge({ hearingAt, hearingDate }: { hearingAt: string | null; hearingDate: string | null }) {
  if (!hearingDate && !hearingAt) {
    return <span className="text-xs text-gray-400">None</span>
  }
  const hDate = hearingDate || hearingAt
  const isPast = hDate && new Date(hDate) < new Date()
  if (isPast) {
    return <StatusChip tone="neutral">Completed</StatusChip>
  }
  return <StatusChip tone="warning">Scheduled</StatusChip>
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
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Violations</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Board member violation oversight</p>
        </div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-semibold text-gray-900">No associations assigned to your board membership.</p>
          <p className="mt-1 text-sm text-gray-500">Contact your platform administrator for access.</p>
        </div>
      </div>
    )
  }

  const today = new Date()
  const todayDate = today.toISOString().slice(0, 10)
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

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

  const inputCls = 'h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Violations</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Overview of all violations across your board&apos;s association
          {boardAssocIds.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Open Violations" value={openViolations.length} icon={AlertTriangle} />
        <StatCard label="New This Month" value={newThisMonth.length} icon={Calendar} />
        <StatCard label="Closed This Month" value={closedThisMonth.length} icon={CheckCircle2} />
        <StatCard label="Hearings Scheduled" value={hearingsScheduled.length} icon={TrendingUp} />
        <StatCard label="Repeat Offenders" value={repeatOffenderCount} icon={Users} />
        <StatCard label="Avg Resolution" value={`${avgResolutionDays}d`} icon={Clock} />
      </div>

      {/* ── Filters ── */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <form className="flex flex-wrap items-end gap-3">
          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Status</label>
            <select name="status" defaultValue={statusFilter} className={inputCls}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="hearing_scheduled">Hearing Scheduled</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Violation Type</label>
            <select name="type" defaultValue={typeFilter} className={inputCls}>
              <option value="">All Types</option>
              {distinctTypes.map((t: string) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">From</label>
            <input type="date" name="from" defaultValue={fromDate} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">To</label>
            <input type="date" name="to" defaultValue={toDate} className={inputCls} />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-4 self-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" name="repeat" value="true" defaultChecked={repeatOffender} className="rounded border-gray-300 accent-blue-600" />
              Repeat Offenders
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" name="fined" value="true" defaultChecked={finedOnly} className="rounded border-gray-300 accent-blue-600" />
              Fined Only
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" name="escalated" value="true" defaultChecked={escalatedOnly} className="rounded border-gray-300 accent-blue-600" />
              Escalated
            </label>
          </div>

          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 self-end rounded-xl bg-gray-950 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Search className="h-4 w-4" />
            Filter
          </button>
        </form>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-500">Active filters:</span>
            {filterChips.map((chip) => (
              <span key={chip.param} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15">
                {chip.label}
                <Link href={`/board/violations?${new URLSearchParams(
                  Object.fromEntries(
                    Object.entries(params).filter(([k]) => k !== chip.param).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? '' : v ?? ''])
                  ) as Record<string, string>
                ).toString()}`} className="ml-1 hover:text-blue-900">
                  <X className="h-3 w-3" />
                </Link>
              </span>
            ))}
            <Link href="/board/violations" className="ml-2 text-xs text-gray-500 hover:text-gray-950 hover:underline">Clear all</Link>
          </div>
        )}
      </div>

      {/* ── Violations Table ── */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Unit</th>
              <th className="px-4 py-2.5 text-left font-medium">Owner</th>
              <th className="px-4 py-2.5 text-left font-medium">Type</th>
              <th className="px-4 py-2.5 text-left font-medium">Date Issued</th>
              <th className="px-4 py-2.5 text-right font-medium">Days Open</th>
              <th className="px-4 py-2.5 text-left font-medium">Hearing</th>
              <th className="px-4 py-2.5 text-right font-medium">Fine</th>
              <th className="px-4 py-2.5 text-left font-medium">Manager</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">Last Activity</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-gray-500">No violations found.</td></tr>
            ) : (
              violations.map((v: any) => (
                <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-[13px] text-gray-700">{v.units?.unit_number ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{v.owners?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">{v.violation_type ?? v.title ?? '—'}</td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{date(v.date_observed || v.created_at)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${daysOpen(v.created_at) > 30 ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                    {daysOpen(v.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <HearingBadge hearingAt={v.hearing_at} hearingDate={v.hearing_date} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FineBadge fineAmount={v.fine_amount} fineAssessedAt={v.fine_assessed_at} />
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-700">
                    {v.profiles?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={v.status ?? '—'} />
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-gray-500">
                    {date(v.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/board/violations/${v.id}`}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-950"
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

      <div className="text-xs text-gray-500">
        Showing {violations.length} violation{violations.length !== 1 ? 's' : ''}
        {hasActiveFilters ? ' (filtered)' : ''} across {boardAssocIds.length} association{boardAssocIds.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
