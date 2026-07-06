import { createClient } from '@/lib/supabase/server'
import { requireBoard } from '@/lib/auth/me'
import { date } from '@/lib/utils'
import { CalendarDays, Truck, Wrench } from 'lucide-react'

export const dynamic = 'force-dynamic'

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'

export default async function BoardCalendarPage() {
  const me = await requireBoard()
  const supabase = await createClient()
  const db = supabase as any
  const ids = me.board_association_ids ?? []
  const now = new Date().toISOString()
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString()

  const [{ data: events }, { data: meetings }, { data: tasks }] = await Promise.all([
    db.from('calendar_events')
      .select('id, title, event_type, start_datetime, end_datetime, location, public_notice_text, vendors(name)')
      .in('association_id', ids)
      .is('archived_at', null)
      .gte('start_datetime', now)
      .lte('start_datetime', in90)
      .order('start_datetime'),
    db.from('meetings')
      .select('id, title, meeting_type, start_time, location')
      .in('association_id', ids)
      .is('archived_at', null)
      .gte('start_time', now)
      .lte('start_time', in90)
      .order('start_time'),
    db.from('maintenance_tasks')
      .select('id, task_name, next_due_date, vendors(name)')
      .in('association_id', ids)
      .is('archived_at', null)
      .not('next_due_date', 'is', null)
      .lte('next_due_date', in90.slice(0, 10))
      .order('next_due_date'),
  ])

  type Item = { key: string; when: string; title: string; detail: string; kind: 'meeting' | 'vendor' | 'maintenance' | 'event' }
  const items: Item[] = [
    ...(meetings ?? []).map((m: any): Item => ({
      key: `m-${m.id}`, when: m.start_time, title: m.title,
      detail: `${(m.meeting_type ?? 'meeting').replace(/_/g, ' ')}${m.location ? ` · ${m.location}` : ''}`, kind: 'meeting',
    })),
    ...(events ?? []).map((e: any): Item => ({
      key: `e-${e.id}`, when: e.start_datetime, title: e.title,
      detail: e.vendors?.name ? `Vendor visit · ${e.vendors.name}` : (e.event_type ?? 'event').replace(/_/g, ' '),
      kind: e.vendors?.name ? 'vendor' : 'event',
    })),
    ...(tasks ?? []).map((t: any): Item => ({
      key: `t-${t.id}`, when: `${t.next_due_date}T12:00:00Z`, title: t.task_name,
      detail: t.vendors?.name ? `Maintenance · ${t.vendors.name}` : 'Preventive maintenance', kind: 'maintenance',
    })),
  ].sort((a, b) => a.when.localeCompare(b.when))

  const iconFor = { meeting: CalendarDays, vendor: Truck, maintenance: Wrench, event: CalendarDays } as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Association Calendar</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Meetings, vendor visits, inspections, and scheduled maintenance for the next 90 days
        </p>
      </div>

      <div className={card}>
        <div className="divide-y divide-gray-50">
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">Nothing scheduled in the next 90 days.</p>
          ) : (
            items.map((item) => {
              const Icon = iconFor[item.kind]
              return (
                <div key={item.key} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                    <Icon className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">{item.title}</div>
                    <div className="mt-0.5 truncate text-xs capitalize text-gray-500">{item.detail}</div>
                  </div>
                  <div className="shrink-0 text-[13px] tabular-nums text-gray-700">{date(item.when)}</div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
