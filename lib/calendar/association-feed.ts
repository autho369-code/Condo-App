// THE association calendar. Board portal and owner portal render this same
// feed — one code path so the two can never drift apart. RLS scopes rows per
// viewer, and the resident/board policies are aligned (see migration
// 20260714020000_calendar_parity_owner_board) so identical association ids
// yield identical items.
import { createClient } from '@/lib/supabase/server';

export type AssociationCalendarItem = {
  key: string;
  when: string; // ISO datetime
  title: string;
  detail: string;
  location: string | null;
  kind: 'meeting' | 'vendor' | 'maintenance' | 'event';
};

export async function getAssociationCalendarFeed(
  associationIds: string[],
  days = 90,
): Promise<AssociationCalendarItem[]> {
  const ids = (associationIds ?? []).filter(Boolean);
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + days * 86400000).toISOString();

  const [{ data: events }, { data: meetings }, { data: tasks }] = await Promise.all([
    db.from('calendar_events')
      .select('id, title, event_type, start_datetime, location, vendors(name)')
      .in('association_id', ids)
      .is('archived_at', null)
      .gte('start_datetime', now)
      .lte('start_datetime', horizon)
      .order('start_datetime'),
    db.from('meetings')
      .select('id, title, meeting_type, start_time, location')
      .in('association_id', ids)
      .is('archived_at', null)
      .in('status', ['scheduled', 'in_progress'])
      .gte('start_time', now)
      .lte('start_time', horizon)
      .order('start_time'),
    db.from('maintenance_tasks')
      .select('id, task_name, next_due_date, vendors(name)')
      .in('association_id', ids)
      .is('archived_at', null)
      .not('next_due_date', 'is', null)
      .gte('next_due_date', now.slice(0, 10))
      .lte('next_due_date', horizon.slice(0, 10))
      .order('next_due_date'),
  ]);

  return [
    ...(meetings ?? []).map((m: any): AssociationCalendarItem => ({
      key: `m-${m.id}`,
      when: m.start_time,
      title: m.title,
      detail: `${(m.meeting_type ?? 'meeting').replace(/_/g, ' ')}`,
      location: m.location ?? null,
      kind: 'meeting',
    })),
    ...(events ?? []).map((e: any): AssociationCalendarItem => ({
      key: `e-${e.id}`,
      when: e.start_datetime,
      title: e.title,
      detail: e.vendors?.name ? `Vendor visit · ${e.vendors.name}` : (e.event_type ?? 'event').replace(/_/g, ' '),
      location: e.location ?? null,
      kind: e.vendors?.name ? 'vendor' : 'event',
    })),
    ...(tasks ?? []).map((t: any): AssociationCalendarItem => ({
      key: `t-${t.id}`,
      when: `${t.next_due_date}T12:00:00Z`,
      title: t.task_name,
      detail: t.vendors?.name ? `Maintenance · ${t.vendors.name}` : 'Preventive maintenance',
      location: null,
      kind: 'maintenance',
    })),
  ].sort((a, b) => a.when.localeCompare(b.when));
}
