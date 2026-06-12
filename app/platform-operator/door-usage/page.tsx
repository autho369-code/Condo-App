import Link from 'next/link';
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

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
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
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Door Usage</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide door usage monitoring across all companies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Active Doors" value={totalActive.toLocaleString()} icon={DoorOpen} />
        <StatCard label="Included Doors" value={totalIncluded.toLocaleString()} icon={Layers} />
        <StatCard label="Additional Doors" value={totalOverage.toLocaleString()} icon={TrendingUp} />
        <StatCard label="Monthly Door Revenue" value={money(totalMonthlyCost)} icon={BarChart3} />
      </div>

      {/* Door Usage Table */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Door Usage by Company</h2>
          <p className="mt-0.5 text-xs text-gray-500">Current billing period usage and costs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Company</th>
                <th className="px-4 py-2.5 text-right font-medium">Active Doors</th>
                <th className="px-4 py-2.5 text-right font-medium">Included</th>
                <th className="px-4 py-2.5 text-right font-medium">Additional</th>
                <th className="px-4 py-2.5 text-left font-medium" style={{ minWidth: 140 }}>Usage</th>
                <th className="px-4 py-2.5 text-right font-medium">Monthly Cost</th>
                <th className="px-4 py-2.5 text-left font-medium">Pricing Tier</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No door usage data found</td></tr>
              ) : (
                rows.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.portfolios?.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">{row.doors_active?.toLocaleString() ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.limit.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${row.computedOverage > 0 ? 'font-semibold text-red-700' : 'text-gray-400'}`}>
                      {row.computedOverage > 0 ? row.computedOverage.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3"><UsageBar used={row.doors_active ?? 0} limit={row.limit} /></td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{money(row.monthlyCost)}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      {row.price_per_door_cents ? `${money(row.price_per_door_cents / 100)}/door` : 'Standard'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.portfolio_id ? (
                        <Link
                          href={`/platform-operator/companies/${row.portfolio_id}`}
                          className="text-xs font-medium text-gray-700 hover:text-gray-950 hover:underline"
                        >
                          Adjust limits
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
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
  );
}
