import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { notifyOwnersOfUpcomingEvents } from '@/lib/rpcs/calendar';

export const dynamic = 'force-dynamic';

// ---------- Color mapping: our 14 internal types → AppFolio's 5 display buckets ----------
type Bucket = 'administrative' | 'announcements' | 'maintenance' | 'meetings' | 'social_events';

const TYPE_TO_BUCKET: Record<string, Bucket> = {
  administrative:          'administrative',
  announcements:           'announcements',
  maintenance:             'maintenance',
  water_shutoff:           'maintenance',
  vendor_work:             'maintenance',
  inspection:              'maintenance',
  meetings:                'meetings',
  board_meeting:           'meetings',
  elevator_reservation:    'meetings',
  common_area_reservation: 'meetings',
  social_events:           'social_events',
  move_in:                 'social_events',
  move_out:                'social_events',
  other:                   'administrative',
};

const BUCKET_COLORS: Record<Bucket, { pill: string; chip: string; label: string }> = {
  administrative: { pill: 'bg-blue-50 text-blue-800 border-blue-200',     chip: 'bg-blue-100 text-blue-800',     label: 'Administrative' },
  announcements:  { pill: 'bg-pink-50 text-pink-800 border-pink-200',     chip: 'bg-pink-100 text-pink-800',     label: 'Announcements'  },
  maintenance:    { pill: 'bg-amber-50 text-amber-800 border-amber-200',  chip: 'bg-amber-100 text-amber-800',   label: 'Maintenance'    },
  meetings:       { pill: 'bg-cyan-50 text-cyan-800 border-cyan-200',     chip: 'bg-cyan-100 text-cyan-800',     label: 'Meetings'       },
  social_events:  { pill: 'bg-green-50 text-green-800 border-green-200',  chip: 'bg-green-100 text-green-800',   label: 'Social Events'  },
};

const ALL_BUCKETS: Bucket[] = ['administrative', 'announcements', 'maintenance', 'meetings', 'social_events'];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function shiftMonth(y: number, m: number, delta: number) {
  const d = new Date(y, m + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string; month?: string; types?: string; view?: string; calView?: string }>;
}) {
  const sp = await searchParams;
  const assoc      = sp.assoc ?? '';
  const scopeTab   = sp.view === 'property' ? 'property' : 'association';
  const calView    = sp.calView ?? 'month';

  // Event type filter — comma-separated buckets that are INCLUDED.
  // Default: all 5 visible.
  const typesParam = sp.types;
  const selectedBuckets = new Set<Bucket>(
    typesParam ? (typesParam.split(',').filter((t) => ALL_BUCKETS.includes(t as Bucket)) as Bucket[])
               : ALL_BUCKETS,
  );

  const supabase = await createClient();
  const today = new Date();
  let year  = today.getFullYear();
  let month = today.getMonth();
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [y, m] = sp.month.split('-').map(Number);
    year = y; month = m - 1;
  }

  // Grid bounds
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth  = new Date(year, month + 1, 0);
  const gridStart    = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd      = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, +1);

  // ---- Build URLs preserving state ----
  // Explicit `null` in overrides clears that key. Omitting a key keeps current value.
  const params = (overrides: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const put = (k: string, v: string | null | undefined) => { if (v != null && v !== '') p.set(k, v); };

    const pick = <T extends string | null>(k: string, current: T): string | null =>
      (k in overrides ? overrides[k] : current);

    put('view',    pick('view',    (scopeTab === 'property' ? 'property' : null)));
    put('assoc',   pick('assoc',   assoc || null));
    put('month',   pick('month',   `${year}-${String(month + 1).padStart(2, '0')}`));
    put('types',   pick('types',   typesParam ?? null));
    put('calView', pick('calView', calView === 'month' ? null : calView));
    const qs = p.toString();
    return qs ? `/calendar?${qs}` : '/calendar';
  };
  const toggleBucket = (b: Bucket) => {
    const next = new Set(selectedBuckets);
    if (next.has(b)) next.delete(b); else next.add(b);
    return params({ types: next.size === ALL_BUCKETS.length ? null : Array.from(next).join(',') });
  };

  // ---- Data ----
  const { data: associations } = await supabase
    .from('associations').select('id, name').is('archived_at', null).order('name');

  let q = supabase.from('calendar_events')
    .select('id, title, event_type, calendar_scope, reminder_days_before, start_datetime, end_datetime, all_day, location, associations(id, name)')
    .is('archived_at', null)
    .gte('start_datetime', gridStart.toISOString())
    .lte('start_datetime', new Date(gridEnd.getTime() + 86_400_000).toISOString())
    .order('start_datetime', { ascending: true });

  // Scope tab: Association = daily ops events (elevator, moves, water shutoffs, vendor work).
  //            Property    = annual preventive schedule (fire pump, inspections, roof, plumbing).
  if (scopeTab === 'association') {
    q = q.eq('calendar_scope', 'daily');
    if (assoc) q = q.eq('association_id', assoc);
  } else {
    q = q.eq('calendar_scope', 'annual');
    if (assoc) q = q.eq('association_id', assoc);
  }
  const { data: eventsRaw } = await q;

  const events = (eventsRaw ?? []).filter((e: any) => selectedBuckets.has(TYPE_TO_BUCKET[e.event_type] ?? 'administrative'));

  // Bucket by date
  const byDay = new Map<string, any[]>();
  for (const e of events) {
    const key = ymd(new Date(e.start_datetime));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  // Grid cells
  const cells: Array<{ date: Date; inMonth: boolean; isToday: boolean; key: string }> = [];
  const todayKey = ymd(today);
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    cells.push({ date, inMonth: date.getMonth() === month, isToday: ymd(date) === todayKey, key: ymd(date) });
  }

  const activeAssoc = assoc ? (associations ?? []).find((a: any) => a.id === assoc) : null;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4 space-y-3">
      {/* Top tabs — Association Calendar | Property Calendar */}
      <nav className="flex gap-6 border-b border-gray-200">
        <Link href={params({ view: null })}
          className={`border-b-2 px-1 pb-2 text-sm transition ${scopeTab === 'association' ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
          Association Calendar
        </Link>
        <Link href={params({ view: 'property', assoc: null })}
          className={`border-b-2 px-1 pb-2 text-sm transition ${scopeTab === 'property' ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
          Property Calendar
        </Link>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          {scopeTab === 'property' ? 'Annual preventive calendar' : 'Calendar'}
        </h1>
        <Link href={`/calendar/new?scope=${scopeTab === 'property' ? 'annual' : 'daily'}${assoc ? `&assoc=${assoc}` : ''}`}>
          <Button>{scopeTab === 'property' ? '+ Add annual event' : '+ Create Event'}</Button>
        </Link>
      </div>
      {scopeTab === 'property' && (
        <p className="-mt-1 text-sm text-gray-600">
          Fire pump tests, fire panel, extinguishers, standpipe, elevator inspections, plumbing line cleaning, roof inspection — schedule once at the start of the year with a 1–30 day advance reminder.
        </p>
      )}

      {/* Main: filters + calendar */}
      <div className="flex gap-4">
        {/* ---- Filters panel ---- */}
        <aside className="w-56 shrink-0 space-y-4 rounded border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Filters</h3>

          {scopeTab === 'association' && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Association</div>
              <form action="/calendar" method="get">
                <input type="hidden" name="view" value={scopeTab === 'property' ? 'property' : ''} />
                <input type="hidden" name="month" value={`${year}-${String(month + 1).padStart(2, '0')}`} />
                {typesParam && <input type="hidden" name="types" value={typesParam} />}
                <select
                  name="assoc"
                  defaultValue={assoc}
                  className="h-9 w-full rounded border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Select…</option>
                  {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button type="submit" className="mt-2 w-full rounded border border-gray-300 bg-white py-1.5 text-xs text-gray-700 hover:bg-gray-50">Apply</button>
              </form>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Event Type</div>
            <ul className="space-y-2">
              {ALL_BUCKETS.map((b) => {
                const on = selectedBuckets.has(b);
                const color = BUCKET_COLORS[b];
                return (
                  <li key={b}>
                    <Link href={toggleBucket(b)} className="flex items-center gap-2 text-sm">
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                        <span className="text-[10px] leading-none">✓</span>
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs ${color.chip}`}>{color.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* ---- Calendar area ---- */}
        <div className="flex-1 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2">
            <Link href={params({ month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` })}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50">Today</Link>

            <div className="flex items-center gap-1">
              <Link href={params({ month: `${prev.year}-${String(prev.month + 1).padStart(2, '0')}` })}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50">‹</Link>
              <div className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1 text-sm">
                <span>📅</span>
                <span className="font-medium">{MONTHS[month]} {year}</span>
              </div>
              <Link href={params({ month: `${next.year}-${String(next.month + 1).padStart(2, '0')}` })}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-sm hover:bg-gray-50">›</Link>
            </div>

            <div className="inline-flex overflow-hidden rounded border border-gray-300">
              {(['month', 'week', 'day', 'agenda'] as const).map((v) => {
                const on = calView === v;
                return (
                  <Link key={v} href={params({ calView: v === 'month' ? null : v })}
                    className={`px-3 py-1 text-sm capitalize transition ${on ? 'bg-gray-200 font-semibold text-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                    {v}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          {calView === 'agenda' ? (
            <AgendaView events={events} />
          ) : (
            <div className="overflow-hidden rounded border border-gray-200 bg-white">
              <div className="grid grid-cols-7 border-b border-gray-200 bg-white text-xs font-semibold uppercase tracking-wide text-gray-600">
                {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2 text-left">{w}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((c) => {
                  const dayEvents = byDay.get(c.key) ?? [];
                  const cellBg = c.isToday ? 'bg-amber-50' : (c.inMonth ? 'bg-white' : 'bg-gray-50');
                  return (
                    <div key={c.key} className={`min-h-[104px] border-b border-r border-gray-100 p-1.5 ${cellBg}`}>
                      <div className="mb-1 flex items-start justify-end">
                        <Link
                          href={`/calendar/new?start=${c.key}${assoc ? `&assoc=${assoc}` : ''}`}
                          className={`text-xs tabular-nums ${c.inMonth ? 'text-gray-700 hover:text-brand-700' : 'text-gray-400'}`}
                          title="Add event this day"
                        >
                          {c.date.getDate()}
                        </Link>
                      </div>
                      <ul className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e: any) => {
                          const bucket = TYPE_TO_BUCKET[e.event_type] ?? 'administrative';
                          const color = BUCKET_COLORS[bucket];
                          return (
                            <li key={e.id}>
                              <span
                                title={`${e.title}${e.location ? ' · ' + e.location : ''}`}
                                className={`block truncate rounded border px-1.5 py-0.5 text-[11px] ${color.pill}`}
                              >
                                {e.title}
                              </span>
                            </li>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <li className="px-1 text-[11px] text-gray-500">+{dayEvents.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
        </div>
      </div>

      {/* ========== Right panel — scope-aware ========== */}
      {scopeTab === 'property' ? (
        <ContextPanel title="Tasks">
          <PanelSection title="Annual preventive tasks" icon="★">
            <PanelLink href={`/calendar/new?scope=annual${assoc ? `&assoc=${assoc}` : ''}&type=inspection&title=Fire+pump+test`}>Fire pump test</PanelLink>
            <PanelLink href={`/calendar/new?scope=annual${assoc ? `&assoc=${assoc}` : ''}&type=inspection&title=Fire+panel+check`}>Fire panel check</PanelLink>
            <PanelLink href={`/calendar/new?scope=annual${assoc ? `&assoc=${assoc}` : ''}&type=maintenance&title=Fire+extinguisher+recert`}>Fire extinguisher recert</PanelLink>
            <PanelLink href={`/calendar/new?scope=annual${assoc ? `&assoc=${assoc}` : ''}&type=inspection&title=Standpipe+inspection`}>Standpipe inspection</PanelLink>
            <PanelLink href={`/calendar/new?scope=annual${assoc ? `&assoc=${assoc}` : ''}&type=inspection&title=Elevator+inspection`}>Elevator inspection</PanelLink>
            <PanelLink href={`/calendar/new?scope=annual${assoc ? `&assoc=${assoc}` : ''}&type=maintenance&title=Plumbing+kitchen+line+cleaning`}>Plumbing kitchen line cleaning</PanelLink>
            <PanelLink href={`/calendar/new?scope=annual${assoc ? `&assoc=${assoc}` : ''}&type=inspection&title=Roof+inspection`}>Roof inspection</PanelLink>
            <PanelLink href={`/calendar/new?scope=annual${assoc ? `&assoc=${assoc}` : ''}&type=other`}>Other / custom</PanelLink>
          </PanelSection>

          <PanelSection title="Notify owners" icon="✉">
            {assoc ? (
              <li>
                <Link
                  href={`/send-email?association=${assoc}&subject=${encodeURIComponent('Upcoming maintenance at your building')}&return_to=${encodeURIComponent('/calendar?view=property&assoc=' + assoc)}`}
                  className="block text-sm text-blue-700 hover:underline"
                >
                  Compose email to owners / tenants →
                </Link>
                <p className="mt-1 text-xs text-gray-500">
                  Pick recipient group (owners, tenants, both, board) on the next screen.
                </p>
              </li>
            ) : (
              <li className="text-xs text-gray-500">
                Pick an association in the filter above to enable this.
              </li>
            )}
          </PanelSection>
        </ContextPanel>
      ) : (
        <ContextPanel title="Tasks">
          <PanelSection title="Common activities" icon="★">
            <PanelLink href={`/calendar/new?scope=daily${assoc ? `&assoc=${assoc}` : ''}&type=elevator_reservation`}>Elevator reservation</PanelLink>
            <PanelLink href={`/calendar/new?scope=daily${assoc ? `&assoc=${assoc}` : ''}&type=move_in`}>Move-in</PanelLink>
            <PanelLink href={`/calendar/new?scope=daily${assoc ? `&assoc=${assoc}` : ''}&type=move_out`}>Move-out</PanelLink>
            <PanelLink href={`/calendar/new?scope=daily${assoc ? `&assoc=${assoc}` : ''}&type=water_shutoff`}>Water shutoff</PanelLink>
            <PanelLink href={`/calendar/new?scope=daily${assoc ? `&assoc=${assoc}` : ''}&type=vendor_work`}>Vendor work</PanelLink>
            <PanelLink href={`/calendar/new?scope=daily${assoc ? `&assoc=${assoc}` : ''}&type=common_area_reservation`}>Common-area reservation</PanelLink>
            <PanelLink href={`/calendar/new?scope=daily${assoc ? `&assoc=${assoc}` : ''}&type=board_meeting`}>Board meeting</PanelLink>
            <PanelLink href={`/calendar/new?scope=daily${assoc ? `&assoc=${assoc}` : ''}&type=other`}>Other / custom</PanelLink>
          </PanelSection>

          <PanelSection title="Notify owners" icon="✉">
            {assoc ? (
              <li>
                <Link
                  href={`/send-email?association=${assoc}&return_to=${encodeURIComponent('/calendar?assoc=' + assoc)}`}
                  className="block text-sm text-blue-700 hover:underline"
                >
                  Compose email to owners / tenants →
                </Link>
              </li>
            ) : (
              <li className="text-xs text-gray-500">Pick an association to enable this.</li>
            )}
          </PanelSection>
        </ContextPanel>
      )}
    </div>
  );
}

function AgendaView({ events }: { events: any[] }) {
  if (!events.length) {
    return <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No events.</p>;
  }
  return (
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-4 py-2 text-left">When</th>
            <th className="px-4 py-2 text-left">Title</th>
            <th className="px-4 py-2 text-left">Type</th>
            <th className="px-4 py-2 text-left">Association</th>
            <th className="px-4 py-2 text-left">Where</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const bucket = TYPE_TO_BUCKET[e.event_type] ?? 'administrative';
            const color = BUCKET_COLORS[bucket];
            return (
              <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-2">
                  {new Date(e.start_datetime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {!e.all_day && <> · {fmtTime(e.start_datetime)}</>}
                </td>
                <td className="px-4 py-2 font-medium">{e.title}</td>
                <td className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-xs ${color.chip}`}>{color.label}</span></td>
                <td className="px-4 py-2 text-gray-700">{e.associations?.name ?? <span className="text-gray-400">All</span>}</td>
                <td className="px-4 py-2 text-gray-600">{e.location ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
