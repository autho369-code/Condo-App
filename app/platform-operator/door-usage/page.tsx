import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Alert } from '@/components/ui/shell';
import { planFromTier } from '@/lib/billing/plans';
import { DoorOpen, TrendingUp, BarChart3, Layers } from 'lucide-react';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

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
          <div className="truncate text-[12.5px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
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

  // Doors are the units in a company's live (non-archived) associations,
  // measured against the subscription's units_limit — the same definition the
  // Companies pages use. (billing_usage is never written and operators cannot
  // read it, so it always rendered empty.)
  const [portfoliosRes, subsRes, assocRes] = await Promise.all([
    db.from('portfolios').select('id, company_name, suspended_at').is('archived_at', null).order('company_name'),
    fetchAllRows<any>(() => db.from('subscriptions').select('id, portfolio_id, tier, status, units_limit').order('id')),
    fetchAllRows<any>(() => db.from('associations').select('id, portfolio_id, unit_count').is('archived_at', null).order('id')),
  ]);
  const loadError = portfoliosRes.error?.message ?? subsRes.error ?? assocRes.error ?? null;

  const subMap = new Map<string, any>();
  for (const s of subsRes.rows) subMap.set(s.portfolio_id, s);
  const doorsByPortfolio = new Map<string, number>();
  for (const a of assocRes.rows) {
    doorsByPortfolio.set(a.portfolio_id, (doorsByPortfolio.get(a.portfolio_id) ?? 0) + Number(a.unit_count ?? 0));
  }

  let totalActive = 0;
  let totalIncluded = 0;
  let totalOverage = 0;
  let overLimitCompanies = 0;

  const rows = ((portfoliosRes.data ?? []) as any[]).map((p) => {
    const sub = subMap.get(p.id);
    const active = doorsByPortfolio.get(p.id) ?? 0;
    const limit = sub?.units_limit == null ? null : Number(sub.units_limit);
    const overage = limit == null ? 0 : Math.max(0, active - limit);
    totalActive += active;
    totalIncluded += limit ?? 0;
    totalOverage += overage;
    if (overage > 0) overLimitCompanies += 1;
    return { portfolio_id: p.id, company_name: p.company_name, active, limit, overage, tier: sub?.tier ?? null, status: sub?.status ?? null };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Door Usage</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide door usage monitoring across all companies</p>
      </div>

      {loadError && <Alert title="Some door usage data could not be loaded">{loadError}</Alert>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Active Doors" value={totalActive.toLocaleString()} icon={DoorOpen} />
        <StatCard label="Included Doors" value={totalIncluded.toLocaleString()} icon={Layers} />
        <StatCard label="Doors Over Limit" value={totalOverage.toLocaleString()} icon={TrendingUp} />
        <StatCard label="Companies Over Limit" value={overLimitCompanies.toLocaleString()} icon={BarChart3} />
      </div>

      {/* Door Usage Table */}
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">Door Usage by Company</h2>
          <p className="mt-0.5 text-xs text-gray-500">Units in active associations against each subscription&apos;s unit limit</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60 text-[12.5px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Company</th>
                <th className="px-4 py-2.5 text-right font-medium">Active Doors</th>
                <th className="px-4 py-2.5 text-right font-medium">Included</th>
                <th className="px-4 py-2.5 text-right font-medium">Over Limit</th>
                <th className="px-4 py-2.5 text-left font-medium" style={{ minWidth: 140 }}>Usage</th>
                <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No companies found</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.portfolio_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">{row.active.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{row.limit == null ? '—' : row.limit.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${row.overage > 0 ? 'font-semibold text-red-700' : 'text-gray-400'}`}>
                      {row.overage > 0 ? row.overage.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">{row.limit == null ? <span className="text-xs text-gray-400">No limit set</span> : <UsageBar used={row.active} limit={row.limit} />}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-700">
                      {planFromTier(row.tier)?.name ?? (row.tier ? String(row.tier) : 'Not configured')}
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
