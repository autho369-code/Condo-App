import Link from 'next/link';
import {
  Building2,
  CreditCard,
  AlertTriangle,
  CircleDollarSign,
  FileText,
  Clock,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type SubRow = Record<string, any>;
type PortfolioRow = Record<string, any>;
type AssociationRow = Record<string, any>;
type BuildingRow = Record<string, any>;
type UnitRow = Record<string, any>;

type StatusFilter = 'all' | 'active' | 'past_due' | 'canceled' | 'trialing';

interface BillingRow {
  subscription: SubRow;
  portfolio: PortfolioRow | null;
  companyName: string;
  activeAssociations: number;
  totalDoors: number;
  doorsAddedThisMonth: number;
  doorsRemovedThisMonth: number;
  tier: string;
  monthlyCharge: number | null;
  estimatedNextInvoice: string | null;
  stripeCustomerId: string | null;
  paymentStatus: string;
  cancelAtPeriodEnd: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Dark-themed KPI tile                                                       */
/* -------------------------------------------------------------------------- */

function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'slate';
}) {
  const accentMap: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20',
    slate: 'from-slate-600/20 to-slate-600/5 border-slate-700',
  };
  const iconColorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${accentMap[accent] ?? accentMap.slate} p-5 transition hover:border-opacity-50`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</p>
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
          status === 'active' ? 'bg-emerald-400' :
          status === 'trialing' ? 'bg-sky-400' :
          status === 'past_due' || status === 'unpaid' ? 'bg-red-400' :
          'bg-gray-500'
        }`}
      />
      {status === 'past_due' ? 'Past Due' :
       status === 'trialing' ? 'Trial' :
       status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tier change warning badge                                                  */
/* -------------------------------------------------------------------------- */

function TierChangeBadge({ sub, portfolio }: { sub: SubRow; portfolio: PortfolioRow | null }) {
  const subTier = sub?.tier?.toLowerCase();
  const portfolioTier = portfolio?.tier?.toLowerCase();
  if (!subTier || !portfolioTier || subTier === portfolioTier) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/40">
      <AlertTriangle className="h-3 w-3" />
      Tier mismatch
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Filter tabs                                                                */
/* -------------------------------------------------------------------------- */

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trialing', label: 'Trial' },
  { key: 'past_due', label: 'Past Due' },
  { key: 'canceled', label: 'Canceled' },
];

function FilterTabs({ current }: { current: StatusFilter }) {
  return (
    <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
      {FILTER_TABS.map((tab) => {
        const params = new URLSearchParams();
        if (tab.key !== 'all') params.set('status', tab.key);
        const isActive = current === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/platform/billing?${params.toString()}`}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              isActive
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Money helper                                                               */
/* -------------------------------------------------------------------------- */

function fmtMonthly(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return money(cents / 100);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function PlatformBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const statusFilter: StatusFilter = (['all', 'active', 'past_due', 'canceled', 'trialing'] as const).includes(
    sp.status as any,
  )
    ? (sp.status as StatusFilter)
    : 'all';

  const supabase = await createClient();

  // 1. Fetch subscriptions + portfolios
  const [{ data: subscriptions }, { data: portfolios }] = await Promise.all([
    (supabase as any)
      .from('subscriptions')
      .select(
        'id, portfolio_id, tier, status, price_monthly_cents, units_limit, seats_used, trial_ends_at, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end, billing_email, canceled_at',
      )
      .order('created_at', { ascending: false })
      .limit(500),
    (supabase as any).from('portfolios').select('id, company_name, tier, suspended_at').is('archived_at', null),
  ]);

  const subRows: SubRow[] = subscriptions ?? [];
  const portfolioRows: PortfolioRow[] = portfolios ?? [];
  const portfolioById = new Map<string, PortfolioRow>(
    portfolioRows.map((p) => [p.id, p]),
  );

  // Filter subs by status
  const filteredSubs =
    statusFilter === 'all'
      ? subRows
      : subRows.filter((s) => s.status === statusFilter);

  const portfolioIds = [...new Set(filteredSubs.map((s) => s.portfolio_id))];

  // 2. Fetch associations for these portfolios
  let assocByPortfolio = new Map<string, AssociationRow[]>();
  let allAssocIds: string[] = [];

  if (portfolioIds.length > 0) {
    const { data: associations } = await (supabase as any)
      .from('associations')
      .select('id, portfolio_id')
      .in('portfolio_id', portfolioIds);

    const assocRows: AssociationRow[] = associations ?? [];
    allAssocIds = assocRows.map((a) => a.id);
    assocRows.forEach((a) => {
      const list = assocByPortfolio.get(a.portfolio_id) ?? [];
      list.push(a);
      assocByPortfolio.set(a.portfolio_id, list);
    });
  }

  // 3. Fetch buildings -> units for door counts
  let assocDoorCounts = new Map<string, number>();
  let assocDoorsAddedThisMonth = new Map<string, number>();
  let assocDoorsRemovedThisMonth = new Map<string, number>();

  if (allAssocIds.length > 0) {
    const { data: buildings } = await (supabase as any)
      .from('buildings')
      .select('id, association_id')
      .in('association_id', allAssocIds);

    const buildingRows: BuildingRow[] = buildings ?? [];
    const buildingIds = buildingRows.map((b) => b.id);
    const bldgAssocMap = new Map<string, string>(
      buildingRows.map((b) => [b.id, b.association_id]),
    );

    if (buildingIds.length > 0) {
      const { data: units } = await (supabase as any)
        .from('units')
        .select('id, building_id, created_at, archived_at')
        .in('building_id', buildingIds);

      const unitRows: UnitRow[] = units ?? [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const activeUnits = unitRows.filter((u) => u.archived_at === null);
      const addedThisMonth = unitRows.filter((u) => {
        const d = u.created_at ? new Date(u.created_at) : null;
        return d && d >= monthStart && d <= monthEnd;
      });
      const removedThisMonth = unitRows.filter((u) => {
        const d = u.archived_at ? new Date(u.archived_at) : null;
        return d && d >= monthStart && d <= monthEnd;
      });

      assocDoorCounts = new Map<string, number>();
      assocDoorsAddedThisMonth = new Map<string, number>();
      assocDoorsRemovedThisMonth = new Map<string, number>();

      activeUnits.forEach((u) => {
        const assocId = bldgAssocMap.get(u.building_id);
        if (assocId) assocDoorCounts.set(assocId, (assocDoorCounts.get(assocId) ?? 0) + 1);
      });
      addedThisMonth.forEach((u) => {
        const assocId = bldgAssocMap.get(u.building_id);
        if (assocId) assocDoorsAddedThisMonth.set(assocId, (assocDoorsAddedThisMonth.get(assocId) ?? 0) + 1);
      });
      removedThisMonth.forEach((u) => {
        const assocId = bldgAssocMap.get(u.building_id);
        if (assocId) assocDoorsRemovedThisMonth.set(assocId, (assocDoorsRemovedThisMonth.get(assocId) ?? 0) + 1);
      });
    }
  }

  // 4. Build billing rows
  const billingRows: BillingRow[] = filteredSubs.map((sub) => {
    const portfolio = portfolioById.get(sub.portfolio_id) ?? null;
    const assocs = assocByPortfolio.get(sub.portfolio_id) ?? [];
    const activeAssociations = assocs.length;
    const totalDoors = assocs.reduce((sum, a) => sum + (assocDoorCounts.get(a.id) ?? 0), 0);
    const doorsAdded = assocs.reduce((sum, a) => sum + (assocDoorsAddedThisMonth.get(a.id) ?? 0), 0);
    const doorsRemoved = assocs.reduce((sum, a) => sum + (assocDoorsRemovedThisMonth.get(a.id) ?? 0), 0);

    // Estimated next invoice: current_period_end if active, otherwise null
    const estNextInvoice =
      sub.status === 'active' || sub.status === 'trialing'
        ? sub.current_period_end ?? null
        : null;

    const paymentStatus = sub.cancel_at_period_end ? `${sub.status} (canceling)` : sub.status;

    return {
      subscription: sub,
      portfolio,
      companyName: portfolio?.company_name ?? 'Unknown',
      activeAssociations,
      totalDoors,
      doorsAddedThisMonth: doorsAdded,
      doorsRemovedThisMonth: doorsRemoved,
      tier: sub.tier ?? portfolio?.tier ?? '—',
      monthlyCharge: sub.price_monthly_cents,
      estimatedNextInvoice: estNextInvoice,
      stripeCustomerId: sub.stripe_customer_id ?? null,
      paymentStatus,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    };
  });

  // 5. KPI calculations
  const totalMRR = filteredSubs
    .filter((s) => s.status === 'active')
    .reduce((sum: number, s) => sum + (s.price_monthly_cents ?? 0), 0);
  const activeCount = filteredSubs.filter((s) => s.status === 'active').length;
  const trialCount = filteredSubs.filter((s) => s.status === 'trialing').length;
  const pastDueCount = filteredSubs.filter((s) => s.status === 'past_due' || s.status === 'unpaid').length;
  const canceledCount = filteredSubs.filter((s) => s.status === 'canceled').length;

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] bg-[#060B18]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Platform Operator
            </p>
            <h1 className="text-xl font-semibold text-white">Billing Monitor</h1>
            <p className="mt-1 text-sm text-slate-400">
              Subscription oversight, revenue tracking, and invoice management across all companies.
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-6 space-y-6">
        {/* KPI Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label="Total MRR"
            value={fmtMonthly(totalMRR)}
            sub={`${activeCount} active subscriptions`}
            icon={CircleDollarSign}
            accent="emerald"
          />
          <KpiTile
            label="Active Subscriptions"
            value={activeCount}
            sub={`${trialCount} trial · ${pastDueCount} past due · ${canceledCount} canceled`}
            icon={CreditCard}
            accent="blue"
          />
          <KpiTile
            label="Trials"
            value={trialCount}
            sub="Currently in trial period"
            icon={Clock}
            accent="amber"
          />
          <KpiTile
            label="Past Due"
            value={pastDueCount}
            sub={pastDueCount > 0 ? 'Requires immediate attention' : 'All payments current'}
            icon={AlertTriangle}
            accent={pastDueCount > 0 ? 'red' : 'emerald'}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FilterTabs current={statusFilter} />
          <span className="text-xs text-slate-500">
            {billingRows.length} subscription{billingRows.length !== 1 ? 's' : ''} shown
          </span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left font-semibold">Company</th>
                  <th className="px-4 py-3 text-right font-semibold">Associations</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Doors</th>
                  <th className="px-4 py-3 text-right font-semibold">+ This Mo</th>
                  <th className="px-4 py-3 text-right font-semibold">- This Mo</th>
                  <th className="px-4 py-3 text-left font-semibold">Tier</th>
                  <th className="px-4 py-3 text-right font-semibold">Monthly</th>
                  <th className="px-4 py-3 text-left font-semibold">Next Invoice</th>
                  <th className="px-4 py-3 text-left font-semibold">Stripe Customer</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {billingRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center text-slate-500">
                      <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                      <p>No subscription records match the selected filter.</p>
                    </td>
                  </tr>
                ) : (
                  billingRows.map((row) => (
                    <tr
                      key={row.subscription.id}
                      className="transition hover:bg-white/[0.02]"
                    >
                      {/* Company */}
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/platform/portfolios/${row.subscription.portfolio_id}`}
                          className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {row.companyName}
                        </Link>
                        {row.portfolio?.suspended_at && (
                          <span className="ml-2 rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                            Suspended
                          </span>
                        )}
                        <div className="mt-0.5 text-xs text-slate-500">
                          {row.subscription.billing_email ?? 'No billing email'}
                        </div>
                      </td>

                      {/* Associations */}
                      <td className="px-4 py-3 text-right align-top tabular-nums text-slate-200">
                        {row.activeAssociations}
                      </td>

                      {/* Total Doors */}
                      <td className="px-4 py-3 text-right align-top tabular-nums text-slate-200">
                        {row.totalDoors.toLocaleString()}
                      </td>

                      {/* Doors Added */}
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        {row.doorsAddedThisMonth > 0 ? (
                          <span className="text-emerald-400">+{row.doorsAddedThisMonth}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Doors Removed */}
                      <td className="px-4 py-3 text-right align-top tabular-nums">
                        {row.doorsRemovedThisMonth > 0 ? (
                          <span className="text-red-400">-{row.doorsRemovedThisMonth}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>

                      {/* Tier */}
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold uppercase text-slate-300">{row.tier}</span>
                          <TierChangeBadge sub={row.subscription} portfolio={row.portfolio} />
                        </div>
                        {row.subscription.units_limit != null && (
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {row.totalDoors} / {row.subscription.units_limit} units
                            {row.totalDoors > row.subscription.units_limit && (
                              <span className="ml-1 text-amber-400">(over)</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Monthly Charge */}
                      <td className="px-4 py-3 text-right align-top tabular-nums font-medium text-slate-200">
                        {fmtMonthly(row.monthlyCharge)}
                      </td>

                      {/* Next Invoice */}
                      <td className="px-4 py-3 align-top text-slate-400">
                        {row.estimatedNextInvoice ? date(row.estimatedNextInvoice) : '—'}
                      </td>

                      {/* Stripe Customer ID */}
                      <td className="px-4 py-3 align-top font-mono text-xs text-slate-500">
                        {row.stripeCustomerId ? (
                          <span className="text-slate-400" title={row.stripeCustomerId}>
                            {row.stripeCustomerId.length > 16
                              ? row.stripeCustomerId.slice(0, 8) + '...' + row.stripeCustomerId.slice(-8)
                              : row.stripeCustomerId}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={row.subscription.status} />
                        {row.cancelAtPeriodEnd && (
                          <div className="mt-1 text-[10px] text-amber-400">Cancels at period end</div>
                        )}
                      </td>

                      {/* Invoice History */}
                      <td className="px-4 py-3 align-top">
                        {row.stripeCustomerId ? (
                          <Link
                            href={`https://dashboard.stripe.com/customers/${row.stripeCustomerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Stripe →
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
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
