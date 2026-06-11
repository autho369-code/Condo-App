import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { date } from '@/lib/utils'
import { AlertTriangle, ArrowLeft, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RepeatOffendersPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const boardAssocIds = me.board_association_ids ?? []

  if (boardAssocIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Repeat Offenders</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">Owners with multiple violations</p>
        </div>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <AlertTriangle className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No associations assigned to your board membership.</p>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Repeat Offenders</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">
            Owners with 2 or more violations in your association
          </p>
        </div>
        <Link
          href="/board/violations"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-950"
        >
          <ArrowLeft className="h-4 w-4" /> All Violations
        </Link>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Repeat Offenders', value: totalRepeatOffenders, sub: 'Owners with 2+ violations' },
          { label: 'Total Violations', value: totalViolationsFromRepeats, sub: 'From repeat offenders' },
          { label: 'Avg Violations', value: totalRepeatOffenders > 0 ? (totalViolationsFromRepeats / totalRepeatOffenders).toFixed(1) : '—', sub: 'Per repeat offender' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{s.value}</div>
            <div className="mt-1 text-xs text-gray-500">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Repeat Offenders Table ── */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Unit</th>
              <th className="px-4 py-2.5 text-left font-medium">Owner Name</th>
              <th className="px-4 py-2.5 text-right font-medium"># Violations</th>
              <th className="px-4 py-2.5 text-left font-medium">Categories</th>
              <th className="px-4 py-2.5 text-left font-medium">Last Violation</th>
              <th className="px-4 py-2.5 text-right font-medium">Hearings</th>
              <th className="px-4 py-2.5 text-left font-medium">Most Recent Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {repeatOffenders.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">
                No repeat offenders found. All owners have fewer than 2 violations.
              </td></tr>
            ) : (
              repeatOffenders.map((offender) => {
                const categories = [...new Set(offender.violations.map((v: any) => v.violation_type).filter(Boolean))]
                const lastViolation = offender.violations[0] // sorted desc by created_at
                const hearingCount = offender.violations.filter((v: any) => v.hearing_required).length
                return (
                  <tr key={offender.ownerId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-[13px] text-gray-700">{offender.unitNumber ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{offender.ownerName}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${offender.violations.length >= 4 ? 'font-semibold text-red-700' : 'text-gray-900'}`}>
                      {offender.violations.length}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {categories.map((cat: string) => (
                          <span key={cat} className="inline-flex h-5 items-center rounded-full bg-gray-100 px-2 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-500/15">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-gray-700">{date(lastViolation?.created_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{hearingCount}</td>
                    <td className="px-4 py-3">
                      <Badge status={lastViolation?.status ?? '—'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/board/violations/${lastViolation?.id}`}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-950"
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

      <div className="text-xs text-gray-500">
        {repeatOffenders.length} repeat offender{repeatOffenders.length !== 1 ? 's' : ''} identified
        from {violations.length} total violation{violations.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
