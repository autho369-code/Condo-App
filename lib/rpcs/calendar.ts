'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import {
  DEFAULT_REMINDERS,
  defaultPublicNotice,
  defaultVendorConfirmation,
  eventTypeLabel,
  type CalendarEventType,
} from '@/lib/operations/calendar';
import { createClient } from '@/lib/supabase/server';
import { emailQueueRow, textToHtml } from '@/lib/email/queue';

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};

const req = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) throw new Error(`${k} is required`);
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
  const title = req(formData, 'title');
  const start = req(formData, 'start_datetime');
  const end = str(formData, 'end_datetime');
  const location = str(formData, 'location');
  const assocId = str(formData, 'association_id');
  const scope = str(formData, 'calendar_scope') === 'annual' ? 'annual' : 'daily';
  const publicNotice = str(formData, 'public_notice_text') ?? defaultPublicNotice(eventType, title, start, location);
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
  const reminderMinutes = selectedReminderMinutes.length ? selectedReminderMinutes : DEFAULT_REMINDERS[eventType] ?? [];
  const reminderRules = reminderMinutes.map((minutes) => ({ minutes_before: minutes, actions: reminderActions }));

  const { data: event, error } = await db.from('calendar_events').insert({
    portfolio_id: me.portfolio?.id,
    association_id: assocId,
    building_id: str(formData, 'building_id'),
    unit_id: str(formData, 'unit_id'),
    vendor_id: str(formData, 'vendor_id'),
    owner_id: str(formData, 'owner_id'),
    title,
    event_type: eventType,
    calendar_scope: scope,
    reminder_days_before: reminderMinutes.find((minutes) => minutes > 0)
      ? Math.max(1, Math.round(reminderMinutes.find((minutes) => minutes > 0)! / 1440))
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

  const startDate = new Date(start);
  const reminderRows = reminderMinutes.flatMap((minutes) => {
    const groups = recipientGroups.length ? recipientGroups : ['management_office'];
    return groups.map((group) => ({
      portfolio_id: me.portfolio?.id,
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
    await db.from('calendar_event_reminders').insert(reminderRows);
  }

  if (reminderActions.includes('create_email_draft') || reminderActions.includes('notify_affected_residents')) {
    await db.from('communication_messages').insert({
      portfolio_id: me.portfolio?.id,
      association_id: assocId,
      calendar_event_id: event.id,
      channel: 'email',
      status: 'draft',
      recipient_group: reminderActions.includes('notify_affected_residents') ? 'affected_residents' : 'management_office',
      subject: `${eventTypeLabel(eventType)}: ${title}`,
      body: publicNotice,
      created_by: me.auth_user_id,
    });
  }

  if (str(formData, 'vendor_id') || reminderActions.includes('notify_vendor')) {
    await db.from('communication_messages').insert({
      portfolio_id: me.portfolio?.id,
      association_id: assocId,
      calendar_event_id: event.id,
      channel: 'email',
      status: 'draft',
      recipient_group: 'vendor',
      subject: `Please confirm: ${title}`,
      body: defaultVendorConfirmation(eventType, title, start, location),
      created_by: me.auth_user_id,
    });
  }

  if (reminderActions.includes('create_follow_up_task')) {
    await db.from('automation_tasks').insert({
      portfolio_id: me.portfolio?.id,
      association_id: assocId,
      calendar_event_id: event.id,
      task_type: 'calendar_follow_up',
      title: `Confirm completion: ${title}`,
      description: 'Confirm the event was completed, capture notes, and send any required follow-up communication.',
      due_at: end ?? start,
      status: 'open',
      created_by: me.auth_user_id,
    });
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
  const { error } = await db.from('calendar_events')
    .update({ archived_at: new Date().toISOString(), operations_status: 'canceled' })
    .eq('id', eventId);
  if (error) return { error: error.message };
  revalidatePath('/calendar');
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
  const { error } = await db.from('calendar_events')
    .update({
      start_datetime: start,
      end_datetime: end,
      all_day: allDay,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);
  if (error) return { error: error.message };
  revalidatePath('/calendar');
}

export async function notifyOwnersOfUpcomingEvents(associationId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  if (!associationId) return { error: 'Association required' };

  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86_400_000);
  const { data: events } = await db
    .from('calendar_events')
    .select('id, title, start_datetime, location, associations(name)')
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
    `- ${e.title}: ${new Date(e.start_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}${e.location ? ` at ${e.location}` : ''}`
  )).join('\n')}\n\nPlease contact the management office with questions.`;

  // Resolve current owners of the association who have an email on file.
  const { data: occs } = await db
    .from('occupancies')
    .select('owners!owner_id(email, full_name)')
    .eq('association_id', associationId)
    .eq('occupancy_type', 'owner')
    .eq('status', 'current');

  const seen = new Set<string>();
  const recipients = (occs ?? [])
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
  const fromName = me.portfolio?.company_name ?? 'Portier369';

  // Log one communication_messages row per recipient (queued) and deliver via email_queue.
  const commRows = recipients.map((r: any) => ({
    association_id: associationId,
    portfolio_id: me.portfolio?.id,
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
  const { error: commErr } = await db.from('communication_messages').insert(commRows);
  if (commErr) return { error: commErr.message };

  const queueRows = recipients.map((r: any) => emailQueueRow({
    to: r.email,
    toName: r.name,
    subject,
    html,
    portfolioId: me.portfolio?.id,
    associationId,
    fromName,
    sentBy: me.auth_user_id,
  }));
  const { error: queueErr } = await db.from('email_queue').insert(queueRows);
  if (queueErr) return { error: `Logged but could not queue for delivery: ${queueErr.message}` };

  revalidatePath('/communication-center');
  return { ok: true, queued: recipients.length };
}

export async function acknowledgeReminder(eventId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const { error } = await db.from('calendar_events').update({
    reminder_acknowledged_at: new Date().toISOString(),
    reminder_acknowledged_by: me.auth_user_id,
  }).eq('id', eventId);
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  revalidatePath('/calendar');
}

export async function resendMaintenanceNotification(eventId: string) {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const { error } = await db.from('calendar_events')
    .update({ maintenance_notified_at: null, maintenance_notify_error: null })
    .eq('id', eventId);
  if (error) return { error: error.message };
  revalidatePath('/calendar');
}
