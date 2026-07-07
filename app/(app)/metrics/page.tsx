import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Trend indicator component ──
function Trend({ value, inverse }: { value: number; inverse?: boolean }) {
  const isUp = value > 0;
  const isDown = value < 0;
  const neutral = value === 0;
  // For inverse metrics (e.g. expenses, overdue), up is bad
  const bad = inverse ? isUp : isDown;
  const good = inverse ? isDown : isUp;

  if (neutral) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${bad ? 'text-red-600' : 'text-green-600'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ── Metric card tile ──
function MetricTile({
  label,
  value,
  prevValue,
  format,
  inverse,
  href,
}: {
  label: string;
  value: number;
  prevValue?: number;
  format?: 'money' | 'pct' | 'count';
  inverse?: boolean;
  href?: string;
}) {
  const pctChange = prevValue != null && prevValue !== 0
    ? ((value - prevValue) / Math.abs(prevValue)) * 100
    : 0;

  const formatted = format === 'money'
    ? money(value)
    : format === 'pct'
      ? `${value.toFixed(1)}%`
      : value.toLocaleString();

  const inner = (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_1px_3px_rgba(16,24,40,0.08),0_4px_12px_-4px_rgba(16,24,40,0.1)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
        {prevValue != null && <Trend value={pctChange} inverse={inverse} />}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-950">{formatted}</div>
      {prevValue != null && (
        <div className="mt-0.5 text-xs text-gray-400">
          Previous: {format === 'money' ? money(prevValue) : format === 'pct' ? `${prevValue.toFixed(1)}%` : prevValue.toLocaleString()}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

// ── Section header ──
function MetricSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

export default async function MetricsPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  // ── Fetch portfolio health metrics ──
  const [
    { data: health },
    { count: associationCount },
    { count: openWorkOrders },
    { count: openViolations },
    { data: arData },
    { data: billsAwaiting },
    { count: unitCount },
    { data: currentOccupancies },
  ] = await Promise.all([
    db.from('v_portfolio_health').select('*').eq('portfolio_id', portfolioId).maybeSingle(),
    db.from('associations').select('id', { count: 'exact', head: true }).is('archived_at', null).eq('portfolio_id', portfolioId),
    db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null).not('status', 'in', '("completed","closed","cancelled")'),
    db.from('violations').select('id', { count: 'exact', head: true }).is('archived_at', null).not('status', 'in', '("closed","cured")'),
    db.from('unit_balances').select('balance').gt('balance', 0),
    db.from('payable_bills').select('id, amount').is('archived_at', null).eq('status', 'approved'),
    db.from('units').select('id', { count: 'exact', head: true }).is('archived_at', null),
    // Occupied = units with a current occupancy (occupancies is the source of
    // truth; unit_owners is a legacy link table and can be empty)
    db.from('occupancies').select('unit_id').eq('status', 'current'),
  ]);

  // Revenue/expenses MTD + portal activation are computed here —
  // v_portfolio_health never carried these fields, so reading them off
  // `health` always rendered $0 / 0%.
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const [{ data: mtdLines }, { data: incomeExpenseAccounts }, { data: ownerFlags }, { data: cashBanks }] = await Promise.all([
    db.from('journal_lines')
      .select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(entry_date, posted)')
      .eq('journal_entries.posted', true)
      .gte('journal_entries.entry_date', monthStartStr),
    db.from('gl_accounts').select('id, account_type').in('account_type', ['income', 'other_income', 'expense', 'other_expense']),
    db.from('owners').select('portal_activated').is('archived_at', null),
    db.from('bank_accounts').select('gl_account_id').is('archived_at', null),
  ]);
  const typeByGl = new Map(((incomeExpenseAccounts ?? []) as any[]).map((a: any) => [a.id, a.account_type]));
  let revenueMtd = 0;
  let expensesMtd = 0;
  for (const l of (mtdLines ?? []) as any[]) {
    const t = typeByGl.get(l.gl_account_id);
    if (t === 'income' || t === 'other_income') revenueMtd += Number(l.credit_amount ?? 0) - Number(l.debit_amount ?? 0);
    if (t === 'expense' || t === 'other_expense') expensesMtd += Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0);
  }
  const ownersAll = (ownerFlags ?? []) as any[];
  const portalActivatedCount = ownersAll.filter((o: any) => o.portal_activated).length;
  const portalActivationPct = ownersAll.length > 0 ? (portalActivatedCount / ownersAll.length) * 100 : 0;
  const portalNotActivated = ownersAll.length - portalActivatedCount;

  // Cash position (bank GL balances) + MTD collection rate — also never
  // present on the health view.
  const bankGlIds = ((cashBanks ?? []) as any[]).map((b: any) => b.gl_account_id).filter(Boolean);
  const [{ data: bankLines }, { data: chargesMtd }, { data: paymentsMtd }] = await Promise.all([
    bankGlIds.length > 0
      ? db.from('journal_lines')
          .select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(posted)')
          .in('gl_account_id', bankGlIds)
          .eq('journal_entries.posted', true)
      : Promise.resolve({ data: [] }),
    db.from('charges').select('amount').gte('created_at', monthStartStr),
    db.from('payments').select('amount').gte('created_at', monthStartStr),
  ]);
  const cashPosition = ((bankLines ?? []) as any[]).reduce(
    (s: number, l: any) => s + Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0), 0);

  // Operations + delinquency tiles (also unbacked by the health view)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [{ count: pendingApprovals }, { count: woCompletedMtd }, { count: woOverdue }, { data: delinqRows }] = await Promise.all([
    db.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('archived_at', null),
    db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null).gte('completed_date', monthStartStr),
    db.from('work_orders').select('id', { count: 'exact', head: true }).is('archived_at', null)
      .lt('scheduled_date', todayStr)
      .not('status', 'in', '("done","completed","billed","closed","cancelled")'),
    portfolioId ? db.rpc('report_data_delinquency', { p_portfolio_id: portfolioId, p_params: {} }) : Promise.resolve({ data: [] }),
  ]);
  const delinq = (Array.isArray(delinqRows) ? delinqRows : []) as any[];
  const delinq0_30 = delinq.filter((r) => (r.days_past_due ?? 0) <= 30).length;
  const delinq31_60 = delinq.filter((r) => (r.days_past_due ?? 0) > 30 && (r.days_past_due ?? 0) <= 60).length;
  const delinq61Plus = delinq.filter((r) => (r.days_past_due ?? 0) > 60).length;
  const chargesMtdTotal = ((chargesMtd ?? []) as any[]).reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
  const paymentsMtdTotal = ((paymentsMtd ?? []) as any[]).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const collectionRatePct = chargesMtdTotal > 0 ? Math.min(100, (paymentsMtdTotal / chargesMtdTotal) * 100) : (paymentsMtdTotal > 0 ? 100 : 0);

  const arBalance = (arData ?? []).reduce((sum: number, r: any) => sum + (r.balance ?? 0), 0);
  const billsAwaitingTotal = (billsAwaiting ?? []).reduce((sum: number, r: any) => sum + (r.amount ?? 0), 0);
  const totalUnits = unitCount ?? 0;
  const occupiedUnits = new Set(((currentOccupancies ?? []) as any[]).map((o: any) => o.unit_id).filter(Boolean)).size;
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  // ── Build top KPI strip ──
  const topMetrics = [
    { label: 'Associations', value: associationCount ?? 0, sublabel: 'Active HOAs' },
    { label: 'Total units', value: totalUnits, sublabel: `${occupiedUnits} occupied` },
    { label: 'Open work orders', value: openWorkOrders ?? 0 },
    { label: 'Open violations', value: openViolations ?? 0 },
  ];

  return (
    <DataWorkspace
      title="Metrics"
      description="Portfolio-level operating metrics across financial, operations, and occupancy categories. Compare current performance against prior periods."
      actions={
        <Link href="/reports"><Button variant="secondary">View all reports</Button></Link>
      }
    >
      <div className="space-y-6">
        {/* ── Top KPI Strip ── */}
        <MetricStrip metrics={topMetrics.map((m) => ({
          label: m.label,
          value: m.value,
          sublabel: m.sublabel,
        }))} />

        {/* ── Financial Metrics ── */}
        <MetricSection
          title="Financial"
          subtitle="Revenue, expenses, and net operating income"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="A/R Balance"
              value={arBalance}
              format="money"
              inverse
              href="/charges"
            />
            <MetricTile
              label="Bills Awaiting"
              value={billsAwaitingTotal}
              format="money"
              inverse
              href="/bills?status=approved"
            />
            <MetricTile
              label="Collection Rate"
              value={collectionRatePct}
              format="pct"
              href="/reports/delinquency"
            />
            <MetricTile
              label="Cash Position"
              value={cashPosition}
              format="money"
              href="/bank-accounts"
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricTile
              label="Revenue (MTD)"
              value={revenueMtd}
              format="money"
            />
            <MetricTile
              label="Expenses (MTD)"
              value={expensesMtd}
              format="money"
              inverse
            />
            <MetricTile
              label="Net Operating Income"
              value={revenueMtd - expensesMtd}
              format="money"
            />
          </div>
        </MetricSection>

        {/* ── Operations Metrics ── */}
        <MetricSection
          title="Operations"
          subtitle="Work orders, violations, and maintenance activity"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Open Work Orders"
              value={openWorkOrders ?? 0}
              format="count"
              inverse
              href="/work-orders"
            />
            <MetricTile
              label="Open Violations"
              value={openViolations ?? 0}
              format="count"
              inverse
              href="/violations"
            />
            <MetricTile
              label="Maintenance SLA"
              value={health?.maintenance_sla_pct ?? 0}
              format="pct"
            />
            <MetricTile
              label="Pending Approvals"
              value={pendingApprovals ?? 0}
              format="count"
              inverse
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricTile
              label="Work Orders Completed"
              value={woCompletedMtd ?? 0}
              format="count"
            />
            <MetricTile
              label="Overdue Work Orders"
              value={woOverdue ?? 0}
              format="count"
              inverse
              href="/work-orders?status=overdue"
            />
            <MetricTile
              label="Inspection Compliance"
              value={health?.inspection_compliance_pct ?? 0}
              format="pct"
            />
          </div>
        </MetricSection>

        {/* ── Occupancy Metrics ── */}
        <MetricSection
          title="Occupancy"
          subtitle="Unit occupancy rates and owner engagement"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Occupancy Rate"
              value={occupancyRate}
              format="pct"
            />
            <MetricTile
              label="Vacant Units"
              value={totalUnits - occupiedUnits}
              format="count"
              inverse
            />
            <MetricTile
              label="Portal Activated"
              value={portalActivationPct}
              format="pct"
            />
            <MetricTile
              label="Delinquency (0–30d)"
              value={delinq0_30}
              format="count"
              inverse
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricTile
              label="Delinquency (31–60d)"
              value={delinq31_60}
              format="count"
              inverse
            />
            <MetricTile
              label="Delinquency (61+d)"
              value={delinq61Plus}
              format="count"
              inverse
            />
            <MetricTile
              label="Portal Not Activated"
              value={portalNotActivated}
              format="count"
              inverse
              href="/owners/activations"
            />
          </div>
        </MetricSection>

        {/* ── Quick Links ── */}
        <MetricSection title="Go deeper" subtitle="Related reports and workspaces">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <Link href="/dashboard" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Command center →
            </Link>
            <Link href="/reports" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Reports workspace →
            </Link>
            <Link href="/reports/ar_aging" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              A/R Aging live view →
            </Link>
            <Link href="/diagnostics" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Data diagnostics →
            </Link>
            <Link href="/surveys" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Survey results →
            </Link>
            <Link href="/reports/delinquency" className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-950">
              Delinquency report →
            </Link>
          </div>
        </MetricSection>
      </div>
    </DataWorkspace>
  );
}
