import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
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
        <h1 className="text-2xl font-bold text-gray-900">Hearings</h1>
        <p className="text-sm text-gray-500">View scheduled hearings and request new ones</p>
      </div>

      {all.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-gray-500">No hearings scheduled or requested.</p>
          <p className="text-sm text-gray-400 mt-1">If you have an open violation, you can request a hearing from the violation detail page.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {all.map((v: any) => (
            <div key={v.id} className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/portal/violations/${v.id}`} className="font-semibold text-gray-900 hover:text-blue-600">{v.title}</Link>
                  <div className="text-xs text-gray-500 capitalize mt-0.5">{v.violation_type?.replace('_',' ')} — Issued {date(v.date_observed)}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${v.status === 'closed' || v.status === 'cured' ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>{v.status.replace('_',' ')}</span>
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
