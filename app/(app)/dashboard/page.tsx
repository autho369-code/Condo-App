import type * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Section } from '@/components/workspace/shell';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Alert, Badge } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { computeReminders } from '@/lib/reminders';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';
import { displayTimeZone, isValidTimeZone } from '@/lib/time/display-zone';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const DAY = 86400000;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const isOnline = (p: { method?: string | null; processor?: string | null }) => p.method === 'online' || !!p.processor;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ assoc?: string }> }) {
  const me = await requireStaff();
  const db = (await createClient()) as any;
  const sp = await searchParams;

  if (me.is_full_access_staff && me.portfolio?.id && process.env.LOCAL_PREVIEW_MODE !== 'true') {
    const { count } = await db
      .from('associations')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', me.portfolio.id);
    if ((count ?? 0) === 0) redirect('/onboard');
  }

  const { data: associations } = await db.from('associations').select('id, name, timezone').is('archived_at', null).order('name');
  const activeAssoc = UUID.test(sp.assoc ?? '') ? (associations ?? []).find((a: any) => a.id === sp.assoc) : null;
  const assoc: string = activeAssoc?.id ?? '';
  const byAssoc = (q: any, column = 'association_id') => (assoc ? q.eq(column, assoc) : q);

  // Local dates: the selected association's zone, else the portfolio's.
  const zone = activeAssoc?.timezone && isValidTimeZone(activeAssoc.timezone) ? activeAssoc.timezone : displayTimeZone();
  const now = new Date();
  const todayDate = todayInZone(zone, now);
  const [ty, tm, td] = todayDate.split('-').map(Number);
  const localDate = (offsetDays: number) => new Date(Date.UTC(ty, tm - 1, td + offsetDays)).toISOString().slice(0, 10);
  const since30 = localDate(-30);
  // The week starts Monday at local midnight.
  const dow = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
  const weekStartIso = (zonedWallTimeToUtc(localDate(-((dow + 6) % 7)), '00:00', zone) ?? now).toISOString();
  const nowIso = now.toISOString();
  const in7Iso = new Date(now.getTime() + 7 * DAY).toISOString();

  // Payments carry no association_id; filter through unit -> building.
  const unitJoin = assoc ? ', units!inner(buildings!inner(association_id))' : '';
  const onAssoc = (q: any) => byAssoc(q, 'units.buildings.association_id');

  const [payments, manualThisWeek, homeowners, activitiesDue, activitiesOverdue, billsPending, poDrafts, poAwaiting, serviceRequests, reminderGroups] = await Promise.all([
    // Online payment statistics: the last 30 days of receipts (credits are not payments).
    fetchAllRows<any>(() => onAssoc(db.from('payments')
      .select(`id, unit_id, amount, method, processor${unitJoin}`)
      .gte('payment_date', since30)
      .lte('payment_date', todayDate)
      .neq('method', 'credit'))
      .order('id'), { maxRows: 50000 }),
    // Receipts staff typed in by hand this week.
    onAssoc(db.from('payments')
      .select(`id${unitJoin}`, { count: 'exact', head: true })
      .gte('created_at', weekStartIso)
      .is('processor', null)
      .not('method', 'in', '("online","credit")')),
    // Portal adoption: current homeowners, each owner counted once.
    fetchAllRows<any>(() => byAssoc(db.from('occupancies')
      .select('id, owner_id, owners!inner(portal_activated, auth_user_id, email, archived_at)')
      .eq('status', 'current')
      .eq('occupancy_type', 'owner')
      .is('owners.archived_at', null))
      .order('id'), { maxRows: 50000 }),
    byAssoc(db.from('automation_tasks').select('id', { count: 'exact', head: true }).eq('status', 'open').gte('due_at', nowIso).lt('due_at', in7Iso)),
    byAssoc(db.from('automation_tasks').select('id', { count: 'exact', head: true }).eq('status', 'open').lt('due_at', nowIso)),
    byAssoc(db.from('payable_bills').select('id', { count: 'exact', head: true }).is('archived_at', null).eq('status', 'pending_approval')),
    byAssoc(db.from('purchase_orders').select('id', { count: 'exact', head: true }).is('archived_at', null).neq('status', 'cancelled').eq('approval_status', 'draft')),
    byAssoc(db.from('purchase_orders').select('id', { count: 'exact', head: true }).is('archived_at', null).neq('status', 'cancelled').eq('approval_status', 'pending_approval')),
    byAssoc(db.from('service_requests')
      .select('id, number, description, created_at, associations(name), owner:owners!service_requests_owner_id_fkey(full_name), homeowner:owners!service_requests_homeowner_id_fkey(full_name), tenants(first_name, last_name)')
      .is('archived_at', null)
      .in('status', ['open', 'waiting'])
      .gte('created_at', new Date(now.getTime() - 30 * DAY).toISOString()))
      .order('created_at', { ascending: false })
      .limit(25),
    computeReminders(db, me.portfolio?.id, assoc || undefined),
  ]);

  const loadErrors = [
    payments.error && 'online payments',
    manualThisWeek.error && 'manual receipts',
    homeowners.error && 'portal adoption',
    (activitiesDue.error || activitiesOverdue.error) && 'activities',
    billsPending.error && 'bills',
    (poDrafts.error || poAwaiting.error) && 'purchase orders',
    serviceRequests.error && 'service requests',
  ].filter(Boolean) as string[];
  const truncated = [payments.truncated && 'online payments', homeowners.truncated && 'portal adoption'].filter(Boolean) as string[];

  // ── Online payments ──────────────────────────────────────────
  const paymentTotal = payments.rows.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const onlineTotal = payments.rows.filter(isOnline).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const unitsPaid = new Set(payments.rows.map((p) => p.unit_id).filter(Boolean));
  const unitsPaidOnline = new Set(payments.rows.filter(isOnline).map((p) => p.unit_id).filter(Boolean));
  const manualCount = manualThisWeek.count ?? 0;

  // ── Portal adoption ──────────────────────────────────────────
  // Same classification as the activation page: an owner with an account
  // but access off counts as not activated, whatever their email.
  const owners = new Map<string, 'active' | 'inactive' | 'no_email'>();
  for (const row of homeowners.rows) {
    if (!row.owner_id) continue;
    const o = row.owners ?? {};
    owners.set(row.owner_id, o.portal_activated ? 'active' : o.auth_user_id || EMAIL.test(String(o.email ?? '').trim().toLowerCase()) ? 'inactive' : 'no_email');
  }
  const ownerList = [...owners.values()];
  const activated = ownerList.filter((o) => o === 'active').length;
  const noEmail = ownerList.filter((o) => o === 'no_email').length;
  const notActivated = ownerList.length - activated - noEmail;

  // ── Notifications feed ───────────────────────────────────────
  type FeedItem = { key: string; kind: string; title: string; detail: string; href: string };
  const feed: FeedItem[] = [
    ...(serviceRequests.data ?? []).map((r: any) => {
      const tenant = r.tenants ? `${r.tenants.first_name ?? ''} ${r.tenants.last_name ?? ''}`.trim() : '';
      const from = r.owner?.full_name ?? r.homeowner?.full_name ?? (tenant || null);
      return {
        key: `sr-${r.id}`,
        kind: 'Service request',
        title: `New service request${from ? ` from ${from}` : ''}`,
        detail: [r.associations?.name, new Date(r.created_at).toLocaleString('en-US', { timeZone: zone, month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })].filter(Boolean).join(' · '),
        href: `/service-requests/${r.id}`,
      };
    }),
    ...reminderGroups.flatMap((group) => group.items.map((item, i) => ({
      key: `${group.key}-${i}`,
      kind: group.label,
      title: item.title,
      detail: item.detail,
      href: item.href,
    }))),
  ];

  const assocQs = assoc ? `&association=${assoc}` : '';
  const activationsHref = `/owners/activations?status=inactive${assocQs}`;
  const assocParam = assoc ? `&association_id=${assoc}` : '';
  const receiptsHref = `/receipts?range=30d${assoc ? `&assoc=${assoc}` : ''}`;
  const tileLink = (href: string, label: string) => (
    <Link href={href} className="font-medium text-gray-500 underline-offset-4 transition-colors hover:text-gray-900 hover:underline">{label}</Link>
  );

  const overdue = activitiesOverdue.count ?? 0;
  const financeAccess = !!(me.is_finance_staff || me.is_platform_operator);
  // The same create pages the command palette offers this user.
  const quickActions = [
    { label: 'New work order', href: '/work-orders/new' },
    { label: 'New violation', href: '/violations/new' },
    ...(financeAccess ? [{ label: 'Homeowner receipt', href: '/receipts/new' }, { label: 'New bill', href: '/bills/new' }] : []),
    { label: 'New homeowner', href: '/owners/new' },
    { label: 'New vendor', href: '/vendors/new' },
    { label: 'Schedule meeting', href: '/meetings/new' },
    { label: 'New letter', href: '/letters/new' },
  ];

  return (
    <DataWorkspace
      title={activeAssoc ? `${activeAssoc.name} dashboard` : 'Dashboard'}
      description={`What needs attention today, ${date(todayDate)}.`}
      actions={
        <form action="/dashboard" method="get" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select name="assoc" defaultValue={assoc} className="min-w-0 flex-1 sm:w-56 sm:flex-none" aria-label="View by association">
            <option value="">All associations</option>
            {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Button type="submit" variant="secondary">View</Button>
        </form>
      }
    >
      <div className="space-y-6">
        {loadErrors.length > 0 && (
          <Alert tone="danger" title="Some figures could not load">Could not load: {loadErrors.join(', ')}. Refresh to try again.</Alert>
        )}
        {truncated.length > 0 && (
          <Alert tone="warning" title="Some figures are incomplete">Too many rows to load for: {truncated.join(', ')}. Pick one association to see complete figures.</Alert>
        )}

        <section aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="mb-3 font-display text-[17px] font-semibold tracking-[-0.015em] text-ink">Needs attention</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AttentionCard label="Overdue activities" count={activitiesOverdue.error ? null : overdue} tone={overdue > 0 ? 'danger' : 'calm'} href="/automation-center" cta="Open tasks" />
            <AttentionCard label="Due in the next 7 days" count={activitiesDue.error ? null : activitiesDue.count ?? 0} href="/automation-center" cta="Open tasks" />
            <AttentionCard label="Bills pending approval" count={billsPending.error ? null : billsPending.count ?? 0} tone={(billsPending.count ?? 0) > 0 ? 'warning' : 'calm'} href={`/bills?status=pending_approval${assocParam}`} cta="Review bills" />
            <AttentionCard label="Purchase-order drafts to submit" count={poDrafts.error ? null : poDrafts.count ?? 0} href={`/purchase-orders?status=draft${assocParam}`} cta="Review drafts" />
            <AttentionCard label="Awaiting board approval" count={poAwaiting.error ? null : poAwaiting.count ?? 0} href={`/purchase-orders?status=pending_approval${assocParam}`} cta="Review" />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <Section
            title="Notifications feed"
            subtitle={`Open service requests from the last 30 days, then alerts due as of ${date(todayDate)}.`}
            actions={<Link href="/reminders" className="inline-flex min-h-10 items-center text-[13.5px] font-medium text-gray-600 underline-offset-4 hover:text-gray-950 hover:underline">Choose notifications</Link>}
          >
            {feed.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-500">{serviceRequests.error ? 'Service requests could not load.' : 'No new notifications.'}</p>
            ) : (
              <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
                {feed.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="flex min-h-[52px] flex-col gap-1.5 px-5 py-3.5 hover:bg-gray-50/70 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink">{item.title}</div>
                        <div className="mt-0.5 text-[13px] text-gray-500">{item.detail}</div>
                      </div>
                      <span className="shrink-0"><Badge tone={item.kind === 'Service request' ? 'open' : item.kind === 'Delinquent accounts' ? 'danger' : 'pending'}>{item.kind}</Badge></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="space-y-6">
            <Section title="Quick actions">
              <ul className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2 xl:grid-cols-1">
                {quickActions.map((action) => (
                  <li key={action.href}>
                    <Link href={action.href} className="flex min-h-10 items-center justify-between rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-ink">
                      {action.label}<span aria-hidden="true" className="text-gray-400">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Online payments" subtitle="Last 30 days" padded>
              <dl className="grid grid-cols-2 gap-4">
                <Figure label="Collected online" value={paymentTotal > 0 ? `${pct(onlineTotal, paymentTotal)}%` : '—'} sub={paymentTotal > 0 ? tileLink(receiptsHref, 'View receipts') : 'No receipts in the last 30 days'} />
                <Figure label="Units paying online" value={unitsPaid.size > 0 ? `${pct(unitsPaidOnline.size, unitsPaid.size)}%` : '—'} sub={unitsPaid.size > 0 ? <>{unitsPaidOnline.size} of {unitsPaid.size} units that paid</> : 'No units paid in the last 30 days'} />
              </dl>
              {manualCount > 0 && (
                <div className="mt-4">
                  <Alert tone="info" title={`${manualCount} receipt${manualCount === 1 ? '' : 's'} entered by hand this week`}>
                    Owners who pay in the portal post automatically. <Link href={activationsHref} className="underline">Invite owners to the portal</Link>.
                  </Alert>
                </div>
              )}
            </Section>

            <Section title="Owner portal adoption" padded>
              {ownerList.length === 0 ? (
                <p className="text-sm text-gray-500">No current homeowners{activeAssoc ? ' in this association' : ''}.</p>
              ) : (
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
                  <Figure label="Activated" value={`${pct(activated, ownerList.length)}%`} sub={<>{activated} owner{activated === 1 ? '' : 's'} · {tileLink(`/owners/activations?status=active${assocQs}`, 'View homeowners')}</>} />
                  <Figure label="Not activated" value={`${pct(notActivated, ownerList.length)}%`} sub={<>{notActivated} owner{notActivated === 1 ? '' : 's'} · {tileLink(activationsHref, 'Send activation emails')}</>} />
                  <Figure label="No email" value={`${pct(noEmail, ownerList.length)}%`} sub={<>{noEmail} owner{noEmail === 1 ? '' : 's'} · {tileLink(`/owners/activations?status=no_email${assocQs}`, 'View homeowners')}</>} />
                </dl>
              )}
            </Section>
          </div>
        </div>
      </div>
    </DataWorkspace>
  );
}

/** A count that needs attention, opening the list it counts. A failed count shows a dash, never 0. */
function AttentionCard({ label, count, href, cta, tone = 'calm' }: { label: string; count: number | null; href: string; cta: string; tone?: 'calm' | 'warning' | 'danger' }) {
  const ink = count == null ? 'text-gray-400' : tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : 'text-ink';
  return (
    <Link href={href} className="group flex min-h-[112px] flex-col justify-between rounded-2xl border border-line bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-gray-300 hover:bg-gray-50/60">
      <div className="text-[13.5px] font-medium leading-5 text-gray-600">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className={`font-display text-[30px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${ink}`}>{count == null ? '—' : count}</span>
        <span className="text-[13px] font-medium text-gray-500 group-hover:text-ink">{cta} ›</span>
      </div>
    </Link>
  );
}

function Figure({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 font-display text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</dd>
      {sub && <dd className="mt-1 text-[13px] leading-5 text-gray-500">{sub}</dd>}
    </div>
  );
}
