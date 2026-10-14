import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge, Alert } from '@/components/ui/shell'
import { money, date } from '@/lib/utils'
import Link from 'next/link'
import { associationZone } from '../_lib/tenure'

export const dynamic = 'force-dynamic'

export default async function OwnerHearingsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: viols, error: violsError } = await db.from('violations')
    .select('id, title, violation_type, status, date_observed, hearing_date, hearing_required, hearing_at, board_decision, fine_amount, fines_total, associations(timezone)')
    .in('owner_id', me.owner_ids).is('archived_at', null)
    // hearing_pending = a hearing was requested/granted but not yet scheduled.
    .or('hearing_required.eq.true,hearing_date.not.is.null,hearing_at.not.is.null,status.eq.hearing_pending')
    .order('hearing_date', { ascending: true }).limit(50)

  const all = viols ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Hearings</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">View hearings scheduled for your violations</p>
      </div>

      {violsError && <Alert tone="danger" title="Could not load your hearings:">{violsError.message}. Please refresh.</Alert>}

      {violsError ? null : all.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm font-semibold text-gray-900">No hearings scheduled.</p>
          <p className="mt-1 text-sm text-gray-500">If a hearing is scheduled for one of your violations, it will appear here. To request a hearing, contact your association management.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {all.map((v: any) => {
            // hearing_at is what the hearing workflow records; hearing_date is
            // the older scheduled day. Fines: the accumulated total when
            // recorded, else the base fine (same rule as the violation page).
            const hearingOn = v.hearing_at ?? v.hearing_date
            // Shown in the association's own time zone (a hearing_at instant
            // near midnight is a different day elsewhere).
            const zone = associationZone(v.associations?.timezone)
            const fine = Number(v.fines_total) > 0 ? v.fines_total : v.fine_amount
            return (
            <div key={v.id} className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/portal/violations/${v.id}`} className="font-semibold text-gray-900 hover:text-gray-950 hover:underline">{v.title}</Link>
                  <div className="mt-0.5 text-xs capitalize text-gray-500">{v.violation_type?.replace('_',' ')} — Issued {date(v.date_observed)}</div>
                </div>
                <Badge status={v.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Hearing Date:</span> <span className="text-gray-900 font-medium">{hearingOn ? date(hearingOn, 'short', zone) : 'Not scheduled'}</span></div>
                <div><span className="text-gray-500">Fine:</span> <span className="text-gray-900 font-medium">{Number(fine) > 0 ? money(fine) : 'None'}</span></div>
                <div><span className="text-gray-500">Board Decision:</span> <span className="text-gray-900 font-medium capitalize">{v.board_decision ?? 'Pending'}</span></div>
                <div><span className="text-gray-500">Hearing Required:</span> <span className="text-gray-900 font-medium">{v.hearing_required ? 'Yes' : 'No'}</span></div>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
