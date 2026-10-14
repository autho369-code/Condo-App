// THE residents' association calendar. The owner portal (/portal/calendar)
// and the tenant portal (/resident/calendar) render this same feed, so the
// two can never drift apart. Calendar events come from the
// resident_calendar_events RPC (resident-safe fields only; no events about
// other owners or units, and no internal management reminders such as
// insurance expirations, contract renewals or assessment deadlines); the
// board has no calendar-event access of its own.
import { createClient } from '@/lib/supabase/server';

export type AssociationCalendarItem = {
  key: string;
  when: string; // ISO datetime
  title: string;
  detail: string;
  location: string | null;
  kind: 'meeting' | 'vendor' | 'maintenance' | 'event';
};

export type AssociationCalendarFeed = {
  items: AssociationCalendarItem[];
  /** IANA timezone the calendar should render in (associations.timezone). */
  timeZone: string;
  /** Sources that failed to load — render them; never present a partial calendar as complete. */
  errors: string[];
};

const EVENT_LIMIT = 300;

export async function getAssociationCalendarFeed(
  associationIds: string[],
  days = 90,
): Promise<AssociationCalendarFeed> {
  const ids = (associationIds ?? []).filter(Boolean);
  if (ids.length === 0) return { items: [], timeZone: 'America/Chicago', errors: [] };

  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + days * 86400000).toISOString();

  const [
    { data: events, error: eventsError },
    { data: meetings, error: meetingsError },
    { data: tasks, error: tasksError },
    { data: assoc, error: assocError },
  ] = await Promise.all([
    // Residents read events through this RPC: safe fields only, no events
    // about other owners or units. The board has no calendar-event access.
    db.rpc('resident_calendar_events', {
      p_association_ids: ids,
      p_from: now,
      p_to: horizon,
      p_limit: EVENT_LIMIT + 1,
    }),
    db.from('meetings')
      .select('id, title, meeting_type, start_time, location')
      .in('association_id', ids)
      .is('archived_at', null)
      .in('status', ['scheduled', 'in_progress'])
      // Residents never see executive sessions, even when the login is also
      // a board member or staff.
      .neq('meeting_type', 'executive_session')
      .gte('start_time', now)
      .lte('start_time', horizon)
      .order('start_time'),
    db.from('maintenance_tasks')
      .select('id, task_name, next_due_date')
      .in('association_id', ids)
      .is('archived_at', null)
      .not('next_due_date', 'is', null)
      .gte('next_due_date', now.slice(0, 10))
      .lte('next_due_date', horizon.slice(0, 10))
      .order('next_due_date'),
    db.from('associations').select('timezone').in('id', ids).limit(1).maybeSingle(),
  ]);

  const errors = [
    eventsError && `Events and vendor visits could not be loaded: ${eventsError.message}`,
    meetingsError && `Meetings could not be loaded: ${meetingsError.message}`,
    tasksError && `Scheduled maintenance could not be loaded: ${tasksError.message}`,
    assocError && `Association time zone could not be loaded: ${assocError.message}`,
    (events ?? []).length > EVENT_LIMIT && `Showing the first ${EVENT_LIMIT} events in the next ${days} days.`,
  ].filter(Boolean) as string[];

  const items: AssociationCalendarItem[] = [
    ...(meetings ?? []).map((m: any): AssociationCalendarItem => ({
      key: `m-${m.id}`,
      when: m.start_time,
      title: m.title,
      detail: `${(m.meeting_type ?? 'meeting').replace(/_/g, ' ')}`,
      location: m.location ?? null,
      kind: 'meeting',
    })),
    ...(events ?? []).slice(0, EVENT_LIMIT).map((e: any): AssociationCalendarItem => {
      const typeLabel = (e.event_type ?? 'event').replace(/_/g, ' ');
      // Avoid "Water Shutoff / water shutoff" — when the type merely repeats
      // the title, describe the kind instead. Vendor names are hidden from
      // residents, so vendor_id decides the kind.
      const detail = e.vendor_id
          ? 'Vendor visit'
          : typeLabel.toLowerCase() === String(e.title ?? '').toLowerCase()
            ? 'Community event'
            : typeLabel;
      return {
        key: `e-${e.id}`,
        when: e.start_datetime,
        title: e.title,
        detail,
        location: e.location ?? null,
        kind: e.vendor_id ? 'vendor' : 'event',
      };
    }),
    ...(tasks ?? []).map((t: any): AssociationCalendarItem => ({
      key: `t-${t.id}`,
      when: `${t.next_due_date}T12:00:00Z`,
      title: t.task_name,
      // Vendor names are not shown to residents.
      detail: 'Preventive maintenance',
      location: null,
      kind: 'maintenance',
    })),
  ].sort((a, b) => a.when.localeCompare(b.when));

  return { items, timeZone: assoc?.timezone ?? 'America/Chicago', errors };
}
