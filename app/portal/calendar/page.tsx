import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth/me'
import { getAssociationCalendarFeed } from '@/lib/calendar/association-feed'
import { AssociationCalendar } from '@/components/calendar/association-calendar'

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
      .eq('owner_id', me.owner_id)
    assocIds = Array.from(new Set((occs ?? []).map((o: any) => o.association_id).filter(Boolean))) as string[]
  }

  // Same shared feed the board portal renders — identical calendar for everyone.
  const items = await getAssociationCalendarFeed(assocIds)

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
