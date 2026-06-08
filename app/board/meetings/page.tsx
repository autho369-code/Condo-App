import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date, money } from '@/lib/utils'
import Link from 'next/link'
import { Calendar, MapPin, Users, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BoardMeetingsPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []

  const { data: meetings } = await db
    .from('meetings')
    .select('id, title, meeting_type, start_time, location, status, attendees, created_at, association_id, associations(name)')
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

  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      in_progress: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return m[s] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }

  const isUpcoming = (d: string | null) => {
    if (!d) return false
    return new Date(d) >= new Date()
  }

  const upcoming = all.filter((m: any) => isUpcoming(m.start_time) && m.status !== 'cancelled')
  const past = all.filter((m: any) => !isUpcoming(m.start_time) || m.status === 'completed')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Meetings</h1>
        <p className="mt-1 text-sm text-slate-400">Board and association meetings</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total', value: all.length, cls: 'text-white' },
          { label: 'Upcoming', value: upcoming.length, cls: 'text-blue-400' },
          { label: 'Completed', value: all.filter((m: any) => m.status === 'completed').length, cls: 'text-emerald-400' },
          { label: 'Cancelled', value: all.filter((m: any) => m.status === 'cancelled').length, cls: 'text-red-400' },
        ].map((s: any) => (
          <div key={s.label} className="rounded-xl border border-[#1E293B] p-4" style={{ backgroundColor: '#0B1121' }}>
            <div className="text-xs font-medium uppercase text-slate-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Upcoming Meetings */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-white">Upcoming</h2>
          <div className="rounded-xl border border-[#1E293B] overflow-hidden" style={{ backgroundColor: '#0B1121' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">Meeting</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Date & Time</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {upcoming.map((m: any) => (
                  <tr key={m.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/board/meetings/${m.id}`} className="font-medium text-slate-200 hover:text-emerald-400">
                        {m.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-600">{m.associations?.name ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{typeLabel[m.meeting_type] ?? m.meeting_type}</td>
                    <td className="px-4 py-3 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-600" />
                        {date(m.start_time, 'long')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {m.location ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-600" />
                          {m.location}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(m.status)}`}>
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>
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
          <h2 className="mb-3 text-lg font-semibold text-white">Past</h2>
          <div className="rounded-xl border border-[#1E293B] overflow-hidden" style={{ backgroundColor: '#0B1121' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E293B] text-xs uppercase text-slate-500">
                  <th className="px-4 py-3 text-left font-medium">Meeting</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Location</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {past.map((m: any) => (
                  <tr key={m.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/board/meetings/${m.id}`} className="font-medium text-slate-200 hover:text-emerald-400">
                        {m.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{typeLabel[m.meeting_type] ?? m.meeting_type}</td>
                    <td className="px-4 py-3 text-slate-400">{date(m.start_time, 'long')}</td>
                    <td className="px-4 py-3 text-slate-400">{m.location || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(m.status)}`}>
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {all.length === 0 && (
        <div className="rounded-xl border border-[#1E293B] p-12 text-center" style={{ backgroundColor: '#0B1121' }}>
          <Calendar className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-slate-500">No meetings found for your association.</p>
          <p className="mt-1 text-sm text-slate-600">Meetings will appear here once scheduled by management.</p>
        </div>
      )}
    </div>
  )
}
