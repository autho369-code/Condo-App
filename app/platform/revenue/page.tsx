import Link from 'next/link';
import {
  Building2,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CreditCard,
  DoorOpen,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type SubRow = Record<string, any>;
type PortfolioRow = Record<string, any>;
type AssociationRow = Record<string, any>;
type BuildingRow = Record<string, any>;
type UnitRow = Record<string, any>;

interface RevenueByCompany {
  portfolioId: string;
  companyName: string;
  tier: string;
  status: string;
  monthlyRevenue: number;
  annualizedRevenue: number;
  doorCount: number;
}

interface RevenueByTier {
  tier: string;
  count: number;
  mrr: number;
  pctOfTotal: number;
  avgPerCompany: number;
}

/* -------------------------------------------------------------------------- */
/*  KPI Card (dark theme)                                                      */
/* -------------------------------------------------------------------------- */

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
  trend,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'slate' | 'violet';
  trend?: 'up' | 'down' | 'flat';
}) {
  const accentMap: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20',
    slate: 'from-slate-600/20 to-slate-600/5 border-slate-700',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
  };
  const iconColorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
    violet: 'text-violet-400',
  };

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : null;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : '';

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${accentMap[accent] ?? accentMap.slate} p-5 transition hover:border-opacity-50`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
            {TrendIcon && <TrendIcon className={`h-4 w-4 ${trendColor}`} />}
          </div>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={`ml-3 mt-0.5 rounded-lg bg-white/5 p-2 ${iconColorMap[accent] ?? iconColorMap.slate}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Status badge                                                               */
/* -------------------------------------------------------------------------- */

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/40',
  past_due: 'bg-red-400/15 text-red-300 ring-red-400/40',
  canceled: 'bg-gray-500/20 text-gray-400 ring-gray-500/30',
  trialing: 'bg-sky-400/15 text-sky-300 ring-sky-400/40',
  unpaid: 'bg-red-400/15 text-red-300 ring-red-400/40',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.canceled;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'active'
            ? 'bg-emerald-400'
            : status === 'trialing'
              ? 'bg-sky-400'
              : status === 'past_due' || status === 'unpaid'
                ? 'bg-red-400'
                : 'bg-gray-500'
        }`}
      />
      {status === 'past_due'
        ? 'Past Due'
        : status === 'trialing'
          ? 'Trial'
          : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function fmtMonthly(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return money(cents / 100);
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0%';
  return ((numerator / denominator) * 100).toFixed(1) + '%';
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function PlatformRevenuePage() {
  const supabase = await createClient();

  // 1. Fetch all subscriptions + portfolios
  const [
    { data: subscriptions },
    { data: portfolios },
    { data: associations },
  ] = await Promise.all([
    (supabase as any)
      .from('subscriptions')
      .select(
        'id, portfolio_id, tier, status, price_monthly_cents, trial_ends_at, canceled_at, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id',
      )
      .order('created_at', { ascending: false })
      .limit(500),
    (supabase as any)
      .from('portfolios')
      .select('id, company_name, tier, suspended_at')
      .is('archived_at', null),
    (supabase as any)
      .from('associations')
      .select('id, portfolio_id')
      .is('archived_at', null),
  ]);

  const subRows: SubRow[] = subscriptions ?? [];
  const portfolioRows: PortfolioRow[] = portfolios ?? [];
  const associationRows: AssociationRow[] = associations ?? [];

  const portfolioById = new Map<string, PortfolioRow>(
    portfolioRows.map((p) => [p.id, p]),
  );

  // Map portfolio -> associations
  const assocByPortfolio = new Map<string, AssociationRow[]>();
  const allAssocIds: string[] = [];
  associationRows.forEach((a) => {
    const list = assocByPortfolio.get(a.portfolio_id) ?? [];
    list.push(a);
    assocByPortfolio.set(a.portfolio_id, list);
    allAssocIds.push(a.id);
  });

  // 2. Door counts by association
  let assocDoorCounts = new Map<string, number>();
  if (allAssocIds.length > 0) {
    const { data: buildings } = await (supabase as any)
      .from('buildings')
      .select('id, association_id')
      .in('association_id', allAssocIds);

    const buildingRows: BuildingRow[] = buildings ?? [];
    const bldgAssocMap = new Map<string, string>(
      buildingRows.map((b) => [b.id, b.association_id]),
    );
    const buildingIds = buildingRows.map((b) => b.id);

    if (buildingIds.length > 0) {
      const { data: units } = await (supabase as any)
        .from('units')
        .select('id, building_id')
        .is('archived_at', null)
        .in('building_id', buildingIds);

      const unitRows: UnitRow[] = units ?? [];
      assocDoorCounts = new Map<string, number>();
      unitRows.forEach((u) => {
        const assocId = bldgAssocMap.get(u.building_id);
        if (assocId) assocDoorCounts.set(assocId, (assocDoorCounts.get(assocId) ?? 0) + 1);
      });
    }
  }

  // Door count per portfolio
  const doorCountByPortfolio = new Map<string, number>();
  portfolioRows.forEach((p) => {
    const assocs = assocByPortfolio.get(p.id) ?? [];
    const total = assocs.reduce((sum, a) => sum + (assocDoorCounts.get(a.id) ?? 0), 0);
    doorCountByPortfolio.set(p.id, total);
  });

  // 3. Compute KPIs
  const activeSubs = subRows.filter((s) => s.status === 'active');
  const trialingSubs = subRows.filter((s) => s.status === 'trialing');
  const pastDueSubs = subRows.filter((s) => s.status === 'past_due' || s.status === 'unpaid');
  const canceledSubs = subRows.filter((s) => s.status === 'canceled');

  const totalMRR = activeSubs.reduce((sum, s) => sum + (s.price_monthly_cents ?? 0), 0);
  const failedPayments = pastDueSubs.length;
  const churned = canceledSubs.length;

  // Trial-to-paid conversion: among subs that were ever trialing, how many are now active
  const everTrialing = subRows.filter(
    (s) => s.trial_ends_at || s.status === 'trialing',
  );
  const convertedFromTrial = everTrialing.filter((s) => s.status === 'active').length;
  const trialToPaidRate =
    everTrialing.length > 0 ? (convertedFromTrial / everTrialing.length) * 100 : 0;

  // Average revenue per active company
  const avgRevenuePerCompany = activeSubs.length > 0 ? totalMRR / activeSubs.length : 0;

  // Total doors across all portfolios
  const totalDoors = portfolioRows.reduce(
    (sum, p) => sum + (doorCountByPortfolio.get(p.id) ?? 0),
    0,
  );
  const avgRevenuePerDoor = totalDoors > 0 ? totalMRR / totalDoors : 0;

  // Projected annual
  const projectedAnnual = totalMRR * 12;

  // 4. Month-over-month comparison
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const thisMonthMRR = activeSubs
    .filter((s) => {
      const d = s.current_period_start ? new Date(s.current_period_start) : null;
      return d && d >= thisMonthStart;
    })
    .reduce((sum, s) => sum + (s.price_monthly_cents ?? 0), 0);

  const lastMonthMRR = activeSubs
    .filter((s) => {
      const d = s.current_period_start ? new Date(s.current_period_start) : null;
      return d && d >= lastMonthStart && d <= lastMonthEnd;
    })
    .reduce((sum, s) => sum + (s.price_monthly_cents ?? 0), 0);

  const momChange = lastMonthMRR > 0 ? ((thisMonthMRR - lastMonthMRR) / lastMonthMRR) * 100 : 0;
  const momTrend: 'up' | 'down' | 'flat' = momChange > 1 ? 'up' : momChange < -1 ? 'down' : 'flat';

  // 5. Revenue by company
  const revenueByCompany: RevenueByCompany[] = portfolioRows
    .map((p) => {
      const sub = subRows.find((s) => s.portfolio_id === p.id);
      const monthlyRevenue = sub?.price_monthly_cents ?? 0;
      const doors = doorCountByPortfolio.get(p.id) ?? 0;
      return {
        portfolioId: p.id,
        companyName: p.company_name ?? 'Unknown',
        tier: sub?.tier ?? p.tier ?? '—',
        status: sub?.status ?? 'none',
        monthlyRevenue,
        annualizedRevenue: monthlyRevenue * 12,
        doorCount: doors,
      };
    })
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

  // 6. Revenue by tier
  const tierMap = new Map<string, { count: number; mrr: number }>();
  activeSubs.forEach((s) => {
    const tier = s.tier ?? 'none';
    const entry = tierMap.get(tier) ?? { count: 0, mrr: 0 };
    entry.count += 1;
    entry.mrr += s.price_monthly_cents ?? 0;
    tierMap.set(tier, entry);
  });

  const revenueByTier: RevenueByTier[] = [...tierMap.entries()]
    .map(([tier, { count, mrr }]) => ({
      tier,
      count,
      mrr,
      pctOfTotal: totalMRR > 0 ? (mrr / totalMRR) * 100 : 0,
      avgPerCompany: count > 0 ? mrr / count : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr);

  // 7. Active subscriptions that are nearing renewal (within 7 days)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingRenewals = activeSubs.filter((s) => {
    const end = s.current_period_end ? new Date(s.current_period_end) : null;
    return end && end <= sevenDaysFromNow && end >= now;
  });

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-[#060B18]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Platform Operator
            </p>
            <h1 className="text-xl font-semibold text-white">Revenue Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">
              Platform-wide revenue analytics, subscription health, and growth metrics.
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-6 space-y-6">
        {/* KPI Grid: Row 1 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total MRR"
            value={fmtMonthly(totalMRR)}
            sub={
              lastMonthMRR > 0
                ? `MoM ${momChange >= 0 ? '+' : ''}${momChange.toFixed(1)}%`
                : 'MoM data unavailable'
            }
            icon={CircleDollarSign}
            accent="emerald"
            trend={momTrend}
          />
          <KpiCard
            label="Projected Annual"
            value={fmtMonthly(projectedAnnual)}
            sub={`Based on current MRR × 12`}
            icon={TrendingUp}
            accent="blue"
          />
          <KpiCard
            label="Avg / Company"
            value={fmtMonthly(avgRevenuePerCompany)}
            sub={`${activeSubs.length} active companies`}
            icon={Building2}
            accent="violet"
          />
          <KpiCard
            label="Avg / Door"
            value={fmtMonthly(avgRevenuePerDoor)}
            sub={`${totalDoors.toLocaleString()} active doors`}
            icon={DoorOpen}
            accent="slate"
          />
        </div>

        {/* KPI Grid: Row 2 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Trial → Paid"
            value={trialToPaidRate.toFixed(1) + '%'}
            sub={`${convertedFromTrial} converted of ${everTrialing.length} trials`}
            icon={TrendingUp}
            accent={trialToPaidRate >= 50 ? 'emerald' : 'amber'}
          />
          <KpiCard
            label="Failed Payments"
            value={failedPayments}
            sub={
              failedPayments > 0
                ? `${pct(failedPayments, subRows.length)} of all subscriptions`
                : 'All payments current'
            }
            icon={AlertTriangle}
            accent={failedPayments > 0 ? 'red' : 'emerald'}
          />
          <KpiCard
            label="Churned"
            value={churned}
            sub={`${pct(churned, subRows.length)} of all subscriptions`}
            icon={TrendingDown}
            accent={churned > 0 ? 'amber' : 'slate'}
          />
          <KpiCard
            label="Upcoming Renewals"
            value={upcomingRenewals.length}
            sub="Within next 7 days"
            icon={CreditCard}
            accent={upcomingRenewals.length > 5 ? 'amber' : 'blue'}
          />
        </div>

        {/* MoM Detail (if data available) */}
        {lastMonthMRR > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-white">Month-over-Month</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Last Month MRR</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">{fmtMonthly(lastMonthMRR)}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">This Month MRR</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">{fmtMonthly(thisMonthMRR)}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Change</p>
                <p
                  className={`mt-1 text-lg font-bold tabular-nums ${
                    momChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {momChange >= 0 ? '+' : ''}
                  {momChange.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Revenue by Company (table) */}
        <div className="rounded-xl border border-white/[0.06]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
            <Building2 className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Revenue by Company</h3>
            <span className="ml-auto text-xs text-slate-500">{revenueByCompany.length} companies</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left font-semibold">Company</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Tier</th>
                  <th className="px-4 py-3 text-right font-semibold">Doors</th>
                  <th className="px-4 py-3 text-right font-semibold">MRR</th>
                  <th className="px-4 py-3 text-right font-semibold">Annualized</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {revenueByCompany.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                      <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                      <p>No revenue data available.</p>
                    </td>
                  </tr>
                ) : (
                  revenueByCompany.map((row) => (
                    <tr key={row.portfolioId} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/platform/portfolios/${row.portfolioId}`}
                          className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {row.companyName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 align-top text-xs font-semibold uppercase text-slate-300">
                        {row.tier}
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums text-slate-300">
                        {row.doorCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums font-medium text-slate-200">
                        {fmtMonthly(row.monthlyRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums text-slate-400">
                        {fmtMonthly(row.annualizedRevenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue by Tier (table) */}
        <div className="rounded-xl border border-white/[0.06]">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Revenue by Tier</h3>
            <span className="ml-auto text-xs text-slate-500">
              {revenueByTier.reduce((s, t) => s + t.count, 0)} active subscriptions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left font-semibold">Tier</th>
                  <th className="px-4 py-3 text-right font-semibold">Subscriptions</th>
                  <th className="px-4 py-3 text-right font-semibold">MRR</th>
                  <th className="px-4 py-3 text-right font-semibold">% of Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Avg / Company</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {revenueByTier.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                      <BarChart3 className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                      <p>No tier data available.</p>
                    </td>
                  </tr>
                ) : (
                  revenueByTier.map((row) => (
                    <tr key={row.tier} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 align-top">
                        <span className="text-xs font-semibold uppercase text-slate-300">{row.tier}</span>
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums text-slate-300">
                        {row.count}
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums font-medium text-slate-200">
                        {fmtMonthly(row.mrr)}
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums text-slate-400">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-emerald-500/50"
                              style={{ width: `${Math.min(row.pctOfTotal, 100)}%` }}
                            />
                          </div>
                          {row.pctOfTotal.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-top tabular-nums text-slate-400">
                        {fmtMonthly(row.avgPerCompany)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
