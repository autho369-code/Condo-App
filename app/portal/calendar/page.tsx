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
    const { data: ev } = await db.from('calendar_events')
      .select('id, title, start_datetime, location, description')
      .eq('association_id', assocId)
      .order('start_datetime', { ascending: true }).limit(100)
    events = ev ?? []
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
        <h1 className="text-2xl font-bold text-gray-900">Association Calendar</h1>
        <p className="text-sm text-gray-500">Board meetings, community events, and important dates</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-12 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No upcoming events scheduled.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, evts]) => (
            <div key={month}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">{month}</h2>
              <div className="space-y-2">
                {evts.map((e: any) => {
                  const d = new Date(e.start_datetime)
                  const day = d.getDate()
                  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
                  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  return (
                    <div key={e.id} className="flex items-start gap-4 rounded-lg bg-white border border-gray-200 shadow-sm p-4 hover:border-blue-200 transition">
                      <div className="flex-shrink-0 w-14 text-center">
                        <div className="text-xs font-medium text-gray-500 uppercase">{weekday}</div>
                        <div className="text-2xl font-bold text-blue-600">{day}</div>
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
