import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { getAssociationCalendarFeed } from '@/lib/calendar/association-feed'
import { AssociationCalendar } from '@/components/calendar/association-calendar'
import { Alert } from '@/components/ui/shell'

export const dynamic = 'force-dynamic'

export default async function OwnerCalendarPage() {
  const me = await requireOwner()

  // ALL of the owner's associations (not just the first occupancy).
  let assocIds: string[] = me.resident_association_ids ?? []
  if (assocIds.length === 0) {
    const supabase = await createClient()
    const { data: occs } = await (supabase as any)
      .from('occupancies')
      .select('association_id')
      .in('owner_id', me.owner_ids)
    assocIds = Array.from(new Set((occs ?? []).map((o: any) => o.association_id).filter(Boolean))) as string[]
  }

  // Same shared feed the board portal renders — identical calendar for everyone.
  const { items, timeZone, errors } = await getAssociationCalendarFeed(assocIds)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Association Calendar</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Meetings, community events, vendor visits, and scheduled maintenance — next 90 days
        </p>
      </div>
      {errors.map((msg) => <Alert key={msg} tone="danger">{msg}</Alert>)}
      <AssociationCalendar items={items} timeZone={timeZone} />
    </div>
  )
}
