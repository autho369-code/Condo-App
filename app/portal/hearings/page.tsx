import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { Badge } from '@/components/ui/shell'
import { money, date } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function OwnerHearingsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: viols } = await db.from('violations')
    .select('id, title, violation_type, status, date_observed, hearing_date, hearing_required, hearing_at, board_decision, fine_amount')
    .eq('owner_id', me.owner_id).is('archived_at', null)
    .or('hearing_required.eq.true,hearing_date.not.is.null,hearing_at.not.is.null')
    .order('hearing_date', { ascending: true }).limit(50)

  const all = viols ?? []

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Hearings</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">View hearings scheduled for your violations</p>
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-sm font-semibold text-gray-900">No hearings scheduled.</p>
          <p className="mt-1 text-sm text-gray-500">If a hearing is scheduled for one of your violations, it will appear here. To request a hearing, contact your association management.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {all.map((v: any) => (
            <div key={v.id} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/portal/violations/${v.id}`} className="font-semibold text-gray-900 hover:text-gray-950 hover:underline">{v.title}</Link>
                  <div className="mt-0.5 text-xs capitalize text-gray-500">{v.violation_type?.replace('_',' ')} — Issued {date(v.date_observed)}</div>
                </div>
                <Badge status={v.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Hearing Date:</span> <span className="text-gray-900 font-medium">{v.hearing_date ? date(v.hearing_date) : v.hearing_at ? date(v.hearing_at) : 'Not scheduled'}</span></div>
                <div><span className="text-gray-500">Fine:</span> <span className="text-gray-900 font-medium">{v.fine_amount ? money(v.fine_amount) : 'None'}</span></div>
                <div><span className="text-gray-500">Board Decision:</span> <span className="text-gray-900 font-medium capitalize">{v.board_decision ?? 'Pending'}</span></div>
                <div><span className="text-gray-500">Hearing Required:</span> <span className="text-gray-900 font-medium">{v.hearing_required ? 'Yes' : 'No'}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
