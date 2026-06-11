import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { buildCommandMetrics } from '@/lib/operations/command-center';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';
import { InsuranceExpirationWidget } from '@/components/dashboard/insurance-expiration-widget';

export const dynamic = 'force-dynamic';

type DashboardSearchParams = Promise<{ assoc?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const sp = await searchParams;
  const assocFilter = sp.assoc ?? '';

  if (me.is_full_access_staff && me.portfolio?.id && process.env.LOCAL_PREVIEW_MODE !== 'true') {
    const { count } = await db
      .from('associations')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', me.portfolio.id);
    if ((count ?? 0) === 0) redirect('/onboard');
  }

  const { data: associations } = await db
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  const activeAssoc = assocFilter ? (associations ?? []).find((association: any) => association.id === assocFilter) : null;
  const today = new Date();
  const todayIso = today.toISOString();
  const todayDate = todayIso.slice(0, 10);

  // Calculate end of week (Sunday 23:59:59)
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  const endOfWeekIso = endOfWeek.toISOString();

  // ── Existing command-center queries ──────────────────────────
  const openViolationsQuery = db
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")');
  const overdueViolationsQuery = db
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')
    .lt('due_date', todayDate);
  const pendingBillsQuery = db
    .from('payable_bills')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .eq('status', 'pending_approval');
  const unreconciledAccountsQuery = db
    .from('bank_accounts')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .is('last_reconciliation_date', null);
  const reportsDueQuery = db
    .from('scheduled_reports')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .eq('active', true)
    .lte('next_run_at', todayIso);
  const openWorkOrdersQuery = db
    .from('work_orders')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")');

  // ── NEW: Demo-worthy real-time metrics ────────────────────────
  // 1. Open violations (already covered above in openViolationsQuery)
  // 2. Maintenance overdue: work_orders past scheduled_date, not completed/closed/cancelled
  const overdueMaintenanceQuery = db
    .from('work_orders')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')
    .lt('scheduled_date', todayDate);

  // 3. Bills awaiting payment: payable_bills approved but not paid
  const awaitingPaymentQuery = db
    .from('payable_bills')
    .select('id, amount', { count: 'exact', head: false })
    .is('archived_at', null)
    .eq('status', 'approved');

  // 4. AR balance: sum of unit_balances where balance > 0
  const arBalanceQuery = db
    .from('unit_balances')
    .select('balance')
    .gt('balance', 0);

  // 5. Upcoming calendar events this week
  const upcomingEventsQuery = db
    .from('calendar_events')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .gte('start_datetime', todayIso)
    .lte('start_datetime', endOfWeekIso);

  // Apply association filter to new queries
  if (assocFilter) {
    openViolationsQuery.eq('association_id', assocFilter);
    overdueViolationsQuery.eq('association_id', assocFilter);
    pendingBillsQuery.eq('association_id', assocFilter);
    unreconciledAccountsQuery.eq('association_id', assocFilter);
    openWorkOrdersQuery.eq('association_id', assocFilter);
    overdueMaintenanceQuery.eq('association_id', assocFilter);
    awaitingPaymentQuery.eq('association_id', assocFilter);
    upcomingEventsQuery.eq('association_id', assocFilter);
    arBalanceQuery.eq('association_id', assocFilter);
  }

  // ── Activity feed queries ─────────────────────────────────────
  const recentViolationsQuery = db
    .from('violations')
    .select('id, title, status, created_at, associations(name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentWorkOrdersQuery = db
    .from('work_orders')
    .select('id, title, status, created_at, associations(name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentBillsQuery = db
    .from('payable_bills')
    .select('id, memo, amount, status, created_at, associations(name), vendors(name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentPaymentsQuery = db
    .from('receivable_payments_ledger')
    .select('payment_id, amount, owner_name, unit_number, created_at, payment_date')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(5);

  if (assocFilter) {
    recentViolationsQuery.eq('association_id', assocFilter);
    recentWorkOrdersQuery.eq('association_id', assocFilter);
    recentBillsQuery.eq('association_id', assocFilter);
    recentPaymentsQuery.eq('association_id', assocFilter);
  }

  const [
    { count: openViolations },
    { count: overdueViolations },
    { count: pendingBills },
    { count: unreconciledBankAccounts },
    { count: scheduledReportsDue },
    { count: openWorkOrders },
    { count: overdueMaintenance },
    { data: awaitingPaymentBills },
    { data: arBalanceRows },
    { count: upcomingEvents },
    { data: focusViolations },
    { data: focusWorkOrders },
    { data: focusBills },
    { data: focusReports },
    { data: recentViolations },
    { data: recentWorkOrders },
    { data: recentBills },
    { data: recentPayments },
  ] = await Promise.all([
    openViolationsQuery,
    overdueViolationsQuery,
    pendingBillsQuery,
    unreconciledAccountsQuery,
    reportsDueQuery,
    openWorkOrdersQuery,
    overdueMaintenanceQuery,
    awaitingPaymentQuery,
    arBalanceQuery,
    upcomingEventsQuery,
    buildViolationQueue(db, assocFilter, todayDate),
    buildWorkOrderQueue(db, assocFilter),
    buildBillQueue(db, assocFilter),
    buildReportQueue(db, todayIso),
    recentViolationsQuery,
    recentWorkOrdersQuery,
    recentBillsQuery,
    recentPaymentsQuery,
  ]);

  const commandMetrics = buildCommandMetrics({
    openViolations: openViolations ?? 0,
    overdueViolations: overdueViolations ?? 0,
    pendingBills: pendingBills ?? 0,
    unreconciledBankAccounts: unreconciledBankAccounts ?? 0,
    scheduledReportsDue: scheduledReportsDue ?? 0,
    openWorkOrders: openWorkOrders ?? 0,
  });

  const linkedMetrics = commandMetrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    sublabel: (
      <Link href={metric.href} className="font-medium text-gray-500 transition-colors hover:text-gray-900">
        Open list
      </Link>
    ),
  }));

  // ── Demo-worthy metrics row ──────────────────────────────────
  const arBalanceTotal = (arBalanceRows ?? []).reduce(
    (sum: number, row: any) => sum + (row.balance ?? 0),
    0,
  );
  const billsAwaitingTotal = (awaitingPaymentBills ?? []).reduce(
    (sum: number, row: any) => sum + (row.amount ?? 0),
    0,
  );

  const demoMetrics = [
    {
      label: 'Maintenance overdue',
      value: overdueMaintenance ?? 0,
      href: '/work-orders?status=overdue',
    },
    {
      label: 'Bills awaiting',
      value: billsAwaitingTotal,
      href: '/bills?status=approved',
    },
    {
      label: 'AR balance',
      value: arBalanceTotal,
      href: '/charges',
    },
    {
      label: 'Events this week',
      value: upcomingEvents ?? 0,
      href: '/calendar',
    },
  ].map((m) => ({
    label: m.label,
    value:
      m.label === 'AR balance' || m.label === 'Bills awaiting'
        ? money(m.value)
        : m.value,
    sublabel: (
      <Link href={m.href} className="font-medium text-gray-500 transition-colors hover:text-gray-900">
        Open list
      </Link>
    ),
  }));

  const focusItems = [
    ...(focusViolations ?? []).map((item: any) => ({
      key: `violation-${item.id}`,
      label: item.title,
      detail: `${item.associations?.name ?? 'Association'} - due ${date(item.due_date)}`,
      href: '/violations?status=overdue',
      tone: 'red' as const,
      type: 'Violation',
    })),
    ...(focusBills ?? []).map((item: any) => ({
      key: `bill-${item.id}`,
      label: item.vendors?.name ?? item.memo ?? 'Bill awaiting approval',
      detail: `${item.associations?.name ?? 'Portfolio'} - due ${date(item.due_date)}`,
      href: '/bills?status=pending_approval',
      tone: 'amber' as const,
      type: 'Bill',
    })),
    ...(focusWorkOrders ?? []).map((item: any) => ({
      key: `work-order-${item.id}`,
      label: item.title,
      detail: `${item.associations?.name ?? 'Association'} - ${formatStatus(item.status)}`,
      href: `/work-orders/${item.id}`,
      tone: item.priority === 'emergency' ? 'red' as const : 'blue' as const,
      type: 'Work order',
    })),
    ...(focusReports ?? []).map((item: any) => ({
      key: `report-${item.id}`,
      label: item.name,
      detail: `Next run ${date(item.next_run_at)} - ${formatStatus(item.delivery_channel)}`,
      href: '/scheduled-reports',
      tone: 'slate' as const,
      type: 'Report',
    })),
  ].slice(0, 10);

  // ── Build activity feed ──────────────────────────────────────
  type ActivityItem = {
    id: string;
    type: 'violation' | 'work_order' | 'bill' | 'payment';
    label: string;
    detail: string;
    created_at: string;
    tone: 'red' | 'green' | 'amber' | 'blue';
    href: string;
  };

  const activityFeed: ActivityItem[] = [
    ...(recentViolations ?? []).map((v: any) => ({
      id: `v-${v.id}`,
      type: 'violation' as const,
      label: `New violation: ${v.title}`,
      detail: `${v.associations?.name ?? 'Association'} — ${formatStatus(v.status)}`,
      created_at: v.created_at,
      tone: 'red' as const,
      href: `/violations/${v.id}`,
    })),
    ...(recentWorkOrders ?? []).map((w: any) => ({
      id: `wo-${w.id}`,
      type: 'work_order' as const,
      label: `Work order: ${w.title}`,
      detail: `${w.associations?.name ?? 'Association'} — ${formatStatus(w.status)}`,
      created_at: w.created_at,
      tone: w.status === 'completed' ? 'green' as const : 'blue' as const,
      href: `/work-orders/${w.id}`,
    })),
    ...(recentBills ?? []).map((b: any) => ({
      id: `bill-${b.id}`,
      type: 'bill' as const,
      label: `Bill: ${b.vendors?.name ?? b.memo ?? 'Untitled'}`,
      detail: `${b.associations?.name ?? 'Portfolio'} — ${money(b.amount)} — ${formatStatus(b.status)}`,
      created_at: b.created_at,
      tone: 'amber' as const,
      href: `/bills?status=${b.status}`,
    })),
    ...(recentPayments ?? []).map((p: any) => ({
      id: `pmt-${p.payment_id}`,
      type: 'payment' as const,
      label: `Payment received`,
      detail: `${p.owner_name ?? 'Owner'} — ${p.unit_number ? `Unit ${p.unit_number} — ` : ''}${money(p.amount)}`,
      created_at: p.created_at ?? p.payment_date,
      tone: 'green' as const,
      href: `/charges`,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return (
    <DataWorkspace
      title={activeAssoc ? `${activeAssoc.name} command center` : 'Command center'}
      description="A staff-first operating view for exceptions, approvals, reconciliations, report runs, and maintenance work across the portfolio."
      actions={
        <>
          <form action="/dashboard" method="get" className="flex items-center gap-2">
            <Select name="assoc" defaultValue={assocFilter} className="min-w-44" aria-label="Filter by association">
              <option value="">All associations</option>
              {(associations ?? []).map((association: any) => (
                <option key={association.id} value={association.id}>{association.name}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
          <Link href="/work-orders"><Button>Open work orders</Button></Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={linkedMetrics} />

        {/* ── Quick Actions ────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-400">Quick actions</span>
          <Link href="/violations/new">
            <Button variant="secondary" size="sm" className="text-sm font-medium">
              + Report Violation
            </Button>
          </Link>
          <Link href="/maintenance/new">
            <Button variant="secondary" size="sm" className="text-sm font-medium">
              + Add Maintenance
            </Button>
          </Link>
          <Link href="/bills/new">
            <Button variant="secondary" size="sm" className="text-sm font-medium">
              + Create Bill
            </Button>
          </Link>
          <Link href="/calendar/new">
            <Button variant="secondary" size="sm" className="text-sm font-medium">
              + Schedule Event
            </Button>
          </Link>
        </div>

        {/* ── Demo Metrics Row ─────────────────────────────── */}
        <MetricStrip metrics={demoMetrics} />

        {/* ── Focus queue ──────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-gray-950">Focus queue</h2>
              <p className="mt-0.5 text-xs text-gray-500">Highest leverage items needing staff attention.</p>
            </div>
            <Link href="/inbox" className="text-[13px] font-medium text-gray-900 underline-offset-4 hover:underline">Open inbox</Link>
          </div>
          {focusItems.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {focusItems.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={badgeTone(item.tone)}>{item.type}</Badge>
                        <span className="truncate text-sm font-medium text-gray-950">{item.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-medium text-gray-500">Review →</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-gray-500">No urgent operating items in the queue.</div>
          )}
        </section>

        {/* ── Recent Activity Feed ──────────────────────────── */}
        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-gray-950">Recent activity</h2>
              <p className="mt-0.5 text-xs text-gray-500">Latest events across violations, maintenance, bills, and payments.</p>
            </div>
          </div>
          {activityFeed.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {activityFeed.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone={badgeTone(item.tone)}>
                          {item.type === 'violation' ? 'Violation' : item.type === 'work_order' ? 'Maintenance' : item.type === 'bill' ? 'Bill' : 'Payment'}
                        </Badge>
                        <span className="truncate text-sm font-medium text-gray-950">{item.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{timeAgo(item.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-gray-500">No recent activity to display.</div>
          )}
        </section>

        <InsuranceExpirationWidget />
      </div>
    </DataWorkspace>
  );
}

function buildViolationQueue(db: any, assocFilter: string, todayDate: string) {
  let query = db
    .from('violations')
    .select('id, title, status, due_date, associations(name)')
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')
    .lt('due_date', todayDate)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(4);
  if (assocFilter) query = query.eq('association_id', assocFilter);
  return query;
}

function buildWorkOrderQueue(db: any, assocFilter: string) {
  let query = db
    .from('work_orders')
    .select('id, title, status, priority, associations(name)')
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')
    .order('priority', { ascending: false })
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(4);
  if (assocFilter) query = query.eq('association_id', assocFilter);
  return query;
}

function buildBillQueue(db: any, assocFilter: string) {
  let query = db
    .from('payable_bills')
    .select('id, due_date, memo, associations(name), vendors(name)')
    .is('archived_at', null)
    .eq('status', 'pending_approval')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(4);
  if (assocFilter) query = query.eq('association_id', assocFilter);
  return query;
}

function buildReportQueue(db: any, todayIso: string) {
  return db
    .from('scheduled_reports')
    .select('id, name, next_run_at, delivery_channel')
    .is('archived_at', null)
    .eq('active', true)
    .lte('next_run_at', todayIso)
    .order('next_run_at', { ascending: true, nullsFirst: false })
    .limit(4);
}

function badgeTone(tone: 'red' | 'amber' | 'blue' | 'slate' | 'green') {
  const tones = {
    red: 'danger',
    amber: 'pending',
    blue: 'open',
    slate: 'inactive',
    green: 'complete',
  } as const;
  return tones[tone];
}

function formatStatus(status: string | null | undefined) {
  return status ? status.replace(/_/g, ' ') : 'not set';
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date(dateStr);
}
