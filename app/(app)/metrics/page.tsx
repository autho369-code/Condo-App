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
              value={health?.collection_rate_pct ?? 0}
              format="pct"
              href="/reports/delinquency"
            />
            <MetricTile
              label="Cash Position"
              value={health?.cash_position ?? 0}
              format="money"
              href="/bank-accounts"
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricTile
              label="Revenue (MTD)"
              value={health?.revenue_mtd ?? 0}
              format="money"
            />
            <MetricTile
              label="Expenses (MTD)"
              value={health?.expenses_mtd ?? 0}
              format="money"
              inverse
            />
            <MetricTile
              label="Net Operating Income"
              value={(health?.revenue_mtd ?? 0) - (health?.expenses_mtd ?? 0)}
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
              value={health?.pending_approvals ?? 0}
              format="count"
              inverse
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricTile
              label="Work Orders Completed"
              value={health?.wo_completed ?? 0}
              format="count"
            />
            <MetricTile
              label="Overdue Work Orders"
              value={health?.wo_overdue ?? 0}
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
              value={health?.portal_activation_pct ?? 0}
              format="pct"
            />
            <MetricTile
              label="Delinquency (0–30d)"
              value={health?.delinquency_0_30 ?? 0}
              format="count"
              inverse
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricTile
              label="Delinquency (31–60d)"
              value={health?.delinquency_31_60 ?? 0}
              format="count"
              inverse
            />
            <MetricTile
              label="Delinquency (61+d)"
              value={health?.delinquency_61_plus ?? 0}
              format="count"
              inverse
            />
            <MetricTile
              label="Portal Not Activated"
              value={health?.portal_not_activated_count ?? 0}
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
