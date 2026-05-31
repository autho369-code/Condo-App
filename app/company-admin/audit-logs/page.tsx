import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { date } from '@/lib/utils';
import {
  Shield,
  Clock,
  Users,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function timeAgo(ts: string | null): string {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncate(str: string | null, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/*  Components                                                                 */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'slate',
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'purple' | 'slate';
}) {
  const gradient: Record<string, string> = {
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-500/20',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-500/20',
    purple: 'from-purple-500/15 to-purple-500/5 border-purple-500/20',
    slate: 'from-slate-600/15 to-slate-600/5 border-slate-700/30',
  };
  const iconBg: Record<string, string> = {
    emerald: 'bg-emerald-400/10 text-emerald-400',
    blue: 'bg-blue-400/10 text-blue-400',
    amber: 'bg-amber-400/10 text-amber-400',
    purple: 'bg-purple-400/10 text-purple-400',
    slate: 'bg-slate-400/10 text-slate-400',
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradient[accent]} p-5`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${iconBg[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

interface SearchParams {
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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
          <p className="text-sm text-slate-400 mt-1">Contact the platform operator to set up your company.</p>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const filterAction = params.action ?? '';
  const filterActor = params.actor ?? '';
  const page = parseInt(params.page ?? '1', 10) || 1;
  const pageSize = 50;

  // Get all profile IDs for this portfolio to filter audit logs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('portfolio_id', portfolioId);

  const profileList = profiles ?? [];
  const profileIds = profileList.map((p) => p.id);

  // Build audit logs query — filter by actor_id IN profile IDs
  // Note: audit_logs doesn't have portfolio_id; we filter by actor_id matching portfolio profiles
  let query = (supabase as any)
    .from('audit_logs')
    .select('id, entity_type, entity_id, action, actor_id, actor_email, changes, ip_address, created_at', { count: 'exact' })
    .in('actor_id', profileIds.length ? profileIds : ['__none__'])
    .order('created_at', { ascending: false });

  if (filterAction) {
    query = query.eq('action', filterAction);
  }
  if (filterActor) {
    query = query.eq('actor_email', filterActor);
  }

  // Date range filters on created_at
  if (params.from) {
    query = query.gte('created_at', params.from);
  }
  if (params.to) {
    // Add one day to include the full end date
    const endDate = new Date(params.to);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt('created_at', endDate.toISOString());
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: logs, count: totalLogs } = await query;
  const logList = (logs ?? []) as any[];

  // Stats — separate lightweight queries
  const { count: totalCount } = await (supabase as any)
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .in('actor_id', profileIds.length ? profileIds : ['__none__']);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count: todayCount } = await (supabase as any)
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .in('actor_id', profileIds.length ? profileIds : ['__none__'])
    .gte('created_at', today.toISOString());

  // Count unique actors
  const { data: uniqueActors } = await (supabase as any)
    .from('audit_logs')
    .select('actor_email')
    .in('actor_id', profileIds.length ? profileIds : ['__none__'])
    .limit(1000);

  const uniqueActorCount = new Set((uniqueActors ?? []).map((a: any) => a.actor_email).filter(Boolean)).size;

  // Unique actions for filter dropdown
  const { data: allActions } = await (supabase as any)
    .from('audit_logs')
    .select('action')
    .in('actor_id', profileIds.length ? profileIds : ['__none__'])
    .limit(500);

  const actionSet = [...new Set((allActions ?? []).map((a: any) => a.action).filter(Boolean))] as string[];

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-400">
            Activity trail across all associations in your portfolio
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Total Events"
          value={totalCount ?? 0}
          icon={Activity}
          accent="blue"
        />
        <StatCard
          label="Events Today"
          value={todayCount ?? 0}
          icon={Clock}
          accent="emerald"
        />
        <StatCard
          label="Unique Actors"
          value={uniqueActorCount}
          icon={Users}
          accent="purple"
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <form className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Filters</span>
          </div>
          <select
            name="action"
            defaultValue={filterAction}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">All Actions</option>
            {actionSet.map((a) => (
              <option key={a} value={a}>{actionLabel(a)}</option>
            ))}
          </select>
          <input
            type="text"
            name="actor"
            defaultValue={filterActor}
            placeholder="Actor email..."
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ''}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            />
            <span className="text-xs text-slate-600">to</span>
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ''}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            <Search className="h-3.5 w-3.5" />
            Apply
          </button>
          {(filterAction || filterActor || params.from || params.to) && (
            <a href="/company-admin/audit-logs" className="text-xs text-slate-500 hover:text-slate-400 transition">
              Clear filters
            </a>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date/Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Entity Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Entity ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {logList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    {totalCount === 0
                      ? 'No audit log entries found for this portfolio.'
                      : 'No entries match the current filters.'}
                  </td>
                </tr>
              ) : (
                logList.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-300 tabular-nums">
                        {entry.created_at ? date(entry.created_at) : '—'}
                      </div>
                      <div className="text-xs text-slate-500">{timeAgo(entry.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {entry.actor_email || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {actionLabel(entry.action)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {entry.entity_type ? actionLabel(entry.entity_type) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono text-xs">
                      {truncate(entry.entity_id, 12)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 font-mono text-xs">
                      {entry.ip_address || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {from + 1}–{Math.min(to + 1, totalCount ?? 0)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <a
                  href={`/company-admin/audit-logs?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 transition"
                >
                  <ChevronLeft className="h-3 w-3" /> Prev
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-2 py-1 text-xs text-slate-600 cursor-not-allowed">
                  <ChevronLeft className="h-3 w-3" /> Prev
                </span>
              )}
              <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
              {page < totalPages ? (
                <a
                  href={`/company-admin/audit-logs?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 transition"
                >
                  Next <ChevronRight className="h-3 w-3" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-2 py-1 text-xs text-slate-600 cursor-not-allowed">
                  Next <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
