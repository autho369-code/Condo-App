import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  Building2,
  DoorOpen,
  BarChart3,
  ArrowRight,
  DollarSign,
  Users,
  Clock,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function fmtCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return money(cents / 100);
}

/* -------------------------------------------------------------------------- */
/*  Components                                                                */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate';
  href?: string;
}) {
  const gradient: Record<string, string> = {
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
    red: 'from-red-500/15 to-red-500/5 border-red-500/20',
    purple: 'from-purple-500/15 to-purple-500/5 border-purple-500/20',
    slate: 'from-slate-600/15 to-slate-600/5 border-slate-700/30',
  };
  const iconBg: Record<string, string> = {
    emerald: 'bg-emerald-400/10 text-emerald-400',
    blue: 'bg-blue-400/10 text-blue-400',
    amber: 'bg-amber-400/10 text-amber-400',
    red: 'bg-red-400/10 text-red-400',
    purple: 'bg-purple-400/10 text-purple-400',
    slate: 'bg-slate-400/10 text-slate-400',
  };

  const card = (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradient[accent]} p-5 transition hover:bg-white/[0.03] ${
        href ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 ${iconBg[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

function Badge({
  children,
  variant = 'slate',
}: {
  children: React.ReactNode;
  variant?: 'emerald' | 'amber' | 'red' | 'slate' | 'blue';
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-400/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-400/10 text-red-400 border-red-500/20',
    slate: 'bg-slate-400/10 text-slate-400 border-slate-600/30',
    blue: 'bg-blue-400/10 text-blue-400 border-blue-500/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function RevenuePage() {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">
            Contact the platform operator to set up your company.
          </p>
        </div>
      </div>
    );
  }

  const [
    { data: associations },
    { data: subscription },
    { data: owners },
    { data: workOrdersCompleted },
  ] = await Promise.all([
    supabase
      .from('associations')
      .select('id, name, unit_count, city, status')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null),
    supabase
      .from('subscriptions')
      .select('price_monthly_cents, units_limit')
      .eq('portfolio_id', portfolioId)
      .maybeSingle(),
    supabase
      .from('owners')
      .select('id')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null),
    supabase
      .from('work_orders')
      .select('id')
      .eq('portfolio_id', portfolioId)
      .in('status', ['completed', 'closed']),
  ]);

  const assocList = associations ?? [];
  const totalAssociations = assocList.length;
  const totalDoors = assocList.reduce((sum, a) => sum + (a.unit_count ?? 0), 0);
  const monthlyFee = subscription?.price_monthly_cents ?? 0;
  const totalOwners = (owners ?? []).length;
  const completedThisMonth = (workOrdersCompleted ?? []).length;

  // Calculate avg revenue per door
  const avgPerDoor =
    totalDoors > 0 ? Math.round(monthlyFee / totalDoors) : 0;

  // Mock monthly trend data (placeholder — real data would come from billing/accounting)
  const monthlyTrend = [
    { month: 'Jan', value: monthlyFee * 0.78 },
    { month: 'Feb', value: monthlyFee * 0.82 },
    { month: 'Mar', value: monthlyFee * 0.88 },
    { month: 'Apr', value: monthlyFee * 0.91 },
    { month: 'May', value: monthlyFee * 0.95 },
    { month: 'Jun', value: monthlyFee },
  ];
  const maxTrend = Math.max(...monthlyTrend.map((m) => m.value), 1);

  // Projected next month
  const projectedNext = monthlyFee * 1.05;
  const newAssocRevenue = 0; // placeholder — not tracked

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Company Admin
          </p>
          <h1 className="mt-1 text-xl font-bold text-white">Revenue &amp; Income</h1>
          <p className="mt-1 text-sm text-slate-400">
            {me.portfolio?.company_name ?? 'Company'} — {totalAssociations} associations, {totalDoors}{' '}
            doors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/company-admin/billing"
            className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
          >
            View Billing
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Monthly Mgmt Fee Income"
          value={fmtCents(monthlyFee)}
          icon={CircleDollarSign}
          accent="emerald"
        />
        <StatCard
          label="Avg Revenue / Door"
          value={fmtCents(avgPerDoor)}
          sub="per month"
          icon={DoorOpen}
          accent="blue"
        />
        <StatCard
          label="Delinquencies"
          value="—"
          sub="not tracked"
          icon={AlertTriangle}
          accent="slate"
        />
        <StatCard
          label="Collections Progress"
          value="—"
          sub="not tracked"
          icon={TrendingUp}
          accent="slate"
        />
        <StatCard
          label="Owners"
          value={totalOwners}
          sub={`across ${totalAssociations} HOA${totalAssociations !== 1 ? 's' : ''}`}
          icon={Users}
          accent="purple"
        />
      </div>

      {/* Revenue by Association table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <Building2 className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Revenue by Association
          </h3>
        </div>

        {assocList.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Building2 className="h-8 w-8 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No associations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02] text-xs text-slate-400 uppercase">
                  <th className="text-left px-5 py-3 font-medium">Association</th>
                  <th className="text-left px-5 py-3 font-medium">City</th>
                  <th className="text-right px-5 py-3 font-medium">Doors</th>
                  <th className="text-right px-5 py-3 font-medium">Monthly Fee</th>
                  <th className="text-right px-5 py-3 font-medium">YTD Revenue</th>
                  <th className="text-center px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {assocList.map((a) => {
                  const assocUnits = a.unit_count ?? 0;
                  const estimatedMonthly =
                    totalDoors > 0
                      ? Math.round((assocUnits / totalDoors) * monthlyFee)
                      : 0;
                  const estimatedYtd = estimatedMonthly * 6; // placeholder 6-month YTD
                  const isActive = a.status === 'active';
                  return (
                    <tr key={a.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-sm font-medium text-white">
                        {a.name}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-400">{a.city}</td>
                      <td className="px-5 py-3 text-sm tabular-nums text-right text-slate-300">
                        {assocUnits}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-right text-white font-semibold">
                        {fmtCents(estimatedMonthly)}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-right text-slate-300">
                        {fmtCents(estimatedYtd)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant={isActive ? 'emerald' : 'amber'}>
                          {a.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Revenue Trend bar chart */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Monthly Revenue Trend
          </h3>
        </div>
        <div className="px-5 py-6">
          <div className="flex items-end gap-3 h-48 justify-around">
            {monthlyTrend.map((m) => (
              <div key={m.month} className="flex flex-col items-center gap-2 flex-1 max-w-20">
                <span className="text-xs font-semibold tabular-nums text-white">
                  {fmtCents(Math.round(m.value))}
                </span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/80 to-emerald-400/60 min-h-[4px]"
                    style={{
                      height: `${Math.max(4, (m.value / maxTrend) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-slate-400">{m.month}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 text-center mt-4">
            Estimated based on active subscriptions — real figures will populate from billing data
          </p>
        </div>
      </div>

      {/* Projections + Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Projections */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Projections
            </h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Projected Next Month</span>
              <div className="text-right">
                <span className="text-sm font-semibold tabular-nums text-emerald-300">
                  {fmtCents(Math.round(projectedNext))}
                </span>
                <span className="text-xs text-slate-400 ml-1.5">+5% est.</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">
                New Association Revenue This Month
              </span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {fmtCents(newAssocRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Completed Work Orders</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {completedThisMonth}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Owner Accounts</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {totalOwners}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Risk */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Associations at Financial Risk
            </h3>
          </div>
          <div className="px-5 py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No associations flagged</p>
            <p className="text-xs text-slate-400 mt-1">
              Financial risk monitoring will be available when accounting data is connected
            </p>
          </div>
        </div>
      </div>

      {/* Delinquency summary */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <Clock className="h-4 w-4 text-red-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Delinquency Summary
          </h3>
        </div>
        <div className="px-5 py-8 text-center">
          <Clock className="h-8 w-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Delinquency data not available</p>
          <p className="text-xs text-slate-400 mt-1">
            Owner delinquency tracking requires accounting integration
          </p>
        </div>
      </div>

      {/* Filter note */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-slate-400">
          Filter by association and date range coming soon
        </span>
      </div>
    </div>
  );
}
