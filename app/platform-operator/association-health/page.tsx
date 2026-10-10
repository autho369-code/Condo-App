import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Alert } from '@/components/ui/shell';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
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
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[13px] font-medium leading-5 text-gray-500">{label}</div>
          <div className="mt-1.5 font-display text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</div>
          {sub && <div className="mt-1 text-[13px] text-gray-500">{sub}</div>}
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
const theadCls = 'border-b border-gray-100 bg-gray-50/60 text-[12.5px] uppercase tracking-wide text-gray-500';
const trowCls = 'border-b border-gray-50 last:border-0 hover:bg-gray-50/60';

export default async function AssociationHealthPage() {
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;
  const now = new Date();
  // "Overdue" compares against today's date in the platform zone, not UTC.
  const todayDate = todayInZone();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  // Compute per-association health from raw tables. (v_company_health is a
  // per-COMPANY aggregate — using it here rendered blank rows and zeroed
  // counters, so this page always computes its own per-association rows.)
  let assocHealthData: any[] = [];
  let loadError: string | null = null;
  {
    // Every active association platform-wide. The open-item queries read the
    // whole platform (an operator sees every row) and are paged past
    // PostgREST's 1,000-row cap; listing thousands of ids in .in() would also
    // overflow the request URL.
    const assocsRes = await fetchAllRows(() => db
      .from('associations')
      .select('id, name, portfolio_id, city, unit_count, portfolios!inner(company_name)')
      .is('archived_at', null)
      .order('name')
      .order('id'));
    const assocs = assocsRes.rows;
    loadError = assocsRes.error;

    if (assocs.length > 0) {
      const [openWO, overdueWO, openViols, managerActivity] = await Promise.all([
        fetchAllRows(() => db.from('work_orders').select('id, association_id')
          .is('archived_at', null)
          .not('status', 'in', '("done","completed","billed","closed","cancelled")')
          .order('id'), { maxRows: 500000 }),
        fetchAllRows(() => db.from('work_orders').select('id, association_id')
          .is('archived_at', null)
          .not('status', 'in', '("done","completed","billed","closed","cancelled")')
          .lt('scheduled_date', todayDate)
          .order('id'), { maxRows: 500000 }),
        fetchAllRows(() => db.from('violations').select('id, association_id')
          .is('archived_at', null)
          .not('status', 'in', '("closed","cured")')
          .order('id'), { maxRows: 500000 }),
        fetchAllRows(() => db.from('association_managers').select('id, association_id, user_id')
          .is('ended_at', null)
          .order('id')),
      ]);
      loadError = loadError ?? openWO.error ?? overdueWO.error ?? openViols.error ?? managerActivity.error;

      // Assigned managers who signed in during the last 7 days
      // (last_login_at is stamped by record_login_attempt).
      const managerIds = new Set((managerActivity.rows ?? []).map((m: any) => m.user_id).filter(Boolean));
      const recentLogins = managerIds.size > 0
        ? await fetchAllRows(() => db.from('profiles').select('id').gte('last_login_at', sevenDaysAgo).order('id'))
        : { rows: [] as any[], error: null };
      loadError = loadError ?? recentLogins.error;
      const activeIds = new Set(recentLogins.rows.map((p: any) => p.id).filter((id: string) => managerIds.has(id)));
      const activeAssocs = new Set<string>();
      const managedAssocs = new Set<string>();
      for (const m of managerActivity.rows) {
        managedAssocs.add(m.association_id);
        if (activeIds.has(m.user_id)) activeAssocs.add(m.association_id);
      }

      const openWOMap = new Map<string, number>();
      const overdueWOMap = new Map<string, number>();
      const violMap = new Map<string, number>();
      for (const w of openWO.rows) openWOMap.set(w.association_id, (openWOMap.get(w.association_id) ?? 0) + 1);
      for (const w of overdueWO.rows) overdueWOMap.set(w.association_id, (overdueWOMap.get(w.association_id) ?? 0) + 1);
      for (const v of openViols.rows) violMap.set(v.association_id, (violMap.get(v.association_id) ?? 0) + 1);

      assocHealthData = assocs.map((a: any) => {
        const open = openWOMap.get(a.id) ?? 0;
        const overdue = overdueWOMap.get(a.id) ?? 0;
        const viols = violMap.get(a.id) ?? 0;
        let health = 'healthy';
        if (overdue > 3 || open > 10) health = 'critical';
        else if (overdue > 0 || open > 5) health = 'warning';

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
          last_manager_activity: !managedAssocs.has(a.id) ? 'No manager assigned' : activeAssocs.has(a.id) ? 'Within 7 days' : '>7 days',
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
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Association Health</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">Platform-wide health monitoring across all associations</p>
      </div>

      {loadError && <Alert title="Some health data could not be loaded">{loadError}</Alert>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Associations" value={assocHealthData.length} icon={ShieldCheck} />
        <StatCard label="Healthy" value={healthyCount} icon={CheckCircle2} />
        <StatCard label="Warning" value={warningCount} icon={AlertTriangle} />
        <StatCard label="Critical" value={criticalCount} icon={XCircle} />
      </div>

      {/* Health Legend */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-3 text-[13px] font-semibold text-gray-700">Health Status Legend</div>
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
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-red-700">Worst 10 — Needs Attention</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Associations with highest overdue work orders + violations</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadCls}>
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Association</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Company</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Doors</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Open WO</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Overdue</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Violations</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Status</th>
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
                      <td className="px-4 py-3.5"><HealthBadge status={a.health ?? 'warning'} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best 10 */}
        <div className={card}>
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-emerald-700">Best 10 — Healthiest</h2>
            <p className="mt-0.5 text-[13px] text-gray-500">Associations with fewest open issues</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadCls}>
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Association</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Company</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Doors</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Open WO</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Overdue</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Violations</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Status</th>
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
                      <td className="px-4 py-3.5"><HealthBadge status={a.health ?? 'healthy'} /></td>
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
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">All Association Health</h2>
          <p className="mt-0.5 text-[13px] text-gray-500">Complete health overview across the platform</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadCls}>
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Association</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Company</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Doors</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Open WO</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Overdue WO</th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Violations</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Manager Activity</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium">Status</th>
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
                    <td className="px-4 py-3.5"><HealthBadge status={a.health ?? 'healthy'} /></td>
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
