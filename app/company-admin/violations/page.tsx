import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';
import {
  AlertTriangle,
  Gavel,
  CheckCircle2,
  DollarSign,
  Clock,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Hash,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-400/10 text-amber-400 border-amber-500/20',
  pending_hearing: 'bg-blue-400/10 text-blue-400 border-blue-500/20',
  resolved: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20',
  closed: 'bg-slate-400/10 text-slate-400 border-slate-500/20',
  dismissed: 'bg-slate-400/10 text-slate-400 border-slate-500/20',
  cured: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20',
};

const TYPE_COLORS: Record<string, string> = {
  parking: 'bg-purple-400/10 text-purple-400 border-purple-500/20',
  noise: 'bg-orange-400/10 text-orange-400 border-orange-500/20',
  maintenance: 'bg-cyan-400/10 text-cyan-400 border-cyan-500/20',
  architectural: 'bg-pink-400/10 text-pink-400 border-pink-500/20',
  pet: 'bg-yellow-400/10 text-yellow-400 border-yellow-500/20',
  general: 'bg-slate-400/10 text-slate-400 border-slate-500/20',
};

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysAgo(ts: string | null): number {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
}

function badge(label: string, colorMap: Record<string, string>, fallback: string) {
  const colors = colorMap[label] ?? fallback;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}>
      {statusLabel(label)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Components                                                                 */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'emerald',
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'slate';
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

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradient[accent]} p-5`}>
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
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

interface SearchParams {
  status?: string;
  type?: string;
  association?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function ViolationsPage({
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
          <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">Contact the platform operator to set up your company.</p>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const filterStatus = params.status ?? '';
  const filterType = params.type ?? '';
  const filterAssociation = params.association ?? '';
  const page = parseInt(params.page ?? '1', 10) || 1;
  const pageSize = 25;

  // Fetch associations for this portfolio (used for filter dropdown and join display)
  const { data: associations } = await supabase
    .from('associations')
    .select('id, name')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name');

  const associationList = associations ?? [];
  const associationMap = new Map(associationList.map((a) => [a.id, a.name]));

  // Build violations query — filter through association portfolio_id
  const associationIds = associationList.map((a) => a.id);

  let query = db
    .from('violations')
    .select('id, association_id, unit_id, violation_type, status, title, date_observed, hearing_date, fine_amount, due_date, created_at, closed_at', { count: 'exact' })
    .in('association_id', associationIds.length ? associationIds : ['__none__'])
    .order('created_at', { ascending: false });

  if (filterStatus) query = query.eq('status', filterStatus);
  if (filterType) query = query.eq('violation_type', filterType);
  if (filterAssociation) query = query.eq('association_id', filterAssociation);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: violations, count: totalViolations } = await query;

  // Fetch unit numbers in batch
  const unitIds = [...new Set((violations ?? []).map((v: any) => v.unit_id).filter(Boolean))];
  let unitMap = new Map<string, string>();
  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_number')
      .in('id', unitIds as string[]);
    (units ?? []).forEach((u) => unitMap.set(u.id, u.unit_number));
  }

  // Summary stats (separate query for all violations in portfolio, unfiltered)
  const { data: allViolations } = await supabase
    .from('violations')
    .select('id, status, fine_amount, created_at, closed_at')
    .in('association_id', associationIds.length ? associationIds : ['__none__']);

  const violationList = allViolations ?? [];
  const openCount = violationList.filter((v) => v.status === 'open').length;
  const pendingHearingCount = violationList.filter((v) => v.status === 'hearing_pending').length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const resolvedThisMonth = violationList.filter(
    (v) => v.closed_at && v.closed_at >= startOfMonth && (v.status === 'closed' || v.status === 'cured' || v.status === 'fined')
  ).length;
  const totalFines = violationList.reduce((sum, v) => sum + (v.fine_amount ?? 0), 0);

  const totalPages = Math.max(1, Math.ceil((totalViolations ?? 0) / pageSize));

  // Unique violation types for filter dropdown
  const violationTypes = [...new Set(violationList.map((v: any) => v.violation_type).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Violations Oversight</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitor violations across {associationList.length} associations
          </p>
        </div>
        <Link href="/company-admin/platform-requests">
          <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <AlertTriangle className="h-4 w-4" />
            Report Issue
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Open Violations"
          value={openCount}
          icon={AlertTriangle}
          accent={openCount > 5 ? 'red' : 'amber'}
        />
        <StatCard
          label="Pending Hearing"
          value={pendingHearingCount}
          icon={Gavel}
          accent={pendingHearingCount > 3 ? 'red' : 'blue'}
        />
        <StatCard
          label="Resolved This Month"
          value={resolvedThisMonth}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Total Fines"
          value={money(totalFines / 100)}
          icon={DollarSign}
          accent={totalFines > 50000 ? 'red' : 'slate'}
        />
      </div>

      {/* Stats row */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">Open:</span>
            <span className="font-semibold text-white tabular-nums">{openCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">Pending Hearings:</span>
            <span className="font-semibold text-white tabular-nums">{pendingHearingCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">Total:</span>
            <span className="font-semibold text-white tabular-nums">{totalViolations ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <form className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Filters</span>
          </div>
          <select
            name="association"
            defaultValue={filterAssociation}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">All Associations</option>
            {associationList.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filterStatus}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="hearing_pending">Pending Hearing</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="dismissed">Dismissed</option>
            <option value="cured">Cured</option>
          </select>
          <select
            name="type"
            defaultValue={filterType}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">All Types</option>
            {violationTypes.map((t) => (
              <option key={t} value={t}>{statusLabel(t)}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ''}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
              placeholder="From"
            />
            <span className="text-xs text-slate-600">to</span>
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ''}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
              placeholder="To"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            <Search className="h-3.5 w-3.5" />
            Apply
          </button>
          {(filterStatus || filterType || filterAssociation || params.from || params.to) && (
            <a href="/company-admin/violations" className="text-xs text-slate-500 hover:text-slate-400 transition">
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Association</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Unit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date Observed</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Hearing</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fine</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {(violations ?? []).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    {totalViolations === 0 ? 'No violations found for this portfolio.' : 'No violations match the current filters.'}
                  </td>
                </tr>
              ) : (
                (violations ?? []).map((v: any) => (
                  <tr key={v.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-sm text-slate-300">{associationMap.get(v.association_id) ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 tabular-nums">{unitMap.get(v.unit_id ?? '') ?? '—'}</td>
                    <td className="px-4 py-3">{badge(v.violation_type, TYPE_COLORS, 'bg-slate-400/10 text-slate-400 border-slate-500/20')}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 max-w-[200px] truncate" title={v.title}>{v.title}</td>
                    <td className="px-4 py-3">{badge(v.status, STATUS_COLORS, 'bg-slate-400/10 text-slate-400 border-slate-500/20')}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 tabular-nums">{v.date_observed ? date(v.date_observed) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 tabular-nums">{v.hearing_date ? date(v.hearing_date) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 text-right tabular-nums">
                      {v.fine_amount != null ? money(v.fine_amount / 100) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                      <span className={daysAgo(v.created_at) > 30 ? 'text-red-400' : 'text-slate-400'}>
                        {daysAgo(v.created_at)}d
                      </span>
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
              Showing {from + 1}–{Math.min(to + 1, totalViolations ?? 0)} of {totalViolations}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <a
                  href={`/company-admin/violations?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
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
                  href={`/company-admin/violations?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
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
