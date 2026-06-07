import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { money } from '@/lib/utils';
import { DoorOpen, TrendingUp, BarChart3, Layers } from 'lucide-react';

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

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 90 ? '#EF4444' : pct >= 75 ? '#F59E0B' : '#10B981';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-200">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500">{pct}%</span>
    </div>
  );
}

export default async function DoorUsagePage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  // Billing usage records
  const { data: usageRows } = await db
    .from('billing_usage')
    .select('*, portfolios!inner(company_name)')
    .order('period_end', { ascending: false })
    .limit(100);

  // Subscriptions for included door limits
  const { data: subs } = await db
    .from('subscriptions')
    .select('portfolio_id, units_limit')
    .in('status', ['active', 'trialing']);

  const subMap = new Map<string, number>();
  for (const s of subs ?? []) {
    subMap.set(s.portfolio_id, s.units_limit ?? 0);
  }

  // Compute stats
  let totalActive = 0;
  let totalIncluded = 0;
  let totalOverage = 0;
  let totalMonthlyCost = 0;

  const rows = (usageRows ?? []).map((r: any) => {
    const active = r.doors_active ?? 0;
    const limit = r.doors_limit ?? subMap.get(r.portfolio_id) ?? 0;
    const overage = r.doors_overage ?? Math.max(0, active - limit);
    const pricePerDoor = (r.price_per_door_cents ?? 100) / 100;
    const monthlyCost = overage * pricePerDoor;

    totalActive += active;
    totalIncluded += limit;
    totalOverage += overage;
    totalMonthlyCost += monthlyCost;

    return { ...r, computedOverage: overage, monthlyCost, limit };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Door Usage</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-wide door usage monitoring across all companies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Active Doors" value={totalActive.toLocaleString()} icon={DoorOpen} accent="navy" />
        <StatCard label="Included Doors" value={totalIncluded.toLocaleString()} icon={Layers} accent="emerald" />
        <StatCard label="Additional Doors" value={totalOverage.toLocaleString()} icon={TrendingUp} accent={totalOverage > 0 ? 'amber' : 'emerald'} />
        <StatCard label="Monthly Door Revenue" value={money(totalMonthlyCost)} icon={BarChart3} accent="violet" />
      </div>

      {/* Door Usage Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Door Usage by Company</h2>
          <p className="mt-0.5 text-xs text-gray-500">Current billing period usage and costs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-right">Active Doors</th>
                <th className="px-4 py-3 text-right">Included</th>
                <th className="px-4 py-3 text-right">Additional</th>
                <th className="px-4 py-3 text-left" style={{ minWidth: 140 }}>Usage</th>
                <th className="px-4 py-3 text-right">Monthly Cost</th>
                <th className="px-4 py-3 text-left">Pricing Tier</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No door usage data found</td></tr>
              ) : (
                rows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.portfolios?.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">{row.doors_active?.toLocaleString() ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{row.limit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{row.computedOverage > 0 ? row.computedOverage.toLocaleString() : '—'}</td>
                    <td className="px-4 py-3"><UsageBar used={row.doors_active ?? 0} limit={row.limit} /></td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{money(row.monthlyCost)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.price_per_door_cents ? `${money(row.price_per_door_cents / 100)}/door` : 'Standard'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Adjust</span>
                        <span className="text-gray-300">|</span>
                        <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">Override</span>
                        <span className="text-gray-300">|</span>
                        <span className="cursor-pointer text-xs text-[#1E3A5F] hover:underline">History</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
