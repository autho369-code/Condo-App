import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { Users, AlertTriangle, ArrowLeft, Eye } from 'lucide-react'

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

export default async function RepeatOffendersPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []

  if (boardAssocIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Repeat Offenders</h1>
          <p className="mt-1 text-sm text-slate-400">Owners with multiple violations</p>
        </div>
        <div className="rounded-xl border border-[#1E293B] p-12 text-center" style={{ backgroundColor: '#0B1121' }}>
          <AlertTriangle className="mx-auto h-12 w-12 text-slate-600" />
          <p className="mt-4 text-slate-400">No associations assigned to your board membership.</p>
        </div>
      </div>
    )
  }

  // Fetch all violations in board associations with owner data
  const { data: allViolations } = await db
    .from('violations')
    .select(`id, status, title, violation_type, created_at, hearing_required, owner_id, owners!violations_owner_id_fkey(full_name), unit_id, units!violations_unit_id_fkey(unit_number)`)
    .in('association_id', boardAssocIds)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  const violations = (allViolations ?? [])

  // Group by owner_id
  const ownerMap = new Map<string, {
    ownerId: string
    ownerName: string
    unitNumber: string | null
    violations: any[]
  }>()

  violations.forEach((v: any) => {
    if (!v.owner_id) return
    if (!ownerMap.has(v.owner_id)) {
      ownerMap.set(v.owner_id, {
        ownerId: v.owner_id,
        ownerName: v.owners?.full_name ?? 'Unknown Owner',
        unitNumber: v.units?.unit_number ?? null,
        violations: [],
      })
    }
    ownerMap.get(v.owner_id)!.violations.push(v)
  })

  // Filter to repeat offenders (2+ violations)
  const repeatOffenders = Array.from(ownerMap.values())
    .filter((o) => o.violations.length >= 2)
    .sort((a, b) => b.violations.length - a.violations.length)

  const totalRepeatOffenders = repeatOffenders.length
  const totalViolationsFromRepeats = repeatOffenders.reduce((sum, o) => sum + o.violations.length, 0)

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Repeat Offenders</h1>
          <p className="mt-1 text-sm text-slate-400">
            Owners with 2 or more violations in your association
          </p>
        </div>
        <Link
          href="/board/violations"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> All Violations
        </Link>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
          <div className="text-xs font-medium uppercase text-slate-500">Repeat Offenders</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-red-400">{totalRepeatOffenders}</div>
          <div className="mt-1 text-xs text-slate-500">Owners with 2+ violations</div>
        </div>
        <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
          <div className="text-xs font-medium uppercase text-slate-500">Total Violations</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-white">{totalViolationsFromRepeats}</div>
          <div className="mt-1 text-xs text-slate-500">From repeat offenders</div>
        </div>
        <div className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
          <div className="text-xs font-medium uppercase text-slate-500">Avg Violations</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-400">
            {totalRepeatOffenders > 0 ? (totalViolationsFromRepeats / totalRepeatOffenders).toFixed(1) : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500">Per repeat offender</div>
        </div>
      </div>

      {/* ── Repeat Offenders Table ── */}
      <div className="overflow-x-auto rounded-xl border border-[#1E293B]" style={{ backgroundColor: '#0B1121' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-left font-medium">Owner Name</th>
              <th className="px-4 py-3 text-right font-medium"># Violations</th>
              <th className="px-4 py-3 text-left font-medium">Categories</th>
              <th className="px-4 py-3 text-left font-medium">Last Violation</th>
              <th className="px-4 py-3 text-right font-medium">Hearings</th>
              <th className="px-4 py-3 text-left font-medium">Most Recent Status</th>
              <th className="px-4 py-3 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]">
            {repeatOffenders.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                No repeat offenders found. All owners have fewer than 2 violations.
              </td></tr>
            ) : (
              repeatOffenders.map((offender) => {
                const categories = [...new Set(offender.violations.map((v: any) => v.violation_type).filter(Boolean))]
                const lastViolation = offender.violations[0] // sorted desc by created_at
                const hearingCount = offender.violations.filter((v: any) => v.hearing_required).length
                return (
                  <tr key={offender.ownerId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="text-slate-300">{offender.unitNumber ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{offender.ownerName}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={offender.violations.length >= 4 ? 'text-red-400 font-bold' : offender.violations.length >= 3 ? 'text-amber-400' : 'text-slate-300'}>
                        {offender.violations.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {categories.map((cat: string) => (
                          <span key={cat} className="inline-flex h-5 items-center rounded bg-slate-700/50 px-2 text-xs text-slate-400">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{date(lastViolation?.created_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                      {hearingCount > 0 ? (
                        <span className="text-amber-400">{hearingCount}</span>
                      ) : '0'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lastViolation?.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/board/violations/${lastViolation?.id}`}
                          className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-emerald-400"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-600">
        {repeatOffenders.length} repeat offender{repeatOffenders.length !== 1 ? 's' : ''} identified
        from {violations.length} total violation{violations.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
