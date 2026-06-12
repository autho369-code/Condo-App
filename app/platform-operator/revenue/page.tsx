import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-950">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
          <Icon className="h-4.5 w-4.5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

export default async function RevenuePage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // All active/trialing subscriptions
  const { data: subs } = await db
    .from('subscriptions')
    .select('portfolio_id, tier, status, price_monthly_cents, created_at, canceled_at')
    .in('status', ['active', 'trialing', 'canceled']);

  const { data: portfolios } = await db
    .from('portfolios')
    .select('id, company_name')
    .order('company_name');

  const portfolioMap = new Map<string, string>();
  for (const p of portfolios ?? []) portfolioMap.set(p.id, p.company_name);

  // Compute MRR, ARR
  const active = (subs ?? []).filter((s: any) => s.status === 'active' || s.status === 'trialing');
  const mrr = active.reduce((sum: number, s: any) => sum + (s.price_monthly_cents ?? 0), 0) / 100;
  const arr = mrr * 12;

  // Revenue by tier
  const tierRevenue: Record<string, number> = {};
  for (const s of active) {
    const tier = s.tier ?? 'free';
    tierRevenue[tier] = (tierRevenue[tier] ?? 0) + (s.price_monthly_cents ?? 0);
  }

  // New revenue this month (subscriptions created this month)
  const newSubs = (subs ?? []).filter((s: any) => s.status !== 'canceled' && s.created_at >= monthStart);
  const newRevenue = newSubs.reduce((sum: number, s: any) => sum + (s.price_monthly_cents ?? 0), 0) / 100;

  // Lost revenue (canceled this month)
  const lostSubs = (subs ?? []).filter((s: any) => s.status === 'canceled' && s.canceled_at && s.canceled_at >= monthStart);
  const lostRevenue = lostSubs.reduce((sum: number, s: any) => sum + (s.price_monthly_cents ?? 0), 0) / 100;

  // Revenue by company (top 20)
  const companyRevenue: Map<string, number> = new Map();
  for (const s of active) {
    const name = portfolioMap.get(s.portfolio_id) ?? s.portfolio_id;
    companyRevenue.set(name, (companyRevenue.get(name) ?? 0) + (s.price_monthly_cents ?? 0));
  }
  const topCompanies = Array.from(companyRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // 6-month trend reconstructed from subscription lifetimes: a subscription
  // counts toward a month if it was created by month-end and not yet canceled.
  const trend: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59).toISOString();
    const value = (subs ?? []).reduce((sum: number, s: any) => {
      const startedBy = s.created_at && s.created_at <= monthEnd;
      const stillActive = !s.canceled_at || s.canceled_at > monthEnd;
      return startedBy && stillActive ? sum + (s.price_monthly_cents ?? 0) : sum;
    }, 0) / 100;
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trend.push({ label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), value });
  }
  const maxRevenue = Math.max(...trend.map((t) => t.value), 1);

  // Tier composition
  const tierEntries = Object.entries(tierRevenue).sort((a, b) => b[1] - a[1]);
  const tierTotal = tierEntries.reduce((sum, [, v]) => sum + v, 0) || 1;
  const tierColors: Record<string, string> = {
    max: 'bg-blue-600',
    plus: 'bg-emerald-500',
    core: 'bg-amber-500',
    free: 'bg-gray-300',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Revenue</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide revenue analytics across all companies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="MRR" value={money(mrr)} icon={DollarSign} />
        <StatCard label="ARR" value={money(arr)} sub={`MRR × 12`} icon={TrendingUp} />
        <StatCard label="New Revenue (MTD)" value={money(newRevenue)} icon={ArrowUpRight} />
        <StatCard label="Lost Revenue (MTD)" value={money(lostRevenue)} icon={TrendingDown} />
        <StatCard label="Avg Per Company" value={money(active.length > 0 ? mrr / active.length : 0)} icon={Layers} />
      </div>

      {/* Revenue Trend Chart */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-gray-950">6-Month Revenue Trend</h2>
        <div className="flex h-48 items-end gap-2">
          {trend.map((m) => {
            const heightPct = (m.value / maxRevenue) * 100;
            return (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs tabular-nums text-gray-500">{money(m.value)}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-blue-600/80 transition-all"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{m.label}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-gray-400">Reconstructed from subscription start and cancellation dates.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Revenue By Company */}
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-950">Revenue by Company</h2>
            <p className="mt-0.5 text-xs text-gray-500">Top 20 companies by monthly revenue</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-4 py-2.5 text-left font-medium">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Company</th>
                  <th className="px-4 py-2.5 text-right font-medium">Monthly</th>
                  <th className="px-4 py-2.5 text-right font-medium">Annual</th>
                </tr>
              </thead>
              <tbody>
                {topCompanies.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No revenue data</td></tr>
                ) : (
                  topCompanies.map(([name, rev], i) => (
                    <tr key={name} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 text-xs tabular-nums text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{money(rev / 100)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">{money((rev * 12) / 100)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue Composition */}
        <div className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-gray-950">Revenue by Plan Tier</h2>
          {tierEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No tier data available</p>
          ) : (
            <div className="space-y-4">
              {tierEntries.map(([tier, cents]) => {
                const pct = tierTotal > 0 ? Math.round((cents / tierTotal) * 100) : 0;
                const tierName = tier.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                return (
                  <div key={tier}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-700">{tierName}</span>
                      <span className="font-medium tabular-nums text-gray-900">{money(cents / 100)} ({pct}%)</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-3 rounded-full ${tierColors[tier] ?? 'bg-blue-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-semibold">
                <span className="text-gray-950">Total MRR</span>
                <span className="tabular-nums text-gray-950">{money(tierTotal / 100)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
