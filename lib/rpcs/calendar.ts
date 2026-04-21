'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const req = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) throw new Error(`${k} is required`);
  return v;
};

export async function createCalendarEvent(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const eventType  = str(formData, 'event_type') ?? 'other';
  const title      = req(formData, 'title');
  const start      = req(formData, 'start_datetime');
  const end        = str(formData, 'end_datetime');
  const allDay     = formData.get('all_day') === 'on';
  const location   = str(formData, 'location');
  const desc       = str(formData, 'description');
  const assocId    = str(formData, 'association_id');
  const notifyEmail  = formData.get('notify_maintenance') === 'on';
  const notifySms    = formData.get('notify_sms') === 'on';
  const instructions = str(formData, 'maintenance_instructions');
  const scope        = str(formData, 'calendar_scope') === 'annual' ? 'annual' : 'daily';

  // Reminder days — clamp to 1-30 if provided
  let reminderDays: number | null = null;
  const rdRaw = str(formData, 'reminder_days_before');
  if (rdRaw) {
    const n = parseInt(rdRaw, 10);
    if (!isNaN(n) && n >= 1 && n <= 30) reminderDays = n;
  }

  const { data: event, error } = await supabase.from('calendar_events').insert({
    portfolio_id:            me.portfolio?.id,
    association_id:          assocId,
    title,
    event_type:              eventType,
    calendar_scope:          scope,
    reminder_days_before:    reminderDays,
    start_datetime:          start,
    end_datetime:            end,
    all_day:                 allDay,
    location,
    description:             desc,
    notify_maintenance:      notifyEmail,
    notify_sms:              notifySms,
    maintenance_instructions: (notifyEmail || notifySms) ? instructions : null,
    created_by:              me.auth_user_id,
  }).select('id').single();

  if (error || !event) return { error: error?.message ?? 'Failed to create event' };

  revalidatePath('/calendar');
  if (assocId) revalidatePath(`/calendar?assoc=${assocId}`);

  if (formData.get('add_another') === '1') {
    redirect(assocId ? `/calendar/new?assoc=${assocId}` : '/calendar/new');
  }
  redirect(assocId ? `/calendar?assoc=${assocId}` : '/calendar');
}

export async function deleteCalendarEvent(eventId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from('calendar_events')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', eventId);
  if (error) return { error: error.message };
  revalidatePath('/calendar');
}

/**
 * Mark a reminder as acknowledged so it disappears from the dashboard banner.
 */
/**
 * Notify all owners with email for a given association about upcoming Property
 * Calendar events in the next 30 days. Queues one `notices` row per owner.
 * Actual email send happens via worker picking up notices.status = 'draft'.
 */
export async function notifyOwnersOfUpcomingEvents(associationId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  if (!associationId) return { error: 'Association required' };

  // Find upcoming annual events for this association (next 30 days)
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86_400_000);
  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, start_datetime, location, reminder_days_before, associations(name)')
    .eq('association_id', associationId)
    .eq('calendar_scope', 'annual')
    .is('archived_at', null)
    .gte('start_datetime', now.toISOString())
    .lte('start_datetime', horizon.toISOString())
    .order('start_datetime', { ascending: true });

  if (!events || events.length === 0) {
    return { error: 'No upcoming annual events in the next 30 days for this association' };
  }

  // Fetch owners of this association with an email on file
  const { data: occs } = await supabase
    .from('occupancies')
    .select('owner_id, owners!owner_id(id, full_name, first_name, last_name, email)')
    .eq('association_id', associationId)
    .eq('status', 'current');

  const ownersWithEmail = Array.from(new Map(
    (occs ?? [])
      .map((o: any) => o.owners)
      .filter((ownr: any) => ownr && ownr.email)
      .map((ownr: any) => [ownr.id, ownr])
  ).values());

  if (ownersWithEmail.length === 0) {
    return { error: 'No owners with email on file for this association' };
  }

  // Build one notice per owner — subject lists events + due dates
  const subject = `Upcoming maintenance at ${(events[0] as any).associations?.name ?? 'your building'}`;
  const body =
    `Heads up on scheduled maintenance / inspections in the next 30 days:\n\n` +
    (events as any[]).map((e) =>
      `• ${e.title} — ${new Date(e.start_datetime).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
      + (e.location ? ` @ ${e.location}` : '')
    ).join('\n') +
    `\n\nPlease plan accordingly. Contact the property manager with any questions.`;

  const rows = ownersWithEmail.map((ownr: any) => ({
    association_id: associationId,
    notice_type:    'maintenance_update',
    status:         'draft',
    channel:        'email',
    subject,
    body,
    send_to:        ownr.email,
    created_by:     me.auth_user_id,
  }));

  const { error, count } = await supabase.from('notices').insert(rows, { count: 'exact' });
  if (error) return { error: error.message };

  revalidatePath('/calendar');
  return { ok: true, queued: count ?? rows.length, owners: ownersWithEmail.length };
}

export async function acknowledgeReminder(eventId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from('calendar_events').update({
    reminder_acknowledged_at: new Date().toISOString(),
    reminder_acknowledged_by: me.auth_user_id,
  }).eq('id', eventId);
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  revalidatePath('/calendar');
}

/**
 * Resend a pending maintenance notification — re-triggers the DB-side webhook
 * by flipping the row, which re-runs dispatch_calendar_maintenance_notify.
 */
export async function resendMaintenanceNotification(eventId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from('calendar_events')
    .update({ maintenance_notified_at: null, maintenance_notify_error: null })
    .eq('id', eventId);
  if (error) return { error: error.message };
  revalidatePath('/calendar');
}
