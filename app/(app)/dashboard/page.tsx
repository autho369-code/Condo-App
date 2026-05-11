import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Workspace, WorkspaceHeader, Section, Tile } from '@/components/workspace/shell';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/operations/status-chip';
import { requireStaff } from '@/lib/auth/me';
import { buildCommandMetrics } from '@/lib/operations/command-center';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type DashboardSearchParams = Promise<{ assoc?: string }>;

/**
 * Editorial command centre for portfolio managers.
 * Structure (top → bottom):
 *   1. Operating tiles  — 6 KPI counts (existing v0 surface)
 *   2. Financial snapshot — pulled from v_dashboard_summary
 *   3. Focus queue + activity rail (two-column)
 */
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

  const activeAssoc = assocFilter
    ? (associations ?? []).find((a: any) => a.id === assocFilter)
    : null;

  const today = new Date();
  const todayIso = today.toISOString();
  const todayDate = todayIso.slice(0, 10);

  // ---- Operating queue counts (unchanged from v0) -------------------------
  const baseQuery = (table: string) => db.from(table).select('id', { count: 'exact', head: true });
  const openViolationsQuery = baseQuery('violations')
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")');
  const overdueViolationsQuery = baseQuery('violations')
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')
    .lt('due_date', todayDate);
  const pendingBillsQuery = baseQuery('payable_bills')
    .is('archived_at', null)
    .eq('status', 'pending_approval');
  const unreconciledAccountsQuery = baseQuery('bank_accounts')
    .is('archived_at', null)
    .is('last_reconciliation_date', null);
  const reportsDueQuery = baseQuery('scheduled_reports')
    .is('archived_at', null)
    .eq('active', true)
    .lte('next_run_at', todayIso);
  const openWorkOrdersQuery = baseQuery('work_orders')
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")');

  if (assocFilter) {
    [openViolationsQuery, overdueViolationsQuery, pendingBillsQuery, unreconciledAccountsQuery, openWorkOrdersQuery]
      .forEach((q) => q.eq('association_id', assocFilter));
  }

  // Financial snapshot view — scoped to the manager's portfolio
  const dashSummaryQuery = me.portfolio?.id
    ? db.from('v_dashboard_summary').select('*').eq('portfolio_id', me.portfolio.id).maybeSingle()
    : Promise.resolve({ data: null });

  // Recent activity feed (portfolio-scoped via RLS)
  const activityQuery = db
    .from('activity')
    .select('id, action, agent, details, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(8);

  const [
    { count: openViolations },
    { count: overdueViolations },
    { count: pendingBills },
    { count: unreconciledBankAccounts },
    { count: scheduledReportsDue },
    { count: openWorkOrders },
    { data: focusViolations },
    { data: focusWorkOrders },
    { data: focusBills },
    { data: focusReports },
    { data: dashSummary },
    { data: recentActivity },
  ] = await Promise.all([
    openViolationsQuery,
    overdueViolationsQuery,
    pendingBillsQuery,
    unreconciledAccountsQuery,
    reportsDueQuery,
    openWorkOrdersQuery,
    buildViolationQueue(db, assocFilter, todayDate),
    buildWorkOrderQueue(db, assocFilter),
    buildBillQueue(db, assocFilter),
    buildReportQueue(db, todayIso),
    dashSummaryQuery,
    activityQuery,
  ]);

  const commandMetrics = buildCommandMetrics({
    openViolations: openViolations ?? 0,
    overdueViolations: overdueViolations ?? 0,
    pendingBills: pendingBills ?? 0,
    unreconciledBankAccounts: unreconciledBankAccounts ?? 0,
    scheduledReportsDue: scheduledReportsDue ?? 0,
    openWorkOrders: openWorkOrders ?? 0,
  });

  const focusItems = composeFocusQueue(focusViolations, focusBills, focusWorkOrders, focusReports);

  // -------------------------------------------------------------------------
  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={activeAssoc ? activeAssoc.name : 'Portfolio'}
          title={activeAssoc ? `${activeAssoc.name} command centre` : 'Command centre'}
          subtitle="A staff-first operating view for exceptions, approvals, reconciliations, report runs, and maintenance work — the day, in one screen."
          actions={
            <>
              <form action="/dashboard" method="get" className="flex items-center gap-2">
                <select
                  name="assoc"
                  defaultValue={assocFilter}
                  className="h-10 rounded-md border border-ink-200 bg-white px-3.5 text-sm text-ink-800 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
                >
                  <option value="">All associations</option>
                  {(associations ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="md">Apply</Button>
              </form>
              <Link href="/work-orders"><Button size="md" variant="primary">Open work orders →</Button></Link>
            </>
          }
        />
      }
      rail={<ActivityRail items={recentActivity ?? []} />}
    >
      {/* ---- Operating tiles -------------------------------------------- */}
      <div className="mb-2 flex items-baseline justify-between">
        <div className="eyebrow">Operating queue</div>
        <span className="text-xs text-ink-500">As of {date(today)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {commandMetrics.map((m) => (
          <Tile
            key={m.label}
            label={m.label}
            value={m.value}
            href={m.href}
            tone={metricTone(m.label, m.value)}
          />
        ))}
      </div>

      {/* ---- Financial snapshot ----------------------------------------- */}
      {dashSummary && (
        <Section
          title="Financial snapshot"
          subtitle="Cash flow, delinquency, and approvals — what the board will ask about Monday morning."
          padded
          className="mt-7"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <FinanceTile
              label="Outstanding bills"
              value={money(Number(dashSummary.outstanding_bills ?? 0))}
              sub={`${dashSummary.pending_approvals ?? 0} awaiting approval`}
              tone="warning"
              href="/bills?status=pending_approval"
            />
            <FinanceTile
              label="Delinquency · 0–30 d"
              value={money(Number(dashSummary.delinquency_0_30 ?? 0))}
              sub="Current cycle"
              tone="neutral"
              href="/reports/ar-aging"
            />
            <FinanceTile
              label="Delinquency · 31–60 d"
              value={money(Number(dashSummary.delinquency_31_60 ?? 0))}
              sub="Approaching escalation"
              tone="warning"
              href="/reports/ar-aging"
            />
            <FinanceTile
              label="Delinquency · 61 d +"
              value={money(Number(dashSummary.delinquency_61_plus ?? 0))}
              sub="Collections candidates"
              tone="danger"
              href="/reports/ar-aging"
            />
          </div>

          <div className="mt-6 grid gap-4 border-t border-ink-100 pt-6 md:grid-cols-4">
            <SnapshotMicro
              label="Occupancy"
              value={`${Number(dashSummary.occupancy_pct ?? 0).toFixed(1)}%`}
            />
            <SnapshotMicro
              label="Insurance · 60 d"
              value={String(dashSummary.insurance_expirations_60d ?? 0)}
              hint="expiring"
            />
            <SnapshotMicro
              label="Recent payments"
              value={String(dashSummary.recent_payment_count ?? 0)}
              hint="last 30 days"
            />
            <SnapshotMicro
              label="Work orders assigned"
              value={String(dashSummary.wo_assigned ?? 0)}
              hint="in flight"
            />
          </div>
        </Section>
      )}

      {/* ---- Focus queue ------------------------------------------------ */}
      <Section
        title="Focus queue"
        subtitle="Highest-leverage items across modules — addressed in this list, your day collapses to one inbox."
        actions={
          <Link
            href="/inbox"
            className="text-sm font-medium text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 transition-colors"
          >
            Open full inbox →
          </Link>
        }
        className="mt-7"
      >
        {focusItems.length > 0 ? (
          <ul className="divide-y divide-ink-100">
            {focusItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-cream-50/60"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <StatusChip tone={item.chipTone}>{item.type}</StatusChip>
                    <div className="min-w-0">
                      <div className="font-display text-base text-ink-900 tracking-editorial truncate">
                        {item.label}
                      </div>
                      <div className="mt-1 text-xs text-ink-500">{item.detail}</div>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-champagne-700 group-hover:text-champagne-800 transition-colors">
                    Review →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-14 text-center">
            <div className="font-display text-xl text-ink-900 tracking-editorial">All quiet on the queue.</div>
            <div className="mt-2 text-sm text-ink-500">Nothing urgent at the moment — well done.</div>
          </div>
        )}
      </Section>
    </Workspace>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function metricTone(label: string, value: number): 'neutral' | 'warning' | 'danger' {
  const v = Number(value);
  if (v === 0) return 'neutral';
  if (label.toLowerCase().includes('overdue')) return 'danger';
  if (label.toLowerCase().includes('unreconciled') && v >= 3) return 'warning';
  return 'neutral';
}

function FinanceTile({
  label, value, sub, tone, href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone: 'neutral' | 'warning' | 'danger';
  href?: string;
}) {
  return <Tile label={label} value={value} sub={sub} tone={tone} href={href} />;
}

function SnapshotMicro({
  label, value, hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 font-display text-2xl text-ink-900 number-plate tracking-editorial">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

function ActivityRail({ items }: { items: any[] }) {
  return (
    <div>
      <div className="border-b border-ink-100 pb-4">
        <div className="eyebrow">Activity</div>
        <h2 className="mt-2 font-display text-xl tracking-editorial text-ink-900">Recent motion</h2>
        <p className="mt-1.5 text-xs text-ink-500">Who did what — across the portfolio, in the last day.</p>
      </div>

      {items.length === 0 ? (
        <p className="mt-7 text-center text-sm text-ink-500">No activity recorded yet.</p>
      ) : (
        <ol className="mt-6 space-y-5">
          {items.map((ev) => (
            <li key={ev.id} className="relative pl-5">
              <span className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full bg-champagne-500" />
              <div className="text-[13px] text-ink-800 leading-snug">
                <span className="font-medium text-ink-900">{titleizeAction(ev.action)}</span>
                {ev.details && <span className="text-ink-700"> — {ev.details}</span>}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
                <span>{ev.agent ?? 'system'}</span>
                <span className="text-ink-300">·</span>
                <span>{relativeTime(ev.created_at)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-7 border-t border-ink-100 pt-4">
        <Link
          href="/activity"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-champagne-700 hover:text-champagne-800 transition-colors"
        >
          View full audit log →
        </Link>
      </div>
    </div>
  );
}

function titleizeAction(action: string | null | undefined) {
  if (!action) return 'Activity';
  return action
    .replace(/[._]/g, ' ')
    .replace(/^\s*\w/, (c) => c.toUpperCase());
}

function relativeTime(iso: string | null | undefined) {
  if (!iso) return 'just now';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function composeFocusQueue(
  violations: any[] | null,
  bills: any[] | null,
  workOrders: any[] | null,
  reports: any[] | null,
) {
  return [
    ...(violations ?? []).map((v) => ({
      key: `violation-${v.id}`,
      type: 'Violation',
      label: v.title,
      detail: `${v.associations?.name ?? 'Association'} · due ${date(v.due_date)}`,
      href: '/violations?status=overdue',
      chipTone: 'danger' as const,
    })),
    ...(bills ?? []).map((b) => ({
      key: `bill-${b.id}`,
      type: 'Bill',
      label: b.vendors?.name ?? b.memo ?? 'Bill awaiting approval',
      detail: `${b.associations?.name ?? 'Portfolio'} · due ${date(b.due_date)}`,
      href: '/bills?status=pending_approval',
      chipTone: 'warning' as const,
    })),
    ...(workOrders ?? []).map((w) => ({
      key: `work-order-${w.id}`,
      type: 'Work order',
      label: w.title,
      detail: `${w.associations?.name ?? 'Association'} · ${formatStatus(w.status)}`,
      href: `/work-orders/${w.id}`,
      chipTone: w.priority === 'emergency' ? ('danger' as const) : ('info' as const),
    })),
    ...(reports ?? []).map((r) => ({
      key: `report-${r.id}`,
      type: 'Report',
      label: r.name,
      detail: `Next run ${date(r.next_run_at)} · ${formatStatus(r.delivery_channel)}`,
      href: '/scheduled-reports',
      chipTone: 'neutral' as const,
    })),
  ].slice(0, 10);
}

function buildViolationQueue(db: any, assocFilter: string, todayDate: string) {
  let q = db.from('violations')
    .select('id, title, status, due_date, associations(name)')
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')
    .lt('due_date', todayDate)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(4);
  if (assocFilter) q = q.eq('association_id', assocFilter);
  return q;
}

function buildWorkOrderQueue(db: any, assocFilter: string) {
  let q = db.from('work_orders')
    .select('id, title, status, priority, associations(name)')
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")')
    .order('priority', { ascending: false })
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(4);
  if (assocFilter) q = q.eq('association_id', assocFilter);
  return q;
}

function buildBillQueue(db: any, assocFilter: string) {
  let q = db.from('payable_bills')
    .select('id, due_date, memo, associations(name), vendors(name)')
    .is('archived_at', null)
    .eq('status', 'pending_approval')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(4);
  if (assocFilter) q = q.eq('association_id', assocFilter);
  return q;
}

function buildReportQueue(db: any, todayIso: string) {
  return db.from('scheduled_reports')
    .select('id, name, next_run_at, delivery_channel')
    .is('archived_at', null)
    .eq('active', true)
    .lte('next_run_at', todayIso)
    .order('next_run_at', { ascending: true, nullsFirst: false })
    .limit(4);
}

function formatStatus(status: string | null | undefined) {
  return status ? status.replace(/_/g, ' ') : 'not set';
}
