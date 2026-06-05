import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { buildCommandMetrics } from '@/lib/operations/command-center';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

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

  if (assocFilter) {
    openViolationsQuery.eq('association_id', assocFilter);
    overdueViolationsQuery.eq('association_id', assocFilter);
    pendingBillsQuery.eq('association_id', assocFilter);
    unreconciledAccountsQuery.eq('association_id', assocFilter);
    openWorkOrdersQuery.eq('association_id', assocFilter);
  }

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
    value: (
      <Link href={metric.href} className="hover:text-emerald-400 transition-colors">
        {metric.value}
      </Link>
    ),
    sublabel: (
      <Link href={metric.href} className="text-emerald-500/60 hover:text-emerald-400 transition-colors flex items-center gap-1">
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

  return (
    <DataWorkspace
      title={activeAssoc ? `${activeAssoc.name} command center` : 'Command center'}
      description="A staff-first operating view for exceptions, approvals, reconciliations, report runs, and maintenance work across the portfolio."
      actions={
        <>
          <form action="/dashboard" method="get" className="flex items-center gap-2">
            <select
              name="assoc"
              defaultValue={assocFilter}
              className="h-10 rounded-xl border border-slate-700 bg-[#0B1121] px-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 appearance-none cursor-pointer transition-colors"
            >
              <option value="">All associations</option>
              {(associations ?? []).map((association: any) => (
                <option key={association.id} value={association.id}>{association.name}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Apply</Button>
          </form>
          <Link href="/work-orders"><Button>Open work orders</Button></Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={linkedMetrics} />

        <section className="rounded-xl border border-slate-800 bg-[#0B1121] overflow-hidden hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
            <div>
              <h2 className="text-base font-bold text-white">Focus queue</h2>
              <p className="mt-1 text-xs text-slate-400">Highest leverage items needing staff attention.</p>
            </div>
            <Link href="/inbox" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 hover:bg-emerald-500/15">Open inbox</Link>
          </div>
          {focusItems.length > 0 ? (
            <ul className="divide-y divide-slate-800/50">
              {focusItems.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-800/20 transition-colors group">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${toneClass(item.tone)}`}>{item.type}</span>
                        <span className="truncate text-sm font-medium text-white">{item.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-500 group-hover:text-emerald-400 transition-colors">Review</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-16 text-center">
              <div className="text-sm font-medium text-slate-300">All clear</div>
              <div className="text-xs text-slate-500 mt-1">No urgent operating items in the queue.</div>
            </div>
          )}
        </section>
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

function toneClass(tone: 'red' | 'amber' | 'blue' | 'slate') {
  const classes = {
    red: 'bg-red-500/15 text-red-400 border border-red-500/25',
    amber: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
    slate: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
  };
  return classes[tone];
}

function formatStatus(status: string | null | undefined) {
  return status ? status.replace(/_/g, ' ') : 'not set';
}
