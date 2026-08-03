import { AssociationCalendar } from '@/components/calendar/association-calendar';
import { requireTenant } from '@/lib/auth/me';
import { getAssociationCalendarFeed } from '@/lib/calendar/association-feed';
import { PageHeader } from '@/components/ui/shell';

export const dynamic = 'force-dynamic';

export default async function ResidentCalendarPage() {
  const me = await requireTenant();
  const { items, timeZone } = await getAssociationCalendarFeed(me.tenant_association_ids ?? []);
  return (
    <div className="space-y-6">
      <PageHeader title="Community calendar" description="Meetings, events, vendor visits, and scheduled maintenance for your community." />
      <AssociationCalendar items={items} timeZone={timeZone} />
    </div>
  );
}
