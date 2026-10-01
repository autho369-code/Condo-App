import 'server-only';
import { queueEmails, type QueuedEmail } from '@/lib/email/queue';
import { firstVendorEmail } from '@/lib/vendors/document-requests';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

// Delivers calendar_event_reminders that are due. Reminders were created with
// every calendar event but nothing ever sent them, so they piled up as
// "Due now" in the Automation Center.
//
// Each reminder row targets one recipient group:
//   management_office   → the company's support email (or the association's managers)
//   board               → active board members of the association
//   vendor              → the event's vendor
//   affected_residents  → owners currently in the association (or the event's unit)
// Residents receive only the public notice text; everyone else also gets the
// internal details. Only groups whose "Notify …" action was ticked are emailed.
// Reminders whose event started more than 30 minutes ago are marked expired
// instead of sent (no stale "reminders" after the fact).

const DEFAULT_TZ = 'America/Chicago';
const BATCH = 100;
// A reminder exactly at the start (0-minute offset) becomes due at the start;
// with a 15-minute cron it is picked up a few minutes later. Still send it.
const START_GRACE_MS = 30 * 60_000;

// A reminder row only emails its group when the matching "Notify …" action
// was ticked on the event. Other actions (email draft, follow-up task,
// posting notice) do not send anything.
const NOTIFY_ACTION_FOR_GROUP: Record<string, string> = {
  management_office: 'notify_management_office',
  board: 'notify_board',
  vendor: 'notify_vendor',
  affected_residents: 'notify_affected_residents',
};

export function reminderSendsEmail(group: string, action: string | null | undefined): boolean {
  const required = NOTIFY_ACTION_FOR_GROUP[group];
  if (!required) return false;
  return String(action ?? '').split(',').map((a) => a.trim()).includes(required);
}

type Svc = any;

function splitEmails(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value.split(/[,;\s]+/).map((v) => v.trim().toLowerCase()).filter((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
}

function formatWhen(iso: string, allDay: boolean, timeZone: string) {
  const d = new Date(iso);
  return allDay
    ? d.toLocaleDateString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' })
    : d.toLocaleString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

async function recipientsFor(svc: Svc, group: string, event: any): Promise<Array<{ email: string; name: string | null }>> {
  if (group === 'vendor') {
    if (!event.vendor_id) return [];
    const { data: v } = await svc.from('vendors').select('name, emails').eq('id', event.vendor_id).maybeSingle();
    const email = firstVendorEmail(v?.emails);
    return email ? [{ email, name: v?.name ?? null }] : [];
  }
  if (group === 'board') {
    if (!event.association_id) return [];
    const { data } = await svc.from('board_members').select('full_name, email').eq('association_id', event.association_id).eq('active', true);
    return ((data ?? []) as any[]).flatMap((b) => splitEmails(b.email).map((email) => ({ email, name: b.full_name ?? null })));
  }
  if (group === 'affected_residents') {
    if (!event.association_id) return [];
    // Every page of residents: one request stops at 1,000 rows.
    const { rows, error } = await fetchAllRows<any>(() => {
      let q = svc.from('occupancies').select('id, owners!occupancies_owner_id_fkey(full_name, email)').eq('association_id', event.association_id).eq('status', 'current');
      if (event.unit_id) q = q.eq('unit_id', event.unit_id);
      return q.order('id');
    });
    if (error) throw new Error(`resident lookup failed: ${error}`);
    return rows.flatMap((o) => splitEmails(o.owners?.email).map((email) => ({ email, name: o.owners?.full_name ?? null })));
  }
  // management_office (default)
  if (event.portfolios?.support_email) return splitEmails(event.portfolios.support_email).map((email) => ({ email, name: null }));
  if (event.association_id) {
    // association_managers.user_id references auth.users, so look profiles up separately.
    const { data: managers } = await svc.from('association_managers').select('user_id').eq('association_id', event.association_id).is('ended_at', null);
    const ids = ((managers ?? []) as any[]).map((m) => m.user_id).filter(Boolean);
    if (ids.length) {
      const { data: profiles } = await svc.from('profiles').select('email, full_name').in('id', ids);
      const list = ((profiles ?? []) as any[]).flatMap((p) => splitEmails(p.email).map((email) => ({ email, name: p.full_name ?? null })));
      if (list.length) return list;
    }
  }
  if (event.created_by) {
    const { data: p } = await svc.from('profiles').select('email, full_name').eq('id', event.created_by).maybeSingle();
    return splitEmails(p?.email).map((email) => ({ email, name: p?.full_name ?? null }));
  }
  return [];
}

export async function deliverDueCalendarReminders(svc: Svc, now = new Date()) {
  const nowIso = now.toISOString();
  const { data: due, error } = await svc
    .from('calendar_event_reminders')
    .select('id, recipient_group, action, calendar_event_id, calendar_events(id, title, event_type, start_datetime, all_day, location, description, maintenance_instructions, public_notice_text, association_id, unit_id, vendor_id, portfolio_id, created_by, archived_at, operations_status, associations(name, timezone), portfolios(company_name, support_email))')
    .eq('status', 'scheduled')
    .lte('remind_at', nowIso)
    .order('remind_at')
    .limit(BATCH);
  if (error) throw new Error(error.message);

  const summary = { sent: 0, expired: 0, skipped: 0, failed: 0 };
  for (const r of (due ?? []) as any[]) {
    const event = r.calendar_events;
    const setStatus = async (status: string) => {
      await svc.from('calendar_event_reminders').update({ status, updated_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'scheduled');
    };
    if (!event || event.archived_at || ['canceled', 'cancelled'].includes(event.operations_status ?? '')) {
      await setStatus('skipped'); summary.skipped++; continue;
    }
    if (!event.start_datetime || new Date(event.start_datetime).getTime() < now.getTime() - START_GRACE_MS) {
      await setStatus('expired'); summary.expired++; continue;
    }
    if (!reminderSendsEmail(r.recipient_group, r.action)) {
      await setStatus('skipped'); summary.skipped++; continue;
    }

    let recipients: Array<{ email: string; name: string | null }>;
    try {
      recipients = await recipientsFor(svc, r.recipient_group, event);
    } catch (e) {
      console.error(`[calendar-reminders] ${r.id}:`, e);
      summary.failed++;
      continue; // stays scheduled; retried next run
    }
    const unique = [...new Map(recipients.map((x) => [x.email, x])).values()];
    if (unique.length === 0) { await setStatus('skipped'); summary.skipped++; continue; }

    const tz = event.associations?.timezone || DEFAULT_TZ;
    const when = formatWhen(event.start_datetime, !!event.all_day, tz);
    const brand = event.portfolios?.company_name ?? event.associations?.name ?? 'Your management team';
    const isResident = r.recipient_group === 'affected_residents';
    const subject = `Reminder: ${event.title} — ${when}`;
    const lines = isResident
      ? [
          event.public_notice_text?.trim() || `Reminder: ${event.title} is scheduled for ${when}.`,
          '',
          event.location ? `Location: ${event.location}` : '',
          `— ${brand}`,
        ]
      : [
          `Reminder: ${event.title}`,
          `When: ${when}`,
          event.associations?.name ? `Association: ${event.associations.name}` : '',
          event.location ? `Location: ${event.location}` : '',
          event.description ? `\n${event.description}` : '',
          event.maintenance_instructions ? `\nInstructions: ${event.maintenance_instructions}` : '',
          '',
          `— ${brand}`,
        ];
    const text = lines.filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== '')).join('\n');
    const emails: QueuedEmail[] = unique.map((x) => ({
      to: x.email,
      toName: x.name,
      subject,
      text,
      fromName: brand,
      replyTo: event.portfolios?.support_email ?? null,
      portfolioId: event.portfolio_id ?? null,
      associationId: event.association_id ?? null,
      idempotencyKey: `calendar-reminder:${r.id}:${x.email}`,
    }));
    const { error: queueError } = await queueEmails(svc, emails);
    if (queueError) {
      console.error(`[calendar-reminders] ${r.id}: ${queueError}`);
      summary.failed++;
      continue; // stays scheduled; retried next run (idempotency keys prevent duplicates)
    }
    await setStatus('sent');
    summary.sent++;
  }
  return summary;
}
