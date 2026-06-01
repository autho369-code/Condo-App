import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { EVENT_TYPES, eventTypeLabel } from '@/lib/operations/calendar';

export const dynamic = 'force-dynamic';

const statusTone: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  notice_sent: 'bg-cyan-100 text-cyan-700',
  reminder_sent: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  canceled: 'bg-gray-100 text-slate-400',
  failed_notification: 'bg-red-100 text-red-700',
};

function formatWhen(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; type?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const today = new Date();
  const horizon = new Date(today.getTime() + 45 * 86_400_000);

  const { data: associations } = await db
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  let query = db
    .from('calendar_events')
    .select('id, title, event_type, start_datetime, end_datetime, location, operations_status, public_notice_text, associations(id, name)')
    .is('archived_at', null)
    .gte('start_datetime', today.toISOString())
    .lte('start_datetime', horizon.toISOString())
    .order('start_datetime', { ascending: true })
    .limit(200);

  if (sp.assoc) query = query.eq('association_id', sp.assoc);
  if (sp.type) query = query.eq('event_type', sp.type);

  const { data: events } = await query;
  const rows = events ?? [];
  const critical = rows.filter((event: any) => ['water_shutoff', 'insurance_expiration', 'contract_renewal', 'assessment_deadline'].includes(event.event_type)).length;

  return (
    <div className="flex h-full">
      <main className="flex-1 overflow-y-auto bg-gray-50 px-8 py-6">
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Operations Calendar</div>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">Association calendar</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              One workspace for board meetings, vendor visits, water shutoffs, move-ins, inspections, renewals, notices, reminders, and follow-up work.
            </p>
          </div>
          <Link href={`/calendar/new${sp.assoc ? `?assoc=${sp.assoc}` : ''}`}>
            <Button>Create event</Button>
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Metric label="Next 45 days" value={rows.length} />
          <Metric label="Critical / deadline events" value={critical} tone="text-amber-700" />
          <Metric label="Draft notices" value={rows.filter((event: any) => event.operations_status === 'scheduled' && event.public_notice_text).length} />
          <Metric label="Needs communication" value={rows.filter((event: any) => !event.public_notice_text).length} tone="text-red-700" />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <form action="/calendar" className="flex flex-wrap items-center gap-3">
            <select name="assoc" defaultValue={sp.assoc ?? ''} className="h-9 rounded border border-gray-300 bg-white px-3 text-sm">
              <option value="">All associations</option>
              {(associations ?? []).map((association: any) => (
                <option key={association.id} value={association.id}>{association.name}</option>
              ))}
            </select>
            <select name="type" defaultValue={sp.type ?? ''} className="h-9 rounded border border-gray-300 bg-white px-3 text-sm">
              <option value="">All event types</option>
              {EVENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <Button size="sm" type="submit">Filter</Button>
            {(sp.assoc || sp.type) && (
              <Link href="/calendar" className="text-sm text-slate-400 hover:text-gray-900">Clear</Link>
            )}
          </form>
        </div>

        {rows.length ? (
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Event</TH>
                <TH>Association</TH>
                <TH>Location</TH>
                <TH>Status</TH>
                <TH>Notice</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map((event: any) => (
                <TR key={event.id}>
                  <TD className="whitespace-nowrap text-sm">{formatWhen(event.start_datetime)}</TD>
                  <TD>
                    <div className="font-medium text-gray-900">{event.title}</div>
                    <div className="text-xs text-slate-400">{eventTypeLabel(event.event_type)}</div>
                  </TD>
                  <TD className="text-sm text-gray-700">{event.associations?.name ?? 'Portfolio-wide'}</TD>
                  <TD className="text-sm text-slate-400">{event.location ?? '-'}</TD>
                  <TD>
                    <span className={`rounded px-2 py-0.5 text-xs capitalize ${statusTone[event.operations_status ?? 'scheduled'] ?? 'bg-gray-100 text-slate-400'}`}>
                      {(event.operations_status ?? 'scheduled').replaceAll('_', ' ')}
                    </span>
                  </TD>
                  <TD className="max-w-md text-sm text-slate-400">
                    {event.public_notice_text ? <span className="line-clamp-2">{event.public_notice_text}</span> : <span className="text-red-600">Needs draft</span>}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-gray-900">No upcoming events found</h2>
            <p className="mt-1 text-sm text-slate-400">Create the first event to generate notices, reminders, and follow-up tasks.</p>
          </div>
        )}
      </main>

      <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white px-6 py-6">
        <h2 className="text-sm font-semibold text-gray-900">AIOS workflow examples</h2>
        <div className="mt-4 space-y-3 text-sm text-slate-400">
          <Prompt text="Schedule water shutoff for AACA on April 22 from 8 AM to noon for plumbing repairs." />
          <Prompt text="Create board meeting reminder for Lakeview Towers next Thursday at 6 PM." />
          <Prompt text="Set contract renewal reminder 90, 60, and 30 days before elevator agreement expires." />
        </div>
        <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          AIOS should create the event, draft owner/vendor messages, schedule reminders, and create the follow-up task. This first slice stores those records so the assistant can safely operate on them.
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value, tone = 'text-gray-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function Prompt({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      "{text}"
    </div>
  );
}
