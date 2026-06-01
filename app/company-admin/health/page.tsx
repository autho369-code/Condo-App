import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import {
  Activity,
  Shield,
  Heart,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Users,
  Clock,
  Building2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Types & Helpers                                                           */
/* -------------------------------------------------------------------------- */

interface HealthScore {
  associationId: string;
  associationName: string;
  city: string;
  managerName: string | null;
  managerLastLogin: string | null;
  openWorkOrders: number;
  overdueWorkOrders: number;
  openViolations: number;
  noRecentLogin: boolean;
  score: number;
}

interface AssociationHealth {
  id: string;
  name: string;
  city: string;
  status: string;
}

function daysAgo(ts: string | null): number {
  if (!ts) return 999;
  return (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24);
}

function fmtSince(ts: string | null): string {
  if (!ts) return 'never';
  const d = daysAgo(ts);
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 7) return `${Math.floor(d)}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function healthLabel(score: number): string {
  if (score <= 2) return 'Healthy';
  if (score <= 5) return 'Warning';
  if (score <= 8) return 'Attention';
  return 'Critical';
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
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
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

function HealthBadge({ score }: { score: number }) {
  let color = 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20';
  let label = 'Healthy';
  if (score >= 3 && score <= 5) {
    color = 'text-amber-400 bg-amber-400/10 border-amber-500/20';
    label = 'Warning';
  }
  if (score >= 6 && score <= 8) {
    color = 'text-orange-400 bg-orange-400/10 border-orange-500/20';
    label = 'Attention';
  }
  if (score >= 9) {
    color = 'text-red-400 bg-red-400/10 border-red-500/20';
    label = 'Critical';
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function PortfolioHealthPage() {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">
            Contact the platform operator to set up your company.
          </p>
        </div>
      </div>
    );
  }

  // Fetch all data in parallel
  const [
    { data: associations },
    { data: workOrders },
    { data: violations },
    { data: managers },
  ] = await Promise.all([
    supabase
      .from('associations')
      .select('id, name, city, status, unit_count, site_manager_user_id')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null),
    supabase
      .from('work_orders')
      .select('id, association_id, status, created_at, completed_date')
      .eq('portfolio_id', portfolioId)
      .in('status', ['new', 'assigned', 'in_progress'])
      .is('archived_at', null),
    (supabase as any)
      .from('violations')
      .select('id, association_id, status')
      .eq('portfolio_id', portfolioId)
      .in('status', ['open', 'hearing_pending']),
    supabase
      .from('profiles')
      .select('id, full_name, email, last_login_at, portal_login_last_at')
      .eq('portfolio_id', portfolioId)
      .eq('hoa_role', 'manager'),
  ]);

  const assocList: AssociationHealth[] = (associations ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    city: a.city,
    status: a.status,
  }));

  const woList = workOrders ?? [];
  const vList = violations ?? [];
  const mgrList = managers ?? [];

  // Build manager lookup by id
  const managerMap = new Map<string, { name: string; lastLogin: string | null }>();
  for (const m of mgrList as any[]) {
    managerMap.set(m.id, {
      name: m.full_name ?? m.email ?? 'Unknown',
      lastLogin: m.portal_login_last_at ?? m.last_login_at ?? null,
    });
  }

  // Compute health scores per association
  const healthScores: HealthScore[] = assocList.map((assoc) => {
    const assocWOs = woList.filter((w: any) => w.association_id === assoc.id);
    const assocViolations = vList.filter((v: any) => v.association_id === assoc.id);

    const open = assocWOs.filter(
      (w: any) => w.status === 'open' || w.status === 'pending',
    ).length;
    const overdue = assocWOs.filter((w: any) => {
      if (w.status === 'completed' || w.status === 'closed') return false;
      return daysAgo(w.created_at) > 7;
    }).length;
    const viol = assocViolations.length;

    // Find site manager
    const assocData = (associations ?? []).find((a: any) => a.id === assoc.id) as any;
    const mgrId = assocData?.site_manager_user_id ?? null;
    const mgr = mgrId ? managerMap.get(mgrId) : null;
    const mgrLogin = mgr?.lastLogin ?? null;
    const noLogin = mgrLogin ? daysAgo(mgrLogin) >= 14 : true;

    // Health score computation (0-10 scale, lower = healthier)
    const openScore = Math.min(open, 3); // +1 per open (max 3)
    const overdueScore = Math.min(overdue * 2, 4); // +2 per overdue (max 4)
    const violScore = Math.min(viol, 2); // +1 per violation (max 2)
    const loginScore = noLogin ? 1 : 0; // +1 if no manager login 14+ days

    const score = openScore + overdueScore + violScore + loginScore;

    return {
      associationId: assoc.id,
      associationName: assoc.name,
      city: assoc.city,
      managerName: mgr?.name ?? 'Unassigned',
      managerLastLogin: mgrLogin,
      openWorkOrders: open,
      overdueWorkOrders: overdue,
      openViolations: viol,
      noRecentLogin: noLogin,
      score,
    };
  });

  // Sort by score descending (worst first)
  healthScores.sort((a, b) => b.score - a.score);

  const healthy = healthScores.filter((h) => h.score <= 2).length;
  const warning = healthScores.filter((h) => h.score >= 3 && h.score <= 5).length;
  const attention = healthScores.filter((h) => h.score >= 6 && h.score <= 8).length;
  const critical = healthScores.filter((h) => h.score >= 9).length;

  const totalAssociations = healthScores.length;

  // Average score
  const avgScore =
    totalAssociations > 0
      ? (healthScores.reduce((s, h) => s + h.score, 0) / totalAssociations).toFixed(1)
      : '0';

  // Manager workload: count associations per manager
  const managerWorkload = new Map<string, { assocs: number; lastLogin: string | null }>();
  for (const h of healthScores) {
    const key = h.managerName ?? 'Unassigned';
    const existing = managerWorkload.get(key);
    managerWorkload.set(key, {
      assocs: (existing?.assocs ?? 0) + 1,
      lastLogin: h.managerLastLogin,
    });
  }
  const workloadList = Array.from(managerWorkload.entries())
    .map(([name, data]) => ({ name, assocs: data.assocs, lastLogin: data.lastLogin }))
    .sort((a, b) => b.assocs - a.assocs);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Company Admin
        </p>
        <h1 className="mt-1 text-xl font-bold text-white">Portfolio Health Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          {totalAssociations} associations — average health score:{' '}
          <span className="font-semibold text-white">{avgScore}</span>/10
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Healthy"
          value={healthy}
          sub={totalAssociations > 0 ? `${Math.round((healthy / totalAssociations) * 100)}%` : '—'}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Warning"
          value={warning}
          sub={totalAssociations > 0 ? `${Math.round((warning / totalAssociations) * 100)}%` : '—'}
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          label="Attention"
          value={attention}
          icon={Activity}
          accent={attention > 0 ? 'red' : 'slate'}
        />
        <StatCard
          label="Critical"
          value={critical}
          icon={Shield}
          accent={critical > 0 ? 'red' : 'slate'}
        />
      </div>

      {/* Health distribution bar */}
      {totalAssociations > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Health Distribution
            </span>
          </div>
          <div className="h-4 w-full rounded-full bg-slate-800 overflow-hidden flex">
            {healthy > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(healthy / totalAssociations) * 100}%` }}
              />
            )}
            {warning > 0 && (
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(warning / totalAssociations) * 100}%` }}
              />
            )}
            {attention > 0 && (
              <div
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${(attention / totalAssociations) * 100}%` }}
              />
            )}
            {critical > 0 && (
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${(critical / totalAssociations) * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Healthy
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Warning
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> Attention
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Critical
            </span>
          </div>
        </div>
      )}

      {/* Health table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
          <Building2 className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Association Health Scores
          </h3>
        </div>

        {healthScores.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Building2 className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No associations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02] text-xs text-slate-400 uppercase">
                  <th className="text-left px-5 py-3 font-medium">Association</th>
                  <th className="text-left px-5 py-3 font-medium">Manager</th>
                  <th className="text-center px-5 py-3 font-medium">Open WOs</th>
                  <th className="text-center px-5 py-3 font-medium">Overdue</th>
                  <th className="text-center px-5 py-3 font-medium">Violations</th>
                  <th className="text-center px-5 py-3 font-medium">Last Activity</th>
                  <th className="text-center px-5 py-3 font-medium">Score</th>
                  <th className="text-center px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {healthScores.map((h) => (
                  <tr
                    key={h.associationId}
                    className={`hover:bg-white/[0.02] ${
                      h.noRecentLogin ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-white">
                        {h.associationName}
                      </p>
                      <p className="text-xs text-slate-500">{h.city}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-slate-300">{h.managerName}</span>
                        {h.noRecentLogin && (
                          <span
                            className="inline-flex rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-400"
                            title="No login in 14+ days"
                          >
                            !
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center text-sm tabular-nums text-slate-300">
                      {h.openWorkOrders}
                    </td>
                    <td className="px-5 py-3 text-center text-sm tabular-nums">
                      <span
                        className={
                          h.overdueWorkOrders > 0
                            ? 'text-red-400 font-semibold'
                            : 'text-slate-500'
                        }
                      >
                        {h.overdueWorkOrders}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-sm tabular-nums text-slate-300">
                      {h.openViolations}
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-slate-500 tabular-nums">
                      {fmtSince(h.managerLastLogin)}
                    </td>
                    <td className="px-5 py-3 text-center text-sm tabular-nums font-bold text-white">
                      {h.score}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <HealthBadge score={h.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manager workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Manager Workload */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <Users className="h-4 w-4 text-purple-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Manager Workload
            </h3>
          </div>
          {workloadList.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Users className="h-8 w-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No managers assigned</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {workloadList.map((w) => {
                const isUnassigned = w.name === 'Unassigned';
                const isOverloaded = w.assocs > 5;
                return (
                  <div
                    key={w.name}
                    className={`flex items-center justify-between px-5 py-3 ${
                      isUnassigned ? 'bg-red-500/5' : ''
                    }`}
                  >
                    <div>
                      <span
                        className={`text-sm font-medium ${
                          isUnassigned ? 'text-red-400' : 'text-white'
                        }`}
                      >
                        {w.name}
                      </span>
                      <p className="text-xs text-slate-500">Last login: {fmtSince(w.lastLogin)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isOverloaded ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        {w.assocs} associations
                      </span>
                      {isOverloaded && (
                        <span className="text-xs text-amber-500">⚠</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Average Response Time */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <Clock className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Response Metrics
            </h3>
          </div>
          <div className="divide-y divide-white/[0.04]">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Average Response Time</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                — <span className="text-xs text-slate-500 ml-1">not tracked</span>
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Open Work Orders</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {woList.length}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Open Violations</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {vList.length}
              </span>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-400">Managers with No Activity 14+ Days</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {workloadList.filter((w) => w.lastLogin && daysAgo(w.lastLogin) >= 14).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/company-admin/work-orders"
          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          View Work Orders
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href="/company-admin/managers"
          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          Manage Managers
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href="/company-admin/associations"
          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          View Associations
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
