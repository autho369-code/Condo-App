import { createClient } from '@/lib/supabase/server';

/**
 * Association Health Score — AI-weighted 0-100 composite metric.
 * Factors: violation health, financial health, maintenance health, compliance health.
 */
export async function AssociationHealthScore({ portfolioId }: { portfolioId: string }) {
  const supabase = await createClient();
  const db = supabase as any;

  // 1. Violation health (40% weight) — open + overdue violations
  const { count: openViolations } = await db
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")');

  const { count: overdueViolations } = await db
    .from('violations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("closed","cured")')
    .lt('due_date', new Date().toISOString().slice(0, 10));

  // 2. Financial health (30% weight) — delinquency
  const { data: summary } = await db
    .from('v_dashboard_summary')
    .select('delinquency_61_plus, outstanding_bills, unreconciled_accounts')
    .eq('portfolio_id', portfolioId)
    .maybeSingle();

  // 3. Maintenance health (20% weight) — open work orders
  const { count: openWorkOrders } = await db
    .from('work_orders')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .not('status', 'in', '("completed","closed","cancelled")');

  // 4. Compliance health (10% weight) — insurance near expiration
  const { count: insuranceExpiring } = await db
    .from('associations')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .lte('insurance_expiration', new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));

  // Compute score (100 = perfect health)
  const vScore = Math.max(0, 100 - (openViolations ?? 0) * 3 - (overdueViolations ?? 0) * 5);
  const fScore = Math.max(0, 100 - (Number(summary?.delinquency_61_plus ?? 0) > 0 ? 20 : 0) - (Number(summary?.outstanding_bills ?? 0) > 10000 ? 15 : 0));
  const mScore = Math.max(0, 100 - (openWorkOrders ?? 0) * 4);
  const cScore = Math.max(0, 100 - (insuranceExpiring ?? 0) * 10);

  const score = Math.round(vScore * 0.40 + fScore * 0.30 + mScore * 0.20 + cScore * 0.10);

  const tone = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'bordeaux';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs attention';

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">AI Health Score</div>
          <div className="mt-1 font-display text-3xl tracking-tight text-ink-900">{score}<span className="text-lg text-ink-400">/100</span></div>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
          tone === 'emerald' ? 'bg-emerald-100 text-emerald-800' :
          tone === 'amber' ? 'bg-amber-100 text-amber-800' :
          'bg-bordeaux-100 text-bordeaux-800'
        }`}>
          {label}
        </div>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-cream-100">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${
            tone === 'emerald' ? 'bg-emerald-500' :
            tone === 'amber' ? 'bg-amber-500' :
            'bg-bordeaux-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-500">
        <div>Violations: <span className="font-medium text-ink-700">{openViolations ?? 0}</span></div>
        <div>Work orders: <span className="font-medium text-ink-700">{openWorkOrders ?? 0}</span></div>
        <div>Delinquent: <span className="font-medium text-ink-700">${Number(summary?.delinquency_61_plus ?? 0).toLocaleString()}</span></div>
        <div>Insurance: <span className="font-medium text-ink-700">{insuranceExpiring ?? 0} expiring</span></div>
      </div>
    </div>
  );
}
