import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert, Badge } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { EVENT_TYPES, eventTypeLabel } from '@/lib/operations/calendar';
import { cancelCalendarEvent, updateCalendarEvent } from '@/lib/rpcs/calendar';
import { createClient } from '@/lib/supabase/server';
import { formatInZone } from '@/lib/time/zoned';
import { isValidTimeZone } from '@/lib/time/display-zone';

export const dynamic = 'force-dynamic';

const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An instant as a datetime-local value ("YYYY-MM-DDTHH:mm") in the community's zone. */
function wallInput(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default async function CalendarEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: event } = await db.from('calendar_events')
    .select('id, title, event_type, start_datetime, end_datetime, all_day, location, description, internal_notes, operations_status, archived_at, association_id, associations(name, timezone), vendors(name)')
    .eq('id', id)
    .maybeSingle();
  if (!event) notFound();

  const zone = event.associations?.timezone && isValidTimeZone(event.associations.timezone) ? event.associations.timezone : 'America/Chicago';
  const canceled = Boolean(event.archived_at);
  const when = event.all_day
    ? `${new Date(event.start_datetime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: zone })} (all day)`
    : `${formatInZone(event.start_datetime, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }, zone)}${event.end_datetime ? ` – ${formatInZone(event.end_datetime, { hour: 'numeric', minute: '2-digit' }, zone)}` : ''}`;

  return (
    <DataWorkspace
      title={event.title}
      description={`${eventTypeLabel(event.event_type)}${event.associations?.name ? ` · ${event.associations.name}` : ''} · ${when}`}
      actions={<Link href={event.association_id ? `/calendar?assoc=${event.association_id}` : '/calendar'}><Button variant="secondary">Back to calendar</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not save the event">{sp.error}</Alert>}
        {sp.saved && !sp.error && <Alert tone="success" title="Event saved" />}
        {canceled && <Alert tone="warning" title="This event was canceled">It no longer appears on the calendar.</Alert>}

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <Badge>{canceled ? 'canceled' : event.operations_status ?? 'scheduled'}</Badge>
          {event.location && <span>Location: {event.location}</span>}
          {event.vendors?.name && <span>· Vendor: {event.vendors.name}</span>}
        </div>

        {!canceled && (
          <form action={updateCalendarEvent} className="space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <input type="hidden" name="event_id" value={event.id} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" required defaultValue={event.title} />
              </div>
              <div>
                <Label htmlFor="event_type">Event type</Label>
                <select id="event_type" name="event_type" defaultValue={event.event_type} className={inputCls}>
                  {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="start_datetime">Start <span className="text-red-500">*</span></Label>
                <Input id="start_datetime" name="start_datetime" type="datetime-local" required defaultValue={wallInput(event.start_datetime, zone)} />
              </div>
              <div>
                <Label htmlFor="end_datetime">End</Label>
                <Input id="end_datetime" name="end_datetime" type="datetime-local" defaultValue={wallInput(event.end_datetime, zone)} />
              </div>
              <label className="flex min-h-10 items-center gap-2 text-sm text-gray-800 md:col-span-2">
                <input type="checkbox" name="all_day" defaultChecked={event.all_day} className="h-4 w-4 rounded border-gray-300" />
                All day
              </label>
              <div className="md:col-span-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" defaultValue={event.location ?? ''} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea id="description" name="description" rows={4} defaultValue={event.description ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="internal_notes">Internal notes</Label>
                <textarea id="internal_notes" name="internal_notes" rows={3} defaultValue={event.internal_notes ?? ''} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <p className="text-xs text-gray-500">Times are in the association&apos;s time zone ({zone}). Scheduled reminders move with the start time.</p>
            <div className="flex justify-end border-t border-gray-100 pt-5">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        )}

        {!canceled && (
          <form action={cancelCalendarEvent} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <input type="hidden" name="event_id" value={event.id} />
            <p className="text-sm text-gray-600">Cancel this event and its pending reminders.</p>
            <Button type="submit" variant="secondary">Cancel event</Button>
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
