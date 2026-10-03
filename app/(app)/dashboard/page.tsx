import type * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
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

  return (
    <DataWorkspace
      title={activeAssoc ? `${activeAssoc.name} dashboard` : 'Dashboard'}
      actions={
        <form action="/dashboard" method="get" className="flex items-center gap-2">
          <Select name="assoc" defaultValue={assoc} className="min-w-44" aria-label="View by association">
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

        <DashboardSection title="Online payments">
          <SubHeading>Last 30 days</SubHeading>
          <MetricStrip
            metrics={[
              { label: 'Collected online', value: paymentTotal > 0 ? `${pct(onlineTotal, paymentTotal)}%` : '—', sublabel: paymentTotal > 0 ? tileLink(receiptsHref, 'View receipts') : 'No receipts in the last 30 days' },
              { label: 'Units paying online', value: unitsPaid.size > 0 ? `${pct(unitsPaidOnline.size, unitsPaid.size)}%` : '—', sublabel: unitsPaid.size > 0 ? <>{unitsPaidOnline.size} of {unitsPaid.size} units that paid</> : 'No units paid in the last 30 days' },
            ]}
          />
          {manualCount > 0 && (
            <div className="mt-3">
              <Alert tone="info" title={`${manualCount} receipt${manualCount === 1 ? '' : 's'} entered by hand this week`}>
                Owners who pay in the portal post automatically. <Link href={activationsHref} className="underline">Invite owners to the portal</Link>.
              </Alert>
            </div>
          )}

          <SubHeading className="mt-6">Owner portal adoption</SubHeading>
          {ownerList.length === 0 ? (
            <p className="text-sm text-gray-500">No current homeowners{activeAssoc ? ' in this association' : ''}.</p>
          ) : (
            <MetricStrip
              metrics={[
                { label: 'Activated', value: `${pct(activated, ownerList.length)}%`, sublabel: <>{activated} owner{activated === 1 ? '' : 's'} · {tileLink(`/owners/activations?status=active${assocQs}`, 'View homeowners')}</> },
                { label: 'Not activated', value: `${pct(notActivated, ownerList.length)}%`, sublabel: <>{notActivated} owner{notActivated === 1 ? '' : 's'} · {tileLink(activationsHref, 'Send activation emails')}</> },
                { label: 'No email', value: `${pct(noEmail, ownerList.length)}%`, sublabel: <>{noEmail} owner{noEmail === 1 ? '' : 's'} · {tileLink(`/owners/activations?status=no_email${assocQs}`, 'View homeowners')}</> },
              ]}
            />
          )}
        </DashboardSection>

        <DashboardSection title="Notifications">
          <SubHeading>Activities</SubHeading>
          <MetricStrip
            metrics={[
              { label: 'Due in the next 7 days', value: activitiesDue.count ?? 0, sublabel: tileLink('/automation-center', 'Open tasks') },
              { label: 'Overdue', value: <span className={(activitiesOverdue.count ?? 0) > 0 ? 'text-red-700' : undefined}>{activitiesOverdue.count ?? 0}</span>, sublabel: tileLink('/automation-center', 'Open tasks') },
            ]}
          />

          <SubHeading className="mt-6">Bills</SubHeading>
          <MetricStrip metrics={[{ label: 'Pending approval', value: billsPending.count ?? 0, sublabel: tileLink(`/bills?status=pending_approval${assocParam}`, 'Review bills') }]} />

          <SubHeading className="mt-6">Purchase orders</SubHeading>
          <MetricStrip
            metrics={[
              { label: 'Drafts to submit', value: poDrafts.count ?? 0, sublabel: tileLink(`/purchase-orders?status=draft${assocParam}`, 'Review drafts') },
              { label: 'Awaiting board approval', value: poAwaiting.count ?? 0, sublabel: tileLink(`/purchase-orders?status=pending_approval${assocParam}`, 'Review') },
            ]}
          />

          <div className="mt-6 mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold text-gray-700">Notifications feed</h3>
            <Link href="/reminders" className="text-[13px] font-medium text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline">Choose notifications</Link>
          </div>
          {feed.length === 0 ? (
            <div className="rounded-xl border border-gray-200/70 px-5 py-8 text-center text-sm text-gray-500">No new notifications.</div>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200/70">
              {feed.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="flex min-h-[44px] flex-col gap-1 px-4 py-3 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-950">{item.title}</div>
                      <div className="mt-0.5 truncate text-xs text-gray-500">{item.detail}</div>
                    </div>
                    <span className="shrink-0"><Badge tone={item.kind === 'Service request' ? 'open' : item.kind === 'Delinquent accounts' ? 'danger' : 'pending'}>{item.kind}</Badge></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-gray-400">Open service requests from the last 30 days, then alerts due as of {date(todayDate)}.</p>
        </DashboardSection>
      </div>
    </DataWorkspace>
  );
}

function DashboardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 border-b border-gray-100 px-5 py-3 text-[15px] font-semibold tracking-[-0.01em] text-gray-950 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-gray-400 transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="p-5">{children}</div>
    </details>
  );
}

function SubHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`mb-3 text-[13px] font-semibold text-gray-700 ${className}`}>{children}</h3>;
}
