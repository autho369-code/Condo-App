import { requireBoard } from '@/lib/auth/me'
import { getAssociationCalendarFeed } from '@/lib/calendar/association-feed'
import { AssociationCalendar } from '@/components/calendar/association-calendar'

export const dynamic = 'force-dynamic'

export default async function BoardCalendarPage() {
  const me = await requireBoard()

  // Same shared feed the owner portal renders — identical calendar for everyone.
  const items = await getAssociationCalendarFeed(me.board_association_ids ?? [])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Association Calendar</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Meetings, community events, vendor visits, and scheduled maintenance — next 90 days
        </p>
      </div>
      <AssociationCalendar items={items} />
    </div>
  )
}
