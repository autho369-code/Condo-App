import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { EVENT_TYPES, DEFAULT_REMINDERS, REMINDER_ACTIONS, eventTypeLabel, reminderLabel } from '@/lib/operations/calendar';
import { createCalendarEvent } from '@/lib/rpcs/calendar';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { ContextPanel, PanelSection } from '@/components/workspace/context-panel';

export const dynamic = 'force-dynamic';

export default async function NewCalendarEventPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; type?: string; start?: string; scope?: string; title?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const eventType = EVENT_TYPES.some((type) => type.value === sp.type) ? sp.type! : 'water_shutoff';
  const defaultStart = sp.start ? `${sp.start}T09:00` : '';

  const [{ data: associations }, { data: vendors }, { data: owners }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('vendors').select('id, name, email, phone').is('archived_at', null).order('name').limit(200),
    db.from('owners').select('id, full_name, email, phone').is('archived_at', null).order('full_name').limit(200),
  ]);

  const reminders = DEFAULT_REMINDERS[eventType as keyof typeof DEFAULT_REMINDERS] ?? [];

  return (
    <div className="flex h-full">
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-6">
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <nav className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Link href="/calendar" className="hover:text-brand-600">Calendar</Link>
                <span className="mx-2">/</span>
                New Event
              </nav>
              <h1 className="text-2xl font-semibold text-gray-900">Create association calendar event</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Schedule the event once, then generate reminders, owner notices, vendor confirmations, and follow-up work from the same record.
              </p>
            </div>
            <Link href="/calendar">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
          </div>

          <form id="calendar-event-form" action={createCalendarEvent as any} className="space-y-6">
            <input type="hidden" name="calendar_scope" value={sp.scope === 'annual' ? 'annual' : 'daily'} />

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Event details</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="association_id">Association</Label>
                <select id="association_id" name="association_id" required defaultValue={sp.assoc ?? ''} className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Select association</option>
                  {(associations ?? []).map((association: any) => (
                    <option key={association.id} value={association.id}>{association.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="event_type">Event type</Label>
                <select id="event_type" name="event_type" defaultValue={eventType} className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required defaultValue={sp.title ?? eventTypeLabel(eventType)} />
              </div>

              <div>
                <Label htmlFor="start_datetime">Start date/time</Label>
                <Input id="start_datetime" name="start_datetime" type="datetime-local" required defaultValue={defaultStart} />
              </div>

              <div>
                <Label htmlFor="end_datetime">End date/time</Label>
                <Input id="end_datetime" name="end_datetime" type="datetime-local" />
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" placeholder="Lobby, roof, Unit 3B, west riser" />
              </div>

              <div>
                <Label htmlFor="unit_id">Building / unit</Label>
                <Input id="unit_id" name="unit_id" placeholder="Optional unit id for now" />
              </div>

              <div>
                <Label htmlFor="vendor_id">Vendor</Label>
                <select id="vendor_id" name="vendor_id" defaultValue="" className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Not applicable</option>
                  {(vendors ?? []).map((vendor: any) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="owner_id">Owner / resident</Label>
                <select id="owner_id" name="owner_id" defaultValue="" className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Not applicable</option>
                  {(owners ?? []).map((owner: any) => (
                    <option key={owner.id} value={owner.id}>{owner.full_name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="all_day" />
                All day
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Notice and internal instructions</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="description">Short calendar description</Label>
                <textarea id="description" name="description" rows={3} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
              </div>

              <div>
                <Label htmlFor="public_notice_text">Public notice text</Label>
                <textarea id="public_notice_text" name="public_notice_text" rows={5} placeholder="Leave blank and the system will draft one from the event details." className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
              </div>

              <div>
                <Label htmlFor="maintenance_instructions">Vendor / maintenance confirmation notes</Label>
                <textarea id="maintenance_instructions" name="maintenance_instructions" rows={4} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
              </div>

              <div>
                <Label htmlFor="internal_notes">Internal notes</Label>
                <textarea id="internal_notes" name="internal_notes" rows={4} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
              </div>
            </div>
          </section>
          </form>
        </div>
      </main>

      <ContextPanel title="Tasks">
        <PanelSection title="Default Reminders">
          {reminders.length ? reminders.map((minutes) => (
            <li key={minutes}>
              <label className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
                <input form="calendar-event-form" type="checkbox" name="reminder_minutes" value={minutes} defaultChecked />
                {reminderLabel(minutes)}
              </label>
            </li>
          )) : (
            <li className="text-sm text-gray-500">No default reminders. Add this event, then customize reminders in Automation Center.</li>
          )}
        </PanelSection>

        <PanelSection title="Automation Actions">
          {REMINDER_ACTIONS.map((action) => (
            <li key={action.value}>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input form="calendar-event-form" type="checkbox" name={action.value} defaultChecked={['create_email_draft', 'create_follow_up_task'].includes(action.value)} className="mt-1" />
                <span>{action.label}</span>
              </label>
            </li>
          ))}
          <li>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input form="calendar-event-form" type="checkbox" name="notify_sms" className="mt-1" />
              <span>Also prepare SMS text where phone numbers exist</span>
            </label>
          </li>
        </PanelSection>

        <PanelSection title="Recipient Groups">
          <li><label className="flex items-center gap-2 text-sm"><input form="calendar-event-form" type="checkbox" name="recipient_management" defaultChecked /> Management office</label></li>
          <li><label className="flex items-center gap-2 text-sm"><input form="calendar-event-form" type="checkbox" name="recipient_board" /> Board</label></li>
          <li><label className="flex items-center gap-2 text-sm"><input form="calendar-event-form" type="checkbox" name="recipient_vendor" /> Vendor</label></li>
          <li><label className="flex items-center gap-2 text-sm"><input form="calendar-event-form" type="checkbox" name="recipient_residents" defaultChecked /> Affected owners/residents</label></li>
        </PanelSection>

        <PanelSection title="Actions">
          <li>
            <Button form="calendar-event-form" type="submit" className="w-full">Create event</Button>
          </li>
          <li>
            <button form="calendar-event-form" type="submit" name="add_another" value="1" className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Add another
            </button>
          </li>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}
