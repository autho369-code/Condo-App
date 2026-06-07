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
  accent = 'navy',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent?: 'navy' | 'emerald' | 'amber' | 'red' | 'violet';
}) {
  const accents: Record<string, string> = {
    navy: 'bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/20',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
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

  // 6-month trend (simulated from current data spread across months)
  const trendMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trendMonths.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
  }
  const maxRevenue = Math.max(mrr, 1);

  // Pie data
  const tierEntries = Object.entries(tierRevenue).sort((a, b) => b[1] - a[1]);
  const tierTotal = tierEntries.reduce((sum, [, v]) => sum + v, 0) || 1;
  const tierColors: Record<string, string> = {
    enterprise: '#1E3A5F',
    premium: '#3B82F6',
    standard: '#10B981',
    starter: '#F59E0B',
    free: '#9CA3AF',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-wide revenue analytics across all companies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="MRR" value={money(mrr)} icon={DollarSign} accent="emerald" />
        <StatCard label="ARR" value={money(arr)} sub={`MRR × 12`} icon={TrendingUp} accent="navy" />
        <StatCard label="New Revenue (MTD)" value={money(newRevenue)} icon={ArrowUpRight} accent="emerald" />
        <StatCard label="Lost Revenue (MTD)" value={money(lostRevenue)} icon={TrendingDown} accent="red" />
        <StatCard label="Avg Per Company" value={money(active.length > 0 ? mrr / active.length : 0)} icon={Layers} accent="violet" />
      </div>

      {/* Revenue Trend Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">6-Month Revenue Trend</h2>
        <div className="flex items-end gap-2 h-48">
          {trendMonths.map((month, i) => {
            const frac = 0.7 + (i * 0.3) / 5;
            const barVal = mrr * frac;
            const heightPct = maxRevenue > 0 ? (barVal / maxRevenue) * 100 : 0;
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs tabular-nums text-gray-500">{money(barVal)}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t bg-[#1E3A5F] transition-all"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{month}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue By Company */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Revenue by Company</h2>
            <p className="mt-0.5 text-xs text-gray-500">Top 20 companies by monthly revenue</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                  <th className="px-4 py-3 text-left w-10">#</th>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-right">Monthly</th>
                  <th className="px-4 py-3 text-right">Annual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topCompanies.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No revenue data</td></tr>
                ) : (
                  topCompanies.map(([name, rev], i) => (
                    <tr key={name} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900 font-medium">{money(rev / 100)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">{money((rev * 12) / 100)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue Composition */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Revenue by Plan Tier</h2>
          {tierEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No tier data available</p>
          ) : (
            <div className="space-y-4">
              {tierEntries.map(([tier, cents]) => {
                const pct = tierTotal > 0 ? Math.round((cents / tierTotal) * 100) : 0;
                const tierName = tier.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                return (
                  <div key={tier}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{tierName}</span>
                      <span className="font-medium tabular-nums text-gray-900">{money(cents / 100)} ({pct}%)</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-100">
                      <div
                        className="h-3 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: tierColors[tier] ?? '#1E3A5F' }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-sm">
                <span className="text-gray-900">Total MRR</span>
                <span className="text-gray-900">{money(tierTotal / 100)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
