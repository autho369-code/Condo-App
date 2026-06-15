import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { Badge, SectionTitle } from '@/components/ui/shell'
import { date } from '@/lib/utils'
import Link from 'next/link'
import { Calendar, MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BoardMeetingsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  const { data: meetings } = await db
    .from('meetings')
    .select('id, title, meeting_type, start_time, location, status, created_at, association_id, associations(name)')
    .in('association_id', ids)
    .order('start_time', { ascending: false })
    .limit(200)

  const all = meetings ?? []

  const typeLabel: Record<string, string> = {
    board_meeting: 'Board Meeting',
    annual_meeting: 'Annual Meeting',
    special_meeting: 'Special Meeting',
    committee_meeting: 'Committee Meeting',
    vendor_meeting: 'Vendor Meeting',
    internal: 'Internal',
  }

  const isUpcoming = (d: string | null) => {
    if (!d) return false
    return new Date(d) >= new Date()
  }

  const upcoming = all.filter((m: any) => isUpcoming(m.start_time) && m.status !== 'cancelled')
  const past = all.filter((m: any) => !isUpcoming(m.start_time) || m.status === 'completed')

  const card = 'overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
  const thead = 'border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500'
  const row = 'border-b border-gray-50 last:border-0 hover:bg-gray-50/60'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Meetings</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Board and association meetings</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total', value: all.length },
          { label: 'Upcoming', value: upcoming.length },
          { label: 'Completed', value: all.filter((m: any) => m.status === 'completed').length },
          { label: 'Cancelled', value: all.filter((m: any) => m.status === 'cancelled').length },
        ].map((s: any) => (
          <div key={s.label} className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{s.label}</div>
            <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Upcoming Meetings */}
      {upcoming.length > 0 && (
        <div>
          <SectionTitle title="Upcoming" />
          <div className={card}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Meeting</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date & Time</th>
                  <th className="px-4 py-2.5 text-left font-medium">Location</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((m: any) => (
                  <tr key={m.id} className={row}>
                    <td className="px-4 py-3">
                      <Link href={`/board/meetings/${m.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">
                        {m.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-gray-500">{m.associations?.name ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{typeLabel[m.meeting_type] ?? m.meeting_type}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {date(m.start_time, 'long')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      {m.location ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-gray-400" />
                          {m.location}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center"><Badge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past Meetings */}
      {past.length > 0 && (
        <div>
          <SectionTitle title="Past" />
          <div className={card}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Meeting</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Location</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {past.map((m: any) => (
                  <tr key={m.id} className={row}>
                    <td className="px-4 py-3">
                      <Link href={`/board/meetings/${m.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">
                        {m.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{typeLabel[m.meeting_type] ?? m.meeting_type}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{date(m.start_time, 'long')}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">{m.location || '—'}</td>
                    <td className="px-4 py-3 text-center"><Badge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {all.length === 0 && (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <Calendar className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-semibold text-gray-900">No meetings found for your association</p>
          <p className="mt-1 text-sm text-gray-500">Meetings will appear here once scheduled by management.</p>
        </div>
      )}
    </div>
  )
}
