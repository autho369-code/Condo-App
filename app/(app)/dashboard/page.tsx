import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { acknowledgeReminder } from '@/lib/rpcs/calendar';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ assoc?: string }>;
}) {
  const me = await requireAuth();
  const sp = await searchParams;
  const assocFilter = sp.assoc ?? '';
  const supabase = await createClient();

  if (me.is_resident || me.is_board) redirect('/portal');
  if (me.is_full_access_staff && me.portfolio?.id) {
    const { count } = await supabase.from('associations')
      .select('*', { count: 'exact', head: true })
      .eq('portfolio_id', me.portfolio.id);
    if ((count ?? 0) === 0) redirect('/onboard');
  }

  // ---- Association list for the top-right filter ----
  const { data: associations } = await supabase
    .from('associations').select('id, name').is('archived_at', null).order('name');

  const activeAssoc = assocFilter ? (associations ?? []).find((a: any) => a.id === assocFilter) : null;

  // ---- Due reminders (pop to top of dashboard) ----
  let dueQ = supabase.from('v_due_reminders')
    .select('event_id, title, start_datetime, reminder_days_before, association_name, calendar_scope, location, association_id')
    .order('start_datetime', { ascending: true });
  if (assocFilter) dueQ = dueQ.eq('association_id', assocFilter);
  const { data: dueReminders } = await dueQ;

  // ---- Upcoming calendar events (NEW section at the top) ----
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86400000); // next 30 days
  let evQ = supabase.from('calendar_events')
    .select('id, title, event_type, start_datetime, end_datetime, all_day, location, associations(id, name)')
    .is('archived_at', null)
    .gte('start_datetime', now.toISOString())
    .lte('start_datetime', horizon.toISOString())
    .order('start_datetime', { ascending: true })
    .limit(12);
  if (assocFilter) {
    // Show this association's events + portfolio-wide events
    evQ = evQ.or(`association_id.eq.${assocFilter},association_id.is.null`);
  }
  const { data: events } = await evQ;

  // ---- Stats: when a specific association is chosen, compute from underlying
  // tables; when "All associations", reuse v_dashboard_summary. ----
  const stats = assocFilter
    ? await computeAssocStats(supabase, assocFilter)
    : await computePortfolioStats(supabase, me.portfolio?.id);

  // ---- Approvals & insurance feeds ----
  let approvalsQ = supabase.from('approval_requests')
    .select('id, request_type, status, requested_at, associations(name), vendors(name)')
    .is('archived_at', null)
    .order('requested_at', { ascending: false })
    .limit(10);
  if (assocFilter) approvalsQ = approvalsQ.eq('association_id', assocFilter);
  const { data: approvals } = await approvalsQ;

  let insQ = supabase.from('associations')
    .select('id, name, insurance_expiration')
    .not('insurance_expiration', 'is', null)
    .lte('insurance_expiration', new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10))
    .limit(10);
  if (assocFilter) insQ = insQ.eq('id', assocFilter);
  const { data: overdueInsurance } = await insQ;

  const portalTotal = stats.portal_activated + stats.portal_not_activated + stats.portal_no_email;
  const pct = (n: number) => portalTotal ? Math.round((n / portalTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-8 py-6 space-y-4">
      {/* Header with association filter */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          Dashboard{activeAssoc ? <span className="ml-2 text-base font-normal text-gray-500">Â· {activeAssoc.name}</span> : null}
        </h1>
        <form action="/dashboard" method="get" className="flex items-center gap-2">
          <select
            name="assoc"
            defaultValue={assocFilter}
            className="h-9 rounded border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button type="submit" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">Apply</button>
        </form>
      </div>

      {/* ============== DUE REMINDERS â€” pops to top when any event's reminder window is open ============== */}
      {dueReminders && dueReminders.length > 0 && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <span>ðŸ””</span>
            <span>{dueReminders.length} reminder{dueReminders.length === 1 ? '' : 's'} â€” events coming due</span>
          </div>
          <ul className="space-y-2">
            {dueReminders.map((r: any) => {
              const daysOut = Math.ceil((new Date(r.start_datetime).getTime() - Date.now()) / 86_400_000);
              return (
                <li key={r.event_id} className="flex items-start justify-between gap-3 rounded border border-amber-300 bg-white px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">{r.title}</div>
                    <div className="text-xs text-gray-600">
                      {r.association_name ?? 'Portfolio-wide'}
                      {r.location ? ` Â· ${r.location}` : ''}
                      {' Â· '}
                      <strong className={daysOut <= 3 ? 'text-red-700' : 'text-amber-800'}>
                        {daysOut <= 0 ? 'Due today' : `Due in ${daysOut} day${daysOut === 1 ? '' : 's'}`}
                      </strong>
                      {' '}({new Date(r.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                    </div>
                  </div>
                  <form action={acknowledgeReminder.bind(null, r.event_id) as any}>
                    <button type="submit" className="rounded border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">
                      Dismiss
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ============== Association Calendar at top ============== */}
      <Panel
        title={activeAssoc ? `${activeAssoc.name} â€” Upcoming events` : 'Upcoming events (all associations)'}
        right={<Link href={assocFilter ? `/calendar?assoc=${assocFilter}` : '/calendar'} className="text-xs text-blue-700 hover:underline">Open calendar â†’</Link>}
      >
        {(events ?? []).length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-gray-500">
            No events in the next 30 days.{' '}
            <Link href={`/calendar/new${assocFilter ? `?assoc=${assocFilter}` : ''}`} className="text-blue-700 hover:underline">+ New event</Link>
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">When</th>
                <th className="px-4 py-2 text-left font-semibold">Activity</th>
                <th className="px-4 py-2 text-left font-semibold">Association</th>
                <th className="px-4 py-2 text-left font-semibold">Where</th>
              </tr>
            </thead>
            <tbody>
              {(events ?? []).map((e: any) => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2">
                    {new Date(e.start_datetime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {!e.all_day && <> Â· {new Date(e.start_datetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`mr-2 rounded border px-1.5 py-0.5 text-[11px] ${eventBadge(e.event_type)}`}>{eventLabel(e.event_type)}</span>
                    <span className="font-medium text-gray-900">{e.title}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {e.associations?.name
                      ? <Link href={`/calendar?assoc=${e.associations.id}`} className="text-blue-700 hover:underline">{e.associations.name}</Link>
                      : <span className="text-gray-400">Portfolio-wide</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{e.location ?? 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* ============== Rest of the dashboard (scoped when association selected) ============== */}

      {/* Online Payments */}
      <Panel title="Online Payments">
        <div className="grid grid-cols-2 gap-6 px-5 py-4">
          <Stat big="â€”" label="Payments Collected Online" sub="Historical ratio" href={`/reports/ar_aging${assocFilter ? `?association=${assocFilter}` : ''}`} />
          <Stat big="â€”" label="Units Paid Online" sub="Recurring-autopay %" href="/portal/autopay" />
        </div>
      </Panel>

      {/* Online Portal Adoption */}
      <Panel title="Online Portal Adoption">
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <PortalTile label="Activated" n={stats.portal_activated} pct={pct(stats.portal_activated)} tone="green" linkHref="/owners?portal=active" />
          <PortalTile label="Not activated" n={stats.portal_not_activated} pct={pct(stats.portal_not_activated)} tone="amber" linkLabel="Send Activation Emails" linkHref="/owners?portal=not_activated" />
          <PortalTile label="No email" n={stats.portal_no_email} pct={pct(stats.portal_no_email)} tone="red" linkLabel="View Owners" linkHref="/owners?portal=no_email" />
        </div>
      </Panel>

      {/* Notifications */}
      <Panel title="Notifications">
        <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
          <NotifStat n={stats.wo_completed} label="Done in the last 7 days" href={`/work-orders?tab=completed${assocFilter ? `&assoc=${assocFilter}` : ''}`} />
          <NotifStat n={0} label="Overdue" tone="red" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-5 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Bills</div>
            <NotifRow n={stats.pending_approvals} label="Pending approval" href="/bills?status=pending_approval" />
          </div>
          <div className="px-5 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Purchase Orders</div>
            <NotifRow n={0} label="Pending approval" href="/purchase-orders" />
          </div>
        </div>
        <div className="px-5 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Notifications Feed</div>
          {(overdueInsurance ?? []).length > 0 ? (
            <ul className="divide-y divide-gray-100 rounded border border-gray-200">
              {(overdueInsurance ?? []).map((a: any) => (
                <li key={a.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                  <span className="mt-0.5 text-amber-600">âš </span>
                  <div className="flex-1">
                    <span className="text-gray-700">Liability insurance for </span>
                    <Link href={`/associations/${a.id}`} className="text-blue-700 hover:underline">{a.name}</Link>
                    <span className="text-gray-700"> expires on {date(a.insurance_expiration)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-center text-xs text-gray-500">No insurance expirations in the next 60 days.</p>
          )}
        </div>
      </Panel>

      {/* Delinquencies */}
      <Panel title="Delinquencies">
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <DelinqCell n={stats.delinquency_0_30}   label="0â€“60 Days"  tone="neutral" />
          <DelinqCell n={stats.delinquency_31_60}  label="61â€“90 Days" tone="amber" />
          <DelinqCell n={stats.delinquency_61_plus} label="91+ Days"  tone="red" />
        </div>
        <div className="border-t border-gray-100 px-5 py-2 text-xs">
          <Link href={`/reports/ar_aging${assocFilter ? `?association=${assocFilter}` : ''}`} className="text-blue-700 hover:underline">View All Delinquencies</Link>
        </div>
      </Panel>

      {/* Maintenance */}
      <Panel title="Maintenance">
        <div className="grid grid-cols-2 gap-8 px-5 py-5">
          <div>
            <div className="mb-2 text-sm font-semibold">Work Orders</div>
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-8 border-blue-400">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.wo_total}</div>
                <div className="text-xs text-gray-500">TOTAL</div>
              </div>
            </div>
          </div>
          <div>
            <ul className="space-y-2 text-sm">
              <WoRow n={stats.wo_new}         label="New"          href={`/work-orders?tab=open${assocFilter ? `&assoc=${assocFilter}` : ''}`} />
              <WoRow n={stats.wo_assigned}    label="Assigned"     href={`/work-orders?tab=open${assocFilter ? `&assoc=${assocFilter}` : ''}`} />
              <WoRow n={stats.wo_scheduled}   label="Scheduled"    href={`/work-orders?tab=scheduled${assocFilter ? `&assoc=${assocFilter}` : ''}`} />
              <WoRow n={stats.wo_in_progress} label="In progress"  href={`/work-orders?tab=open${assocFilter ? `&assoc=${assocFilter}` : ''}`} />
              <WoRow n={stats.wo_completed}   label="Completed"    href={`/work-orders?tab=completed${assocFilter ? `&assoc=${assocFilter}` : ''}`} />
            </ul>
          </div>
        </div>
      </Panel>

      {/* Association Approvals */}
      <Panel title="Association Approvals">
        {approvals && approvals.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Approval Name</th>
                <th className="px-4 py-2 text-left font-semibold">Association</th>
                <th className="px-4 py-2 text-left font-semibold">Requested</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a: any) => (
                <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-2 font-medium">{a.request_type}</td>
                  <td className="px-4 py-2 text-gray-700">{a.associations?.name ?? 'â€”'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-600">{date(a.requested_at)}</td>
                  <td className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-xs capitalize ${a.status === 'approved' ? 'bg-green-100 text-green-700' : a.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-6 text-center text-sm text-gray-500">No approvals requested.</p>
        )}
      </Panel>

      <Panel title="Upcoming Income Recertifications">
        <p className="px-5 py-6 text-center text-sm text-gray-500">There are no upcoming income recertifications at this time.</p>
      </Panel>

      <Panel title="Vendor Online Payables">
        <div className="px-5 py-4 text-xs text-blue-900">
          You are currently not set up to take advantage of AppFolio Payments for vendors. <Link href="/settings" className="font-semibold hover:underline">Click here</Link> to learn more.
        </div>
      </Panel>
    </div>
  );
}

// ============================================================================
// Stat fetchers
// ============================================================================

type Stats = {
  wo_total: number; wo_new: number; wo_assigned: number; wo_scheduled: number;
  wo_in_progress: number; wo_completed: number;
  pending_approvals: number;
  delinquency_0_30: number; delinquency_31_60: number; delinquency_61_plus: number;
  portal_activated: number; portal_not_activated: number; portal_no_email: number;
};

async function computePortfolioStats(supabase: any, portfolioId: string | null | undefined): Promise<Stats> {
  const { data: s } = await supabase.from('v_dashboard_summary').select('*')
    .eq('portfolio_id', portfolioId ?? '00000000-0000-0000-0000-000000000000').maybeSingle();
  return {
    wo_total:           Number(s?.wo_total ?? 0),
    wo_new:             Number(s?.wo_new ?? 0),
    wo_assigned:        Number(s?.wo_assigned ?? 0),
    wo_scheduled:       Number(s?.wo_scheduled ?? 0),
    wo_in_progress:     Number(s?.wo_in_progress ?? 0),
    wo_completed:       Number(s?.wo_completed ?? 0),
    pending_approvals:  Number(s?.pending_approvals ?? 0),
    delinquency_0_30:   Number(s?.delinquency_0_30 ?? 0),
    delinquency_31_60:  Number(s?.delinquency_31_60 ?? 0),
    delinquency_61_plus: Number(s?.delinquency_61_plus ?? 0),
    portal_activated:     Number(s?.portal_activated_count ?? 0),
    portal_not_activated: Number(s?.portal_not_activated_count ?? 0),
    portal_no_email:      Number(s?.portal_no_email_count ?? 0),
  };
}

async function computeAssocStats(supabase: any, assocId: string): Promise<Stats> {
  // Work orders â€” count by status for this association
  const { data: wos } = await supabase.from('work_orders').select('status').eq('association_id', assocId).is('archived_at', null);
  const woBy = (s: string) => (wos ?? []).filter((r: any) => r.status === s).length;

  // Bills pending approval for this association
  const { count: pendingBills } = await supabase.from('bills').select('*', { count: 'exact', head: true })
    .eq('association_id', assocId).eq('status', 'pending_approval').is('archived_at', null);

  // Delinquencies â€” from aged_receivables (already has aging bucket + association_id)
  const { data: aged } = await supabase.from('aged_receivables').select('aging_bucket').eq('association_id', assocId);
  const delinqBy = (b: string | string[]) => {
    const buckets = Array.isArray(b) ? b : [b];
    return (aged ?? []).filter((r: any) => buckets.includes(r.aging_bucket)).length;
  };

  // Portal adoption â€” owners who have an occupancy in this association
  const { data: occs } = await supabase.from('occupancies')
    .select('owner_id, owners!owner_id(portal_activated, email)')
    .eq('association_id', assocId)
    .eq('status', 'current');
  const owners = (occs ?? []).map((o: any) => o.owners).filter(Boolean);
  const portal_activated     = owners.filter((o: any) => o.portal_activated).length;
  const portal_no_email      = owners.filter((o: any) => !o.email).length;
  const portal_not_activated = owners.length - portal_activated - portal_no_email;

  return {
    wo_total:           (wos ?? []).filter((r: any) => !['completed', 'closed', 'cancelled'].includes(r.status)).length,
    wo_new:             woBy('new'),
    wo_assigned:        woBy('assigned'),
    wo_scheduled:       woBy('scheduled'),
    wo_in_progress:     woBy('in_progress'),
    wo_completed:       woBy('completed') + woBy('closed'),
    pending_approvals:  pendingBills ?? 0,
    delinquency_0_30:   delinqBy(['current', '1-30']),
    delinquency_31_60:  delinqBy(['31-60', '61-90']),
    delinquency_61_plus: delinqBy(['90+']),
    portal_activated,
    portal_not_activated,
    portal_no_email,
  };
}

// ============================================================================
// Presentational helpers
// ============================================================================

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <details open className="overflow-hidden rounded border border-gray-200 bg-white">
      <summary className="flex cursor-pointer select-none items-center justify-between border-b border-gray-100 bg-white px-5 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2"><span className="text-gray-500">â–¾</span><h2 className="text-sm font-semibold text-gray-900">{title}</h2></div>
        {right}
      </summary>
      <div>{children}</div>
    </details>
  );
}

function Stat({ big, label, sub, href }: { big: string; label: string; sub?: string; href?: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold">{big}</div>
      <div className="text-sm text-gray-700">{label}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
      {href && <Link href={href} className="mt-1 inline-block text-xs text-blue-700 hover:underline">View history â†’</Link>}
    </div>
  );
}

function PortalTile({ label, n, pct, tone, linkLabel = 'View', linkHref }: {
  label: string; n: number; pct: number; tone: 'green' | 'amber' | 'red'; linkLabel?: string; linkHref: string;
}) {
  const bg = tone === 'green' ? 'bg-green-50' : tone === 'amber' ? 'bg-amber-50' : 'bg-red-50';
  const pctColor = tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : 'text-red-700';
  return (
    <div className={bg + ' px-5 py-4'}>
      <div className={`text-3xl font-bold tabular-nums ${pctColor}`}>{pct}%</div>
      <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</div>
      <div className="mt-1 text-xs text-gray-600">{n} owner{n === 1 ? '' : 's'}</div>
      <Link href={linkHref} className="mt-2 inline-block text-xs text-blue-700 hover:underline">{linkLabel}</Link>
    </div>
  );
}

function NotifStat({ n, label, tone = 'blue', href }: { n: number | string; label: string; tone?: 'blue' | 'red'; href?: string }) {
  const color = tone === 'red' ? 'text-red-700' : 'text-blue-700';
  const content = (
    <div className="px-5 py-3">
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{n}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
  return href ? <Link href={href} className="hover:bg-gray-50">{content}</Link> : content;
}

function NotifRow({ n, label, href }: { n: number; label: string; href?: string }) {
  const inner = <span className="mt-1 flex items-center gap-2 text-sm text-gray-700"><span className="tabular-nums font-semibold">{n}</span><span>{label}</span></span>;
  return href ? <Link href={href} className="hover:text-blue-700">{inner}</Link> : inner;
}

function DelinqCell({ n, label, tone }: { n: number; label: string; tone: 'neutral' | 'amber' | 'red' }) {
  const color = tone === 'neutral' ? 'text-gray-900' : tone === 'amber' ? 'text-amber-700' : 'text-red-700';
  return <div className="px-5 py-4"><div className={`text-2xl font-bold tabular-nums ${color}`}>{n}</div><div className="text-xs text-gray-500">{label}</div></div>;
}

function WoRow({ n, label, href }: { n: number | string; label: string; href?: string }) {
  const inner = <li className="flex items-center justify-between rounded px-2 py-1 hover:bg-gray-50"><span className="tabular-nums font-semibold text-gray-900">{n}</span><span className="text-gray-700">{label}</span></li>;
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function eventLabel(t: string): string {
  const m: Record<string, string> = {
    elevator_reservation: 'Elevator', move_in: 'Move-in', move_out: 'Move-out',
    water_shutoff: 'Water shutoff', vendor_work: 'Vendor',
    common_area_reservation: 'Common area', board_meeting: 'Board mtg',
    inspection: 'Inspection', maintenance: 'Maintenance', meetings: 'Meeting',
    announcements: 'Announce', social_events: 'Social', administrative: 'Admin', other: 'Other',
  };
  return m[t] ?? t;
}

function eventBadge(t: string): string {
  const m: Record<string, string> = {
    elevator_reservation:    'bg-purple-50 text-purple-700 border-purple-200',
    move_in:                 'bg-green-50 text-green-700 border-green-200',
    move_out:                'bg-amber-50 text-amber-700 border-amber-200',
    water_shutoff:           'bg-red-50 text-red-700 border-red-200',
    vendor_work:             'bg-blue-50 text-blue-700 border-blue-200',
    common_area_reservation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    board_meeting:           'bg-slate-50 text-slate-700 border-slate-200',
    inspection:              'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  return m[t] ?? 'bg-gray-50 text-gray-700 border-gray-200';
}
