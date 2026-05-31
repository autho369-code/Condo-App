import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  UserCheck,
  MessageSquare,
  ArrowRight,
  Building2,
  DoorOpen,
  Search,
  Filter,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function daysAgo(ts: string | null): number {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { color: string; label: string }> = {
    pending: { color: 'text-amber-400 bg-amber-400/10 border-amber-500/20', label: 'Pending' },
    approved: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20', label: 'Approved' },
    denied: { color: 'text-red-400 bg-red-400/10 border-red-500/20', label: 'Denied' },
    under_review: { color: 'text-blue-400 bg-blue-400/10 border-blue-500/20', label: 'Under Review' },
    missing_docs: { color: 'text-orange-400 bg-orange-400/10 border-orange-500/20', label: 'Missing Docs' },
    board_review: { color: 'text-purple-400 bg-purple-400/10 border-purple-500/20', label: 'Board Review' },
  };
  const s = map[status ?? ''] ?? { color: 'text-slate-400 bg-slate-400/10 border-slate-500/20', label: status ?? '—' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
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

export default async function ArchitecturalReviewsPage() {
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

  // Fetch associations for this portfolio (needed for join display)
  const { data: associations } = await supabase
    .from('associations')
    .select('id, name')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name');

  const associationMap = new Map((associations ?? []).map((a) => [a.id, a.name]));

  // Try to fetch architectural requests — table may not exist
  let architecturalRequests: any[] = [];
  let tableExists = true;
  let totalCount = 0;

  try {
    const result = await (supabase as any)
      .from('architectural_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(50);

    if (result.error) {
      // Check if the error indicates a missing table
      if (
        result.error.code === '42P01' ||
        result.error.code === 'PGRST205' ||
        result.error.message?.includes('does not exist') ||
        result.error.message?.includes('relation') ||
        result.error.code === '42703'
      ) {
        tableExists = false;
      } else {
        // Some other error — still try to handle gracefully
        tableExists = false;
      }
    } else {
      architecturalRequests = result.data ?? [];
      totalCount = result.count ?? 0;
    }
  } catch {
    tableExists = false;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Architectural Reviews</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage and track architectural modification requests across your portfolio
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!tableExists && (
            <Link href="/company-admin/platform-requests">
              <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                <MessageSquare className="h-4 w-4" />
                Request Enablement
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Not Yet Configured Empty State */}
      {!tableExists && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">Module Not Yet Configured</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
            The architectural reviews module is not yet configured for your account.
            Contact the Platform Operator to enable this feature.
          </p>
          <div className="mt-6">
            <Link href="/company-admin/platform-requests">
              <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                <MessageSquare className="h-4 w-4" />
                Request via Platform Requests
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Data loaded */}
      {tableExists && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Pending Applications"
              value={architecturalRequests.filter((r: any) => r.status === 'pending').length}
              icon={Clock}
              accent="amber"
            />
            <StatCard
              label="Approved"
              value={architecturalRequests.filter((r: any) => r.status === 'approved').length}
              icon={CheckCircle2}
              accent="emerald"
            />
            <StatCard
              label="Denied"
              value={architecturalRequests.filter((r: any) => r.status === 'denied').length}
              icon={XCircle}
              accent="red"
            />
            <StatCard
              label="Missing Documents"
              value={architecturalRequests.filter((r: any) => r.status === 'missing_docs').length}
              icon={AlertTriangle}
              accent="amber"
            />
            <StatCard
              label="Board Review Required"
              value={architecturalRequests.filter((r: any) => r.status === 'board_review' || r.status === 'under_review').length}
              icon={UserCheck}
              accent="purple"
            />
          </div>

          {/* Table */}
          {architecturalRequests.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-16 text-center">
              <FileText className="h-10 w-10 text-slate-700 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-400">No architectural requests found</p>
              <p className="text-xs text-slate-600 mt-1">Requests will appear here once submitted by residents.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/[0.02]">
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Association</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Unit</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Request Title</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Manager Assigned</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Days Pending</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {architecturalRequests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-white/[0.01] transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span className="text-sm text-slate-300">{associationMap.get(req.association_id) ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <span className="text-sm text-slate-300">{req.unit_number ?? req.unit_id ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-300 max-w-[220px] truncate" title={req.title}>
                            {req.title ?? 'Untitled'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-400">{req.manager_name ?? req.assigned_to ?? 'Unassigned'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm tabular-nums ${daysAgo(req.created_at) > 14 ? 'text-red-400' : daysAgo(req.created_at) > 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {daysAgo(req.created_at)}d
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/company-admin/architectural/${req.id}`}
                            className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Total count footer */}
          {totalCount > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="text-slate-400">Total Requests:</span>
                <span className="font-semibold text-white tabular-nums">{totalCount}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
