import { AssociationCalendar } from '@/components/calendar/association-calendar';
import { requireTenant } from '@/lib/auth/me';
import { getAssociationCalendarFeed } from '@/lib/calendar/association-feed';
import { Alert, PageHeader } from '@/components/ui/shell';

export const dynamic = 'force-dynamic';

export default async function ResidentCalendarPage() {
  const me = await requireTenant();
  const { items, timeZone, errors } = await getAssociationCalendarFeed(me.tenant_association_ids ?? []);
  return (
    <div className="space-y-6">
      <PageHeader title="Community calendar" description="Meetings, events, vendor visits, and scheduled maintenance for your community." />
      {errors.map((msg) => <Alert key={msg} tone="danger">{msg}</Alert>)}
      <AssociationCalendar items={items} timeZone={timeZone} />
    </div>
  );
}
