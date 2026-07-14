import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { Calendar, MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OwnerCalendarPage() {
  const me = await requireOwner()
  const supabase = await createClient()
  const db = supabase as any

  const { data: occs } = await db.from('occupancies').select('association_id').eq('owner_id', me.owner_id).limit(1)
  const assocId = occs?.[0]?.association_id

  let events: any[] = []
  if (assocId) {
    // Community events + scheduled board activity (meetings) on one calendar.
    const [{ data: ev }, { data: mtgs }] = await Promise.all([
      db.from('calendar_events')
        .select('id, title, start_datetime, location, description')
        .eq('association_id', assocId)
        .is('archived_at', null)
        .order('start_datetime', { ascending: true }).limit(100),
      db.from('meetings')
        .select('id, title, meeting_type, start_time, location')
        .eq('association_id', assocId)
        .eq('status', 'scheduled')
        .is('archived_at', null)
        .order('start_time', { ascending: true }).limit(100),
    ])
    events = [
      ...(ev ?? []),
      ...(mtgs ?? []).map((m: any) => ({
        id: `meeting-${m.id}`,
        title: m.title,
        start_datetime: m.start_time,
        location: m.location,
        description: `${(m.meeting_type ?? 'board').replace(/_/g, ' ')} meeting`,
      })),
    ].sort((a: any, b: any) => String(a.start_datetime).localeCompare(String(b.start_datetime)))
  }

  // Group by month
  const grouped: Record<string, any[]> = {}
  for (const e of events) {
    const key = new Date(e.start_datetime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(e)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Association Calendar</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Board meetings, community events, and important dates</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No upcoming events scheduled.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, evts]) => (
            <div key={month}>
              <h2 className="mb-4 border-b border-gray-200 pb-2 text-[15px] font-semibold tracking-[-0.01em] text-gray-950">{month}</h2>
              <div className="space-y-2">
                {evts.map((e: any) => {
                  const d = new Date(e.start_datetime)
                  const day = d.getDate()
                  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
                  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  return (
                    <div key={e.id} className="flex items-start gap-4 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-gray-300">
                      <div className="w-14 flex-shrink-0 text-center">
                        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{weekday}</div>
                        <div className="text-2xl font-semibold tabular-nums text-blue-600">{day}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{e.title}</div>
                        {e.description && <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">{e.description}</div>}
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {time}</span>
                          {e.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
