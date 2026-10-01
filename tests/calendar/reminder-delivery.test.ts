import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const queued: any[] = [];
vi.mock('@/lib/email/queue', () => ({
  queueEmails: vi.fn(async (_db: any, emails: any[]) => { queued.push(...emails); return { error: null, count: emails.length }; }),
}));

import { deliverDueCalendarReminders } from '@/lib/calendar/reminder-delivery';

// Minimal chainable stand-in for the Supabase client: each table returns the
// rows configured below; updates are recorded.
function fakeDb(tables: Record<string, any[]>) {
  const updates: Array<{ table: string; patch: any; filters: any[] }> = [];
  const from = (table: string) => {
    const filters: any[] = [];
    let patch: any = null;
    const q: any = {
      select: () => q, order: () => q, limit: () => q, lte: () => q, is: () => q, in: () => q,
      eq: (col: string, val: any) => { filters.push([col, val]); return q; },
      update: (p: any) => { patch = p; return q; },
      maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null }),
      then: (resolve: any) => {
        if (patch) { updates.push({ table, patch, filters }); return resolve({ data: null, error: null }); }
        return resolve({ data: tables[table] ?? [], error: null });
      },
    };
    return q;
  };
  return { db: { from }, updates };
}

const future = new Date(Date.now() + 2 * 86400000).toISOString();
const past = new Date(Date.now() - 3600000).toISOString();
const event = (over: any = {}) => ({
  id: 'e1', title: 'Water shutoff', event_type: 'water_shutoff', start_datetime: future, all_day: false,
  location: 'Building A', description: 'Internal: plumber key in office', maintenance_instructions: null,
  public_notice_text: 'Water will be off on Tuesday.', association_id: 'a1', unit_id: null, vendor_id: 'v1',
  portfolio_id: 'p1', created_by: 'u1', archived_at: null, operations_status: 'scheduled',
  associations: { name: 'Granville', timezone: 'America/Chicago' },
  portfolios: { company_name: 'Acme Mgmt', support_email: 'office@acme.test' }, ...over,
});

describe('deliverDueCalendarReminders', () => {
  beforeEach(() => { queued.length = 0; });

  it('emails the office and residents; residents only see the public notice', async () => {
    const { db, updates } = fakeDb({
      calendar_event_reminders: [
        { id: 'r1', recipient_group: 'management_office', calendar_events: event() },
        { id: 'r2', recipient_group: 'affected_residents', calendar_events: event() },
      ],
      occupancies: [{ owners: { full_name: 'Liam', email: 'liam@example.test' } }],
    });
    const summary = await deliverDueCalendarReminders(db);
    expect(summary).toEqual({ sent: 2, expired: 0, skipped: 0, failed: 0 });
    const office = queued.find((e) => e.to === 'office@acme.test');
    const resident = queued.find((e) => e.to === 'liam@example.test');
    expect(office.text).toContain('plumber key');
    expect(resident.text).toContain('Water will be off on Tuesday.');
    expect(resident.text).not.toContain('plumber key');
    expect(resident.idempotencyKey).toBe('calendar-reminder:r2:liam@example.test');
    expect(updates.filter((u) => u.patch.status === 'sent')).toHaveLength(2);
  });

  it('expires reminders for events that already started and skips cancelled events', async () => {
    const { db, updates } = fakeDb({
      calendar_event_reminders: [
        { id: 'r1', recipient_group: 'management_office', calendar_events: event({ start_datetime: past }) },
        { id: 'r2', recipient_group: 'management_office', calendar_events: event({ operations_status: 'canceled' }) },
      ],
    });
    const summary = await deliverDueCalendarReminders(db);
    expect(summary).toEqual({ sent: 0, expired: 1, skipped: 1, failed: 0 });
    expect(queued).toHaveLength(0);
    expect(updates.map((u) => u.patch.status).sort()).toEqual(['expired', 'skipped']);
  });

  it('sends vendor reminders to the vendor email', async () => {
    const { db } = fakeDb({
      calendar_event_reminders: [{ id: 'r1', recipient_group: 'vendor', calendar_events: event() }],
      vendors: [{ name: 'Plumbing Co', emails: ['dispatch@plumb.test'] }],
    });
    await deliverDueCalendarReminders(db);
    expect(queued.map((e) => e.to)).toEqual(['dispatch@plumb.test']);
    expect(queued[0].subject).toMatch(/^Reminder: Water shutoff — /);
    expect(queued[0].subject).toMatch(/CDT|CST/);
  });
});
