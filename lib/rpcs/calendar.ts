'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import {
  DEFAULT_REMINDERS,
  EVENT_TYPES,
  defaultPublicNotice,
  defaultVendorConfirmation,
  eventTypeLabel,
  type CalendarEventType,
} from '@/lib/operations/calendar';
import { createClient } from '@/lib/supabase/server';
import { emailQueueRow, textToHtml } from '@/lib/email/queue';
import { wallDateTimeToIso } from '@/lib/time/zoned';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { checkLinkedRecords, managesAssociation } from '@/lib/security/association-scope';

const DEFAULT_TIME_ZONE = 'America/Chicago';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};

// Required field: a missing value redirects back through the action's
// failTo (never throws to the error page from a plain <form action>).
const req = (f: FormData, k: string, label: string, failTo: (msg: string) => void): string => {
  const v = str(f, k);
  if (!v) {
    failTo(`Enter ${label}.`);
    throw new Error(`${k} is required`); // unreachable: failTo redirects
  }
  return v;
};

const actionNames = [
  'notify_management_office',
  'notify_board',
  'notify_vendor',
  'notify_affected_residents',
  'create_posting_notice',
  'create_email_draft',
  'create_follow_up_task',
];

async function associationTimeZone(db: any, associationId: string | null | undefined): Promise<string> {
  if (!associationId) return DEFAULT_TIME_ZONE;
  const { data } = await db.from('associations').select('timezone').eq('id', associationId).maybeSingle();
  return data?.timezone || DEFAULT_TIME_ZONE;
}

export async function createCalendarEvent(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const failTo = (msg: string) => {
    const back = str(formData, 'association_id');
    redirect(`/calendar/new?${back ? `assoc=${back}&` : ''}error=${encodeURIComponent(msg)}`);
  };

  if (!me.portfolio?.id) {
    failTo('Your account is not linked to a portfolio. Ask an administrator to assign your profile to a portfolio, then try again.');
  }

  const eventType = (str(formData, 'event_type') ?? 'custom_event') as CalendarEventType;
  const title = req(formData, 'title', 'a title', failTo);
  const location = str(formData, 'location');
  const assocId = str(formData, 'association_id');
  // RLS on calendar_events only checks portfolio_id: an event pointed at
  // another company's association would reach its residents, board and
  // maintenance contact (the notify triggers are SECURITY DEFINER).
  if (assocId && !(await managesAssociation(db, assocId))) {
    failTo('That association is unavailable or outside your access.');
    return;
  }
  // The event belongs to its association's company (a platform operator's own
  // workspace is not the client's), as maintenance calendar events do.
  let eventPortfolioId: string | null | undefined = me.portfolio?.id;
  if (assocId) {
    const { data: association } = await db.from('associations').select('portfolio_id').eq('id', assocId).maybeSingle();
    if (!association?.portfolio_id) { failTo('That association is unavailable or outside your access.'); return; }
    eventPortfolioId = association.portfolio_id;
  }
  const linkError = await checkLinkedRecords(db, {
    associationId: assocId,
    portfolioId: eventPortfolioId,
    buildingId: str(formData, 'building_id'),
    unitId: str(formData, 'unit_id'),
    vendorId: str(formData, 'vendor_id'),
    ownerId: str(formData, 'owner_id'),
  });
  if (linkError) { failTo(linkError); return; }
  // datetime-local values carry no zone; the server runs in UTC, so "9:00"
  // was stored as 9:00 UTC (4–5 AM in the US). Read them in the community's zone.
  const timeZone = await associationTimeZone(db, assocId);
  const start = wallDateTimeToIso(req(formData, 'start_datetime', 'a start date and time', failTo), timeZone);
  if (!start) { failTo('Enter a valid start date and time.'); return; }
  const endRaw = str(formData, 'end_datetime');
  const end = endRaw ? wallDateTimeToIso(endRaw, timeZone) : null;
  if (endRaw && !end) { failTo('Enter a valid end date and time.'); return; }
  if (end && end < start) { failTo('The end time must be after the start time.'); return; }
  const scope = str(formData, 'calendar_scope') === 'annual' ? 'annual' : 'daily';
  const publicNotice = str(formData, 'public_notice_text') ?? defaultPublicNotice(eventType, title, start, location, timeZone);
  const reminderActions = actionNames.filter((action) => formData.get(action) === 'on');
  const recipientGroups = [
    formData.get('recipient_management') === 'on' ? 'management_office' : null,
    formData.get('recipient_board') === 'on' ? 'board' : null,
    formData.get('recipient_vendor') === 'on' ? 'vendor' : null,
    formData.get('recipient_residents') === 'on' ? 'affected_residents' : null,
  ].filter(Boolean) as string[];

  const selectedReminderMinutes = (formData.getAll('reminder_minutes') as string[])
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= 0);
  // Defaults apply only when the form did not offer reminder choices; if the
  // user unticked every box they asked for no reminders.
  const reminderMinutes = formData.get('reminders_submitted') === '1'
    ? selectedReminderMinutes
    : selectedReminderMinutes.length ? selectedReminderMinutes : DEFAULT_REMINDERS[eventType] ?? [];
  const reminderRules = reminderMinutes.map((minutes) => ({ minutes_before: minutes, actions: reminderActions }));

  const { data: event, error } = await db.from('calendar_events').insert({
    portfolio_id: eventPortfolioId,
    association_id: assocId,
    building_id: str(formData, 'building_id'),
    unit_id: str(formData, 'unit_id'),
    vendor_id: str(formData, 'vendor_id'),
    owner_id: str(formData, 'owner_id'),
    title,
    event_type: eventType,
    calendar_scope: scope,
    reminder_days_before: reminderMinutes.find((minutes) => minutes > 0)
      // calendar_events_reminder_days_before_check allows 1–30 days; the
      // insurance/contract defaults (60/90 days) used to violate it.
      ? Math.min(30, Math.max(1, Math.round(reminderMinutes.find((minutes) => minutes > 0)! / 1440)))
      : null,
    start_datetime: start,
    end_datetime: end,
    all_day: formData.get('all_day') === 'on',
    location,
    description: str(formData, 'description'),
    internal_notes: str(formData, 'internal_notes'),
    public_notice_text: publicNotice,
    notification_recipients: recipientGroups,
    reminder_rules: reminderRules,
    operations_status: 'scheduled',
    notify_maintenance: reminderActions.includes('notify_management_office') || reminderActions.includes('notify_vendor'),
    notify_sms: formData.get('notify_sms') === 'on',
    maintenance_instructions: str(formData, 'maintenance_instructions'),
    created_by: me.auth_user_id,
  }).select('id').single();

  if (error || !event) {
    failTo(error?.message ?? 'Failed to create event');
    return;
  }

  // The event exists from here on: a failed follow-up write sends the user to
  // the event (not back to the new-event form, which would invite a duplicate).
  const failAfterCreate = (what: string, message: string) => {
    redirect(`/calendar/${event.id}?error=${encodeURIComponent(`The event was created, but ${what} could not be saved: ${message}`)}`);
  };

  const startDate = new Date(start);
  const reminderRows = reminderMinutes.flatMap((minutes) => {
    const groups = recipientGroups.length ? recipientGroups : ['management_office'];
    return groups.map((group) => ({
      portfolio_id: eventPortfolioId,
      association_id: assocId,
      calendar_event_id: event.id,
      offset_minutes: minutes,
      remind_at: new Date(startDate.getTime() - minutes * 60_000).toISOString(),
      recipient_group: group,
      action: reminderActions.join(',') || 'notify_management_office',
      status: 'scheduled',
      created_by: me.auth_user_id,
    }));
  });

  if (reminderRows.length) {
    const { error: reminderError } = await db.from('calendar_event_reminders').insert(reminderRows);
    if (reminderError) { failAfterCreate('its reminders', reminderError.message); return; }
  }

  if (reminderActions.includes('create_email_draft') || reminderActions.includes('notify_affected_residents')) {
    const { error: draftError } = await db.from('communication_messages').insert({
      portfolio_id: eventPortfolioId,
      association_id: assocId,
      calendar_event_id: event.id,
      channel: 'email',
      status: 'draft',
      recipient_group: reminderActions.includes('notify_affected_residents') ? 'affected_residents' : 'management_office',
      subject: `${eventTypeLabel(eventType)}: ${title}`,
      body: publicNotice,
      created_by: me.auth_user_id,
    });
    if (draftError) { failAfterCreate('the resident notice draft', draftError.message); return; }
  }

  if (str(formData, 'vendor_id') || reminderActions.includes('notify_vendor')) {
    const { error: vendorDraftError } = await db.from('communication_messages').insert({
      portfolio_id: eventPortfolioId,
      association_id: assocId,
      calendar_event_id: event.id,
      channel: 'email',
      status: 'draft',
      recipient_group: 'vendor',
      subject: `Please confirm: ${title}`,
      body: defaultVendorConfirmation(eventType, title, start, location, timeZone),
      created_by: me.auth_user_id,
    });
    if (vendorDraftError) { failAfterCreate('the vendor confirmation draft', vendorDraftError.message); return; }
  }

  if (reminderActions.includes('create_follow_up_task')) {
    const { error: taskError } = await db.from('automation_tasks').insert({
      portfolio_id: eventPortfolioId,
      association_id: assocId,
      calendar_event_id: event.id,
      task_type: 'calendar_follow_up',
      title: `Confirm completion: ${title}`,
      description: 'Confirm the event was completed, capture notes, and send any required follow-up communication.',
      due_at: end ?? start,
      status: 'open',
      created_by: me.auth_user_id,
    });
    if (taskError) { failAfterCreate('its follow-up task', taskError.message); return; }
  }

  revalidatePath('/calendar');
  revalidatePath('/automation-center');
  revalidatePath('/communication-center');

  if (formData.get('add_another') === '1') {
    redirect(assocId ? `/calendar/new?assoc=${assocId}` : '/calendar/new');
  }
  redirect(assocId ? `/calendar?assoc=${assocId}` : '/calendar');
}

export async function deleteCalendarEvent(eventId: string) {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const { data: canceled, error } = await db.from('calendar_events')
    .update({ archived_at: new Date().toISOString(), operations_status: 'canceled' })
    .eq('id', eventId)
    .select('id');
  if (error) return { error: error.message };
  if (!canceled || canceled.length === 0) return { error: 'Event not found or you do not have access to it.' };
  // Reminders for a canceled event must not fire.
  const { error: reminderError } = await db.from('calendar_event_reminders').update({ status: 'canceled' }).eq('calendar_event_id', eventId).eq('status', 'scheduled');
  revalidatePath('/calendar');
  if (reminderError) return { error: `Event cancelled, but its reminders were not: ${reminderError.message}` };
}

/** Form action: cancel an event from its detail page. */
export async function cancelCalendarEvent(formData: FormData) {
  const eventId = str(formData, 'event_id');
  if (!eventId || !UUID_RE.test(eventId)) redirect('/calendar?error=' + encodeURIComponent('Event not found.'));
  const result = await deleteCalendarEvent(eventId!);
  if (result?.error) redirect(`/calendar/${eventId}?error=${encodeURIComponent(result.error)}`);
  redirect('/calendar');
}

/** Move scheduled (not yet sent) reminders along with the event's new start. */
/**
 * Move an event's scheduled reminders with it. Returns an error message when
 * any reminder could not be read or moved (it would still fire at the old
 * time), else null; callers say the event moved but its reminders did not.
 */
async function rescheduleReminders(db: any, eventId: string, startIso: string): Promise<string | null> {
  const { data: reminders, error: loadError } = await db.from('calendar_event_reminders')
    .select('id, offset_minutes').eq('calendar_event_id', eventId).eq('status', 'scheduled');
  if (loadError) return loadError.message;
  const start = new Date(startIso).getTime();
  let failed = 0;
  for (const r of reminders ?? []) {
    const { data: moved, error } = await db.from('calendar_event_reminders')
      .update({ remind_at: new Date(start - Number(r.offset_minutes ?? 0) * 60_000).toISOString() })
      .eq('id', r.id)
      .eq('status', 'scheduled')
      .select('id');
    if (error || !moved?.length) failed++;
  }
  return failed ? `${failed} of ${(reminders ?? []).length} reminders could not be moved` : null;
}

/** Form action: edit an event's details from its detail page. */
export async function updateCalendarEvent(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const eventId = str(formData, 'event_id');
  if (!eventId || !UUID_RE.test(eventId)) redirect('/calendar?error=' + encodeURIComponent('Event not found.'));
  const failTo = (msg: string): never => redirect(`/calendar/${eventId}?error=${encodeURIComponent(msg)}`);

  const { data: existing } = await db.from('calendar_events')
    .select('id, association_id, start_datetime').eq('id', eventId).is('archived_at', null).maybeSingle();
  if (!existing) failTo('Event not found or you do not have access to it.');

  const title = str(formData, 'title');
  if (!title) failTo('Enter a title.');
  const eventType = str(formData, 'event_type') as CalendarEventType | null;
  if (!eventType || !EVENT_TYPES.some((t) => t.value === eventType)) failTo('Choose an event type.');
  const allDay = formData.get('all_day') === 'on';
  const timeZone = await associationTimeZone(db, existing.association_id);
  const start = wallDateTimeToIso(str(formData, 'start_datetime'), timeZone);
  if (!start) failTo('Enter a valid start date and time.');
  const endRaw = str(formData, 'end_datetime');
  const end = endRaw ? wallDateTimeToIso(endRaw, timeZone) : null;
  if (endRaw && !end) failTo('Enter a valid end date and time.');
  if (end && end < start!) failTo('The end time must be after the start time.');

  const { data: updated, error } = await db.from('calendar_events')
    .update({
      title,
      event_type: eventType,
      start_datetime: start,
      end_datetime: end,
      all_day: allDay,
      location: str(formData, 'location'),
      description: str(formData, 'description'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select('id');
  if (error) failTo(error.message);
  if (!updated || updated.length === 0) failTo('Event not found or you do not have access to it.');
  // Internal notes live in the staff-only calendar_event_private table; write
  // the submitted value (including an empty one) there so clearing works.
  const { error: notesError } = await db.from('calendar_event_private').upsert({
    calendar_event_id: eventId,
    internal_notes: str(formData, 'internal_notes'),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'calendar_event_id' });
  if (notesError) { revalidatePath('/calendar'); failTo(`Event saved, but the internal notes could not be saved: ${notesError.message}`); }
  if (new Date(start!).getTime() !== new Date(existing.start_datetime).getTime()) {
    const reminderError = await rescheduleReminders(db, eventId!, start!);
    if (reminderError) revalidatePath('/calendar');
    if (reminderError) failTo(`Event saved, but its reminders still use the old time (${reminderError}). Edit the reminders or move the event again.`);
  }
  revalidatePath('/calendar');
  redirect(`/calendar/${eventId}?saved=1`);
}

/** Events for the range the calendar is showing (any month, not a fixed window). */
export async function listCalendarEvents(startIso: string, endIso: string, assocId: string, eventType: string) {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { events: [], truncated: false, error: 'Invalid date range.' };
  const result = await fetchAllRows<any>(() => {
    let q = db.from('calendar_events')
      .select('id, title, event_type, start_datetime, end_datetime, all_day, location, operations_status, associations(name)')
      .is('archived_at', null)
      // Overlaps the range: starts before its end and ends (or starts) after its start.
      .lt('start_datetime', end.toISOString())
      .or(`end_datetime.gte.${start.toISOString()},and(end_datetime.is.null,start_datetime.gte.${start.toISOString()})`);
    if (assocId && UUID_RE.test(assocId)) q = q.eq('association_id', assocId);
    if (eventType && EVENT_TYPES.some((t) => t.value === eventType)) q = q.eq('event_type', eventType);
    return q.order('start_datetime').order('id');
  }, { maxRows: 5000 });
  return {
    events: result.rows.map((e: any) => ({
      id: e.id, title: e.title, start_datetime: e.start_datetime, end_datetime: e.end_datetime, all_day: e.all_day,
      event_type: e.event_type, location: e.location, operations_status: e.operations_status,
      association_name: e.associations?.name ?? null,
    })),
    truncated: result.truncated,
    error: result.error,
  };
}

export async function updateCalendarEventDates(
  eventId: string,
  start: string,
  end: string | null,
  allDay: boolean,
) {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const { data: existing } = await db.from('calendar_events').select('id, association_id').eq('id', eventId).maybeSingle();
  if (!existing) return { error: 'Event not found or you do not have access to it.' };
  // All-day drops arrive as bare dates; anchor them to the community's midnight.
  const timeZone = await associationTimeZone(db, existing.association_id);
  const startIso = wallDateTimeToIso(start, timeZone);
  if (!startIso) return { error: 'Invalid start date.' };
  const endIso = end ? wallDateTimeToIso(end, timeZone) : null;
  const { data: moved, error } = await db.from('calendar_events')
    .update({
      start_datetime: startIso,
      end_datetime: endIso,
      all_day: allDay,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select('id');
  if (error) return { error: error.message };
  if (!moved || moved.length === 0) return { error: 'Event not found or you do not have access to it.' };
  const reminderError = await rescheduleReminders(db, eventId, startIso);
  revalidatePath('/calendar');
  // The event did move: a warning, not an error (the grid keeps the new spot).
  if (reminderError) return { warning: `Event moved, but its reminders still use the old time (${reminderError}). Move it again or edit the reminders.` };
}

export async function notifyOwnersOfUpcomingEvents(associationId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  if (!associationId) return { error: 'Association required' };
  if (!(await managesAssociation(db, associationId))) return { error: 'That association is unavailable or outside your access.' };
  const timeZone = await associationTimeZone(db, associationId);

  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86_400_000);
  const { data: events } = await db
    .from('calendar_events')
    .select('id, title, start_datetime, location, associations(name, portfolio_id)')
    .eq('association_id', associationId)
    .is('archived_at', null)
    .gte('start_datetime', now.toISOString())
    .lte('start_datetime', horizon.toISOString())
    .order('start_datetime', { ascending: true });

  if (!events || events.length === 0) {
    return { error: 'No upcoming events in the next 30 days for this association' };
  }

  const subject = `Upcoming events at ${(events[0] as any).associations?.name ?? 'your association'}`;
  const body = `Upcoming scheduled events:\n\n${(events as any[]).map((e) => (
    `- ${e.title}: ${new Date(e.start_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone })}${e.location ? ` at ${e.location}` : ''}`
  )).join('\n')}\n\nPlease contact the management office with questions.`;

  // Resolve current owners of the association who have an email on file.
  // Paged past PostgREST's 1,000-row cap; a failed read sends nothing.
  const { rows: occs, error: occError } = await fetchAllRows<any>(() => db
    .from('occupancies')
    .select('id, owners!owner_id(email, full_name)')
    .eq('association_id', associationId)
    .eq('occupancy_type', 'owner')
    .eq('status', 'current')
    .order('id'));
  if (occError) return { error: `Could not load owners: ${occError}` };

  const seen = new Set<string>();
  const recipients = occs
    .map((o: any) => ({ email: o.owners?.email, name: o.owners?.full_name ?? '' }))
    .filter((r: any) => {
      if (!r.email) return false;
      const k = r.email.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  if (recipients.length === 0) {
    return { error: 'No owners with email addresses found for this association.' };
  }

  const html = textToHtml(body);
  // The notice belongs to the association's company, not the sender's (a
  // platform operator's workspace is not the client's). No sender name:
  // delivery brands it from that company's portfolio.
  const companyId: string | null = (events[0] as any).associations?.portfolio_id ?? null;
  if (!companyId) return { error: 'The association\'s company could not be loaded.' };
  const fromName = null;

  // Log one communication_messages row per recipient (queued) and deliver via email_queue.
  const commRows = recipients.map((r: any) => ({
    association_id: associationId,
    portfolio_id: companyId,
    calendar_event_id: (events[0] as any).id,
    channel: 'email',
    status: 'queued',
    recipient_group: 'affected_residents',
    recipient_email: r.email,
    recipient_name: r.name,
    subject,
    body,
    created_by: me.auth_user_id,
  }));
  const { data: insertedMessages, error: commErr } = await db.from('communication_messages').insert(commRows).select('id, recipient_email');
  if (commErr) return { error: commErr.message };
  // Link each queue row to its message so delivery updates its status.
  const messageIdByEmail = new Map<string, string>(
    (insertedMessages ?? []).map((m: { id: string; recipient_email: string }) => [String(m.recipient_email).toLowerCase(), m.id]),
  );

  const queueRows = recipients.map((r: any) => emailQueueRow({
    to: r.email,
    toName: r.name,
    subject,
    html,
    portfolioId: companyId,
    associationId,
    communicationMessageId: messageIdByEmail.get(String(r.email).toLowerCase()) ?? null,
    fromName,
    sentBy: me.auth_user_id,
  }));
  const { error: queueErr } = await db.from('email_queue').insert(queueRows);
  if (queueErr) return { error: `Logged but could not queue for delivery: ${queueErr.message}` };

  revalidatePath('/communication-center');
  return { ok: true, queued: recipients.length };
}
