import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date } from '@/lib/utils';
import { Heart, Wrench, AlertTriangle, Clock, CheckCircle2, XCircle, AlertOctagon, ShieldCheck } from 'lucide-react';

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

function HealthBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    healthy: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    warning: 'bg-amber-100 text-amber-700 ring-amber-200',
    attention: 'bg-orange-100 text-orange-700 ring-orange-200',
    critical: 'bg-red-100 text-red-700 ring-red-200',
  };
  const icons: Record<string, React.ElementType> = {
    healthy: CheckCircle2,
    warning: AlertTriangle,
    attention: AlertOctagon,
    critical: XCircle,
  };
  const cls = map[status] ?? map.warning;
  const Icon = icons[status] ?? AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 h-6 rounded-full px-2.5 text-xs font-medium ring-1 ${cls}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

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
        <h1 className="text-2xl font-bold text-gray-900">Association Health</h1>
        <p className="mt-1 text-sm text-gray-500">Platform-wide health monitoring across all associations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Associations" value={assocHealthData.length} icon={ShieldCheck} accent="navy" />
        <StatCard label="Healthy" value={healthyCount} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Warning" value={warningCount} icon={AlertTriangle} accent="amber" />
        <StatCard label="Critical" value={criticalCount} icon={XCircle} accent="red" />
      </div>

      {/* Health Legend */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
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
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-red-700">Worst 10 — Needs Attention</h2>
            <p className="mt-0.5 text-xs text-gray-500">Associations with highest overdue work orders + violations</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                  <th className="px-4 py-3 text-left">Association</th>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-right">Doors</th>
                  <th className="px-4 py-3 text-right">Open WO</th>
                  <th className="px-4 py-3 text-right">Overdue</th>
                  <th className="px-4 py-3 text-right">Violations</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {worst10.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
                ) : (
                  worst10.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
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
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-emerald-700">Best 10 — Healthiest</h2>
            <p className="mt-0.5 text-xs text-gray-500">Associations with fewest open issues</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                  <th className="px-4 py-3 text-left">Association</th>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-right">Doors</th>
                  <th className="px-4 py-3 text-right">Open WO</th>
                  <th className="px-4 py-3 text-right">Overdue</th>
                  <th className="px-4 py-3 text-right">Violations</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {best10.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data</td></tr>
                ) : (
                  best10.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
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
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">All Association Health</h2>
          <p className="mt-0.5 text-xs text-gray-500">Complete health overview across the platform</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3 text-left">Association</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-right">Doors</th>
                <th className="px-4 py-3 text-right">Open WO</th>
                <th className="px-4 py-3 text-right">Overdue WO</th>
                <th className="px-4 py-3 text-right">Violations</th>
                <th className="px-4 py-3 text-left">Manager Activity</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assocHealthData.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No associations found</td></tr>
              ) : (
                assocHealthData.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
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
