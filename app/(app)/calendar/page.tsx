import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import '@/components/calendar/calendar-theme.css';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; type?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch associations for filter
  const { data: associations } = await db
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  // Fetch events — wider window: 90 days back to 180 days forward
  const now = new Date();
  const past = new Date(now.getTime() - 90 * 86_400_000);
  const future = new Date(now.getTime() + 180 * 86_400_000);

  let query = db
    .from('calendar_events')
    .select('id, title, event_type, start_datetime, end_datetime, all_day, location, operations_status, association_id, public_notice_text, associations(id, name)')
    .is('archived_at', null)
    .gte('start_datetime', past.toISOString())
    .lte('start_datetime', future.toISOString())
    .order('start_datetime', { ascending: true })
    .limit(500);

  if (sp.assoc) query = query.eq('association_id', sp.assoc);
  if (sp.type) query = query.eq('event_type', sp.type);

  const { data: events } = await query;
  const raw = (events ?? []) as any[];
  const rows = raw.map((e: any) => ({
    id: e.id,
    title: e.title,
    start_datetime: e.start_datetime,
    end_datetime: e.end_datetime,
    all_day: e.all_day,
    event_type: e.event_type,
    location: e.location,
    operations_status: e.operations_status,
    association_name: e.associations?.name ?? null,
  }));

  // Count metrics from raw data (includes public_notice_text)
  const total = raw.length;
  const critical = raw.filter((e: any) =>
    ['water_shutoff', 'insurance_expiration', 'contract_renewal', 'assessment_deadline'].includes(e.event_type)
  ).length;
  const draftNotices = raw.filter((e: any) =>
    e.operations_status === 'scheduled' && e.public_notice_text
  ).length;
  const needsCommunication = raw.filter((e: any) =>
    !e.public_notice_text
  ).length;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-[#1E293B] bg-[#0B1121] px-6 py-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Operations Calendar
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Association calendar
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Month, week, and day views — drag events to reschedule. Color-coded by event type.
          </p>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 min-h-0">
          <CalendarGrid
            events={rows}
            associations={associations ?? []}
            initialAssocId={sp.assoc ?? ''}
            initialType={sp.type ?? ''}
          />
        </div>
      </main>

      {/* Right panel — metrics + AI prompts */}
      <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#1E293B] bg-[#0B1121] px-5 py-6">
        {/* Metrics */}
        <h2 className="text-sm font-semibold text-slate-300">Calendar overview</h2>
        <div className="mt-4 space-y-3">
          <Metric label="Total events" value={total} />
          <Metric label="Critical / deadline events" value={critical} tone="text-amber-400" />
          <Metric label="With draft notices" value={draftNotices} />
          <Metric label="Needs communication" value={needsCommunication} tone="text-red-400" />
        </div>

        {/* Quick links */}
        <div className="mt-6 space-y-2">
          <Link
            href={`/calendar/new${sp.assoc ? `?assoc=${sp.assoc}` : ''}`}
            className="block rounded-lg border border-[#1E293B] bg-[#060B18] px-4 py-3 text-sm text-slate-300 hover:border-emerald-500/40 hover:text-white transition-colors"
          >
            + Create event
          </Link>
          <Link
            href="/calendar"
            className="block rounded-lg border border-[#1E293B] bg-[#060B18] px-4 py-3 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors"
          >
            View all events
          </Link>
        </div>

        {/* AI prompts */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-300">Quick schedule</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-400">
            <Prompt text="Schedule water shutoff for Lakeview Towers on June 15 from 8 AM to noon for plumbing repairs." />
            <Prompt text="Create board meeting reminder for Riverview Commons next Thursday at 6 PM." />
            <Prompt text="Set contract renewal reminder 90, 60, and 30 days before elevator agreement expires." />
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Pro tip</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Drag and drop events to reschedule them. Use the Month view for long-range planning, Week for daily operations, and Day for hour-by-hour coordination. Colors make it easy to spot critical events at a glance.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value, tone = 'text-slate-200' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#1E293B] bg-[#060B18] px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function Prompt({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[#1E293B] bg-[#060B18] p-3 text-slate-400 italic">
      &ldquo;{text}&rdquo;
    </div>
  );
}
