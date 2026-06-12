import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { AlertTriangle, Clock, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

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

function HealthBadge({ status }: { status: string }) {
  const tones: Record<string, Tone> = {
    healthy: 'success',
    warning: 'warning',
    attention: 'warning',
    critical: 'danger',
  };
  return (
    <StatusChip tone={tones[status] ?? 'warning'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </StatusChip>
  );
}

const card = 'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
const theadCls = 'border-b border-gray-100 bg-gray-50/60 text-[11px] uppercase tracking-wide text-gray-500';
const trowCls = 'border-b border-gray-50 last:border-0 hover:bg-gray-50/60';

export default async function AssociationHealthPage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  const todayDate = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  // Try v_company_health view
  let healthRows: any[] = [];
  try {
    const { data } = await db.from('v_company_health').select('*');
    healthRows = data ?? [];
  } catch { healthRows = []; }

  // Fallback: compute from raw tables
  let assocHealthData: any[] = [];
  if (healthRows.length > 0) {
    assocHealthData = healthRows;
  } else {
    // Fetch associations with portfolio info
    const { data: assocs } = await db
      .from('associations')
      .select('id, name, portfolio_id, city, unit_count, portfolios!inner(company_name)')
      .is('archived_at', null)
      .order('name');

    if (assocs && assocs.length > 0) {
      const assocIds = assocs.map((a: any) => a.id);
      const [openWO, overdueWO, openViols, managerActivity] = await Promise.all([
        db.from('work_orders').select('association_id')
          .in('association_id', assocIds)
          .is('archived_at', null)
          .not('status', 'in', '("completed","closed","cancelled")'),
        db.from('work_orders').select('association_id')
          .in('association_id', assocIds)
          .is('archived_at', null)
          .not('status', 'in', '("completed","closed","cancelled")')
          .lt('scheduled_date', todayDate),
        db.from('violations').select('association_id')
          .in('association_id', assocIds)
          .is('archived_at', null)
          .not('status', 'in', '("closed","cured")'),
        db.from('activity').select('user_id, created_at')
          .gte('created_at', sevenDaysAgo)
          .limit(500),
      ]);

      const openWOMap = new Map<string, number>();
      const overdueWOMap = new Map<string, number>();
      const violMap = new Map<string, number>();
      for (const w of openWO.data ?? []) openWOMap.set(w.association_id, (openWOMap.get(w.association_id) ?? 0) + 1);
      for (const w of overdueWO.data ?? []) overdueWOMap.set(w.association_id, (overdueWOMap.get(w.association_id) ?? 0) + 1);
      for (const v of openViols.data ?? []) violMap.set(v.association_id, (violMap.get(v.association_id) ?? 0) + 1);

      assocHealthData = assocs.map((a: any) => {
        const open = openWOMap.get(a.id) ?? 0;
        const overdue = overdueWOMap.get(a.id) ?? 0;
        const viols = violMap.get(a.id) ?? 0;
        let health = 'healthy';
        if (overdue > 3 || open > 10) health = 'critical';
        else if (overdue > 0 || open > 5) health = 'warning';
        const hasManagerActivity = (managerActivity.data ?? []).some((act: any) => act.user_id);
        return {
          portfolio_id: a.portfolio_id,
          company_name: a.portfolios?.company_name ?? '—',
          id: a.id,
          name: a.name,
          unit_count: a.unit_count ?? 0,
          health,
          open_work_orders: open,
          overdue_work_orders: overdue,
          open_violations: viols,
          last_manager_activity: hasManagerActivity ? 'Recently' : '>7 days',
        };
      });
    }
  }

  // Split into worst/best
  const sorted = [...assocHealthData].sort((a, b) => {
    const scoreA = (a.overdue_work_orders ?? 0) * 3 + (a.open_work_orders ?? 0) + (a.open_violations ?? 0) * 2;
    const scoreB = (b.overdue_work_orders ?? 0) * 3 + (b.open_work_orders ?? 0) + (b.open_violations ?? 0) * 2;
    return scoreB - scoreA;
  });
  const worst10 = sorted.slice(0, 10);
  const best10 = [...sorted].sort((a, b) => {
    const scoreA = (a.overdue_work_orders ?? 0) * 3 + (a.open_work_orders ?? 0) + (a.open_violations ?? 0) * 2;
    const scoreB = (b.overdue_work_orders ?? 0) * 3 + (b.open_work_orders ?? 0) + (b.open_violations ?? 0) * 2;
    return scoreA - scoreB;
  }).slice(0, 10);

  const healthyCount = assocHealthData.filter((a: any) => a.health === 'healthy').length;
  const warningCount = assocHealthData.filter((a: any) => a.health === 'warning').length;
  const criticalCount = assocHealthData.filter((a: any) => a.health === 'critical').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Association Health</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">Platform-wide health monitoring across all associations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Associations" value={assocHealthData.length} icon={ShieldCheck} />
        <StatCard label="Healthy" value={healthyCount} icon={CheckCircle2} />
        <StatCard label="Warning" value={warningCount} icon={AlertTriangle} />
        <StatCard label="Critical" value={criticalCount} icon={XCircle} />
      </div>

      {/* Health Legend */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Health Status Legend</div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-gray-700">Green — Healthy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-sm text-gray-700">Yellow — Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-sm text-gray-700">Orange — Attention</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm text-gray-700">Red — Critical</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Worst 10 */}
        <div className={card}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-red-700">Worst 10 — Needs Attention</h2>
            <p className="mt-0.5 text-xs text-gray-500">Associations with highest overdue work orders + violations</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadCls}>
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Association</th>
                  <th className="px-4 py-2.5 text-left font-medium">Company</th>
                  <th className="px-4 py-2.5 text-right font-medium">Doors</th>
                  <th className="px-4 py-2.5 text-right font-medium">Open WO</th>
                  <th className="px-4 py-2.5 text-right font-medium">Overdue</th>
                  <th className="px-4 py-2.5 text-right font-medium">Violations</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {worst10.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No data</td></tr>
                ) : (
                  worst10.map((a: any) => (
                    <tr key={a.id} className={trowCls}>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.company_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{a.unit_count ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">{a.open_work_orders ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600 font-medium">{a.overdue_work_orders ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">{a.open_violations ?? 0}</td>
                      <td className="px-4 py-3"><HealthBadge status={a.health ?? 'warning'} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best 10 */}
        <div className={card}>
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-emerald-700">Best 10 — Healthiest</h2>
            <p className="mt-0.5 text-xs text-gray-500">Associations with fewest open issues</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadCls}>
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Association</th>
                  <th className="px-4 py-2.5 text-left font-medium">Company</th>
                  <th className="px-4 py-2.5 text-right font-medium">Doors</th>
                  <th className="px-4 py-2.5 text-right font-medium">Open WO</th>
                  <th className="px-4 py-2.5 text-right font-medium">Overdue</th>
                  <th className="px-4 py-2.5 text-right font-medium">Violations</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {best10.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No data</td></tr>
                ) : (
                  best10.map((a: any) => (
                    <tr key={a.id} className={trowCls}>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.company_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{a.unit_count ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">{a.open_work_orders ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">{a.overdue_work_orders ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">{a.open_violations ?? 0}</td>
                      <td className="px-4 py-3"><HealthBadge status={a.health ?? 'healthy'} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Full Table */}
      <div className={card}>
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-950">All Association Health</h2>
          <p className="mt-0.5 text-xs text-gray-500">Complete health overview across the platform</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadCls}>
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Association</th>
                <th className="px-4 py-2.5 text-left font-medium">Company</th>
                <th className="px-4 py-2.5 text-right font-medium">Doors</th>
                <th className="px-4 py-2.5 text-right font-medium">Open WO</th>
                <th className="px-4 py-2.5 text-right font-medium">Overdue WO</th>
                <th className="px-4 py-2.5 text-right font-medium">Violations</th>
                <th className="px-4 py-2.5 text-left font-medium">Manager Activity</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assocHealthData.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No associations found</td></tr>
              ) : (
                assocHealthData.map((a: any) => (
                  <tr key={a.id} className={trowCls}>
                    <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-3 text-gray-600">{a.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{a.unit_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">{a.open_work_orders ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{a.overdue_work_orders ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">{a.open_violations ?? 0}</td>
                    <td className="px-4 py-3 text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.last_manager_activity ?? '—'}
                    </td>
                    <td className="px-4 py-3"><HealthBadge status={a.health ?? 'healthy'} /></td>
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
