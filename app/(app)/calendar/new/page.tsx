import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createCalendarEvent } from '@/lib/rpcs/calendar';
import { defaultMaintenanceInstructions } from '@/lib/calendar/templates';

export const dynamic = 'force-dynamic';

const ACTIVITY_TYPES: Array<{ value: string; label: string; notifyByDefault: boolean }> = [
  { value: 'elevator_reservation',    label: 'Elevator reservation',    notifyByDefault: true  },
  { value: 'move_in',                 label: 'Move-in',                 notifyByDefault: true  },
  { value: 'move_out',                label: 'Move-out',                notifyByDefault: true  },
  { value: 'water_shutoff',           label: 'Water shutoff',           notifyByDefault: true  },
  { value: 'vendor_work',             label: 'Vendor working on property', notifyByDefault: true },
  { value: 'common_area_reservation', label: 'Common-area reservation', notifyByDefault: true  },
  { value: 'board_meeting',           label: 'Board meeting',           notifyByDefault: false },
  { value: 'inspection',              label: 'Inspection',              notifyByDefault: true  },
  { value: 'announcements',           label: 'Announcement',            notifyByDefault: false },
  { value: 'other',                   label: 'Other (blank — describe below)', notifyByDefault: false },
];

export default async function NewCalendarEventPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; type?: string; start?: string; scope?: string; title?: string }>;
}) {
  await requireStaff();
  const { assoc, type, start, scope: scopeParam, title: titleParam } = await searchParams;
  const scope = scopeParam === 'annual' ? 'annual' : 'daily';
  // start = "YYYY-MM-DD" from a day-cell click → prefill start at 09:00 local
  const defaultStart = start ? `${start}T09:00` : '';
  const supabase = await createClient();

  const { data: associations } = await supabase
    .from('associations')
    .select('id, name, maintenance_contact_name, maintenance_contact_email, maintenance_contact_phone')
    .is('archived_at', null)
    .order('name');

  const preType  = ACTIVITY_TYPES.find((t) => t.value === type) ?? null;
  const preAssoc = assoc ? (associations ?? []).find((a: any) => a.id === assoc) : null;

  // Pre-fill the instructions based on activity type. User can edit before saving.
  const defaultInstructions = preType ? defaultMaintenanceInstructions(preType.value) : '';

  return (
    <div className="mx-auto max-w-3xl px-8 py-6 space-y-4">
      <nav className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Link href="/calendar" className="hover:text-brand-600">Calendar</Link> · New event
      </nav>
      <h1 className="text-2xl font-semibold text-gray-900">New calendar event</h1>
      <p className="text-sm text-gray-500">
        Pick an activity, fill in the description, and optionally email maintenance with the specific instructions they need
        (pads on elevator, COI check, water-shutoff notice, etc.).
      </p>

      <form action={createCalendarEvent} className="space-y-5 rounded border border-gray-200 bg-white p-5">
        {/* Hidden scope — determines which calendar (daily vs annual) this event lives on */}
        <input type="hidden" name="calendar_scope" value={scope} />

        {scope === 'annual' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Property / annual preventive event.</strong> Lives on the Property calendar.
            Use for fire pump tests, fire panel checks, extinguisher recerts, standpipe, elevator
            inspections, plumbing line cleaning, roof inspections, etc. Set an advance reminder
            below so the manager is notified before it's due.
          </div>
        )}

        {/* Scope */}
        <div>
          <Label htmlFor="association_id">Association</Label>
          <select
            id="association_id"
            name="association_id"
            defaultValue={assoc ?? ''}
            className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All associations (portfolio-wide)</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.maintenance_contact_email ? '' : ' — no maintenance email on file'}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Pick the association so maintenance notifications go to the right person.
            {preAssoc?.maintenance_contact_email
              ? <> Currently notifies <strong>{preAssoc.maintenance_contact_email}</strong>.</>
              : preAssoc ? <> This association has <strong>no maintenance email on file</strong> — <Link href={`/associations/${preAssoc.id}`} className="text-blue-700 hover:underline">add one here</Link>.</> : null}
          </p>
        </div>

        {/* Activity type */}
        <div>
          <Label htmlFor="event_type">Activity type</Label>
          <select
            id="event_type"
            name="event_type"
            defaultValue={preType?.value ?? ''}
            className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">— choose —</option>
            {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500">Don&apos;t see it? Pick <strong>Other</strong> and type it in.</p>
        </div>

        {/* Title */}
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={titleParam ?? ''} placeholder={preType ? `e.g. ${preType.label} — Unit 3B` : 'Short label that shows on the calendar'} />
        </div>

        {/* When */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="start_datetime">Starts</Label>
            <Input id="start_datetime" name="start_datetime" type="datetime-local" required defaultValue={defaultStart} />
          </div>
          <div>
            <Label htmlFor="end_datetime">Ends (optional)</Label>
            <Input id="end_datetime" name="end_datetime" type="datetime-local" />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="all_day" />
              All day
            </label>
          </div>
        </div>

        {/* Location */}
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="e.g. Lobby, Unit 3B, Roof, Pool deck" />
        </div>

        {/* Description (resident-facing) */}
        <div>
          <Label htmlFor="description">Description (shown on calendar)</Label>
          <textarea
            id="description" name="description" rows={3}
            placeholder="Short note that appears on the event card for anyone who can see it."
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Advance reminder — required for annual events, optional for daily */}
        <div>
          <Label htmlFor="reminder_days_before">
            Advance reminder {scope === 'annual' ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
          </Label>
          <div className="flex items-center gap-2">
            <input
              id="reminder_days_before"
              name="reminder_days_before"
              type="number"
              min={1}
              max={30}
              defaultValue={scope === 'annual' ? 14 : ''}
              required={scope === 'annual'}
              className="h-10 w-24 rounded border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-600">days before the event</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            A banner will show on the dashboard starting {scope === 'annual' ? '14 days' : 'N days'} before this event.
            Manager can dismiss it once. Range: 1–30 days.
          </p>
        </div>

        {/* Maintenance notification — email + SMS, each per-association */}
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 text-sm font-semibold text-gray-900">Notify maintenance</div>
          <p className="mb-3 text-xs text-gray-600">
            Each association has its own maintenance contact on file. The message below goes to that association&apos;s
            person only — different association, different recipient.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2 rounded border border-gray-200 bg-white p-3">
              <input
                type="checkbox"
                name="notify_maintenance"
                defaultChecked={preType?.notifyByDefault ?? false}
                className="mt-0.5"
              />
              <div className="flex-1 text-sm">
                <div className="font-medium text-gray-900">Email</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {preAssoc?.maintenance_contact_email ? preAssoc.maintenance_contact_email : 'association email on file'}
                </div>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-2 rounded border border-gray-200 bg-white p-3">
              <input
                type="checkbox"
                name="notify_sms"
                defaultChecked={false}
                className="mt-0.5"
              />
              <div className="flex-1 text-sm">
                <div className="font-medium text-gray-900">Text (SMS)</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {preAssoc?.maintenance_contact_phone ? preAssoc.maintenance_contact_phone : 'association phone on file'}
                </div>
              </div>
            </label>
          </div>

          <div className="mt-4">
            <Label htmlFor="maintenance_instructions">Instructions to maintenance</Label>
            <textarea
              id="maintenance_instructions"
              name="maintenance_instructions"
              rows={4}
              defaultValue={defaultInstructions}
              placeholder="Be specific — what to prepare, when, and who to coordinate with."
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Pre-filled with a template for this activity type. Edit freely.
              {preAssoc && !preAssoc.maintenance_contact_email && !preAssoc.maintenance_contact_phone && (
                <> <Link href={`/associations/${preAssoc.id}`} className="text-amber-700 hover:underline">This association has no maintenance contacts on file — add them →</Link></>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <Link href={`/calendar${assoc ? `?assoc=${assoc}` : ''}`} className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <div className="flex gap-2">
            <button
              type="submit"
              name="add_another"
              value="1"
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Save &amp; add another
            </button>
            <Button type="submit">Save event</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
