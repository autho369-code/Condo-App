import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  Mail,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Shield,
  AlertTriangle,
  Clock,
  Wrench,
  FileWarning,
  Send,
  UserX,
  RotateCcw,
  ArrowRightLeft,
  Eye,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
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

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: 'text-emerald-400 bg-emerald-400/10', label: 'Active' },
    invited: { color: 'text-blue-400 bg-blue-400/10', label: 'Invited' },
    disabled: { color: 'text-slate-400 bg-slate-400/10', label: 'Disabled' },
    suspended: { color: 'text-amber-400 bg-amber-400/10', label: 'Suspended' },
  };
  const s = (status && map[status]) ? map[status] : { color: 'text-slate-400 bg-slate-500/10', label: status ?? 'Unknown' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Invite Form Section                                                       */
/* -------------------------------------------------------------------------- */

function InviteManagerSection() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Invite a Manager</h3>
      </div>
      <form className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              required
              placeholder="manager@company.com"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-slate-300 placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
            <input
              type="text"
              name="full_name"
              required
              placeholder="Jane Smith"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-slate-300 placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone (optional)</label>
            <input
              type="tel"
              name="phone"
              placeholder="+1 (555) 000-0000"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-slate-300 placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <Send className="h-4 w-4" />
            Send Invitation
          </Button>
          <p className="text-xs text-slate-400">An email will be sent with login instructions.</p>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function ManagerOversightPage() {
  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">No company assigned</h2>
          <p className="text-sm text-slate-400 mt-1">Contact the platform operator to set up your company.</p>
        </div>
      </div>
    );
  }

  // Fetch all managers for this portfolio
  const { data: managers, error: mgrError } = await supabase
    .from('profiles')
    .select('id, full_name, email, hoa_role, last_login_at, last_login_ip, mfa_enrolled_at')
    .eq('portfolio_id', portfolioId)
    .eq('hoa_role', 'manager')
    .order('full_name', { ascending: true });

  if (mgrError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">Error loading managers</h2>
          <p className="text-sm text-slate-400 mt-1">{mgrError.message}</p>
        </div>
      </div>
    );
  }

  const managerList = managers ?? [];
  const managerIds = managerList.map(m => m.id);

  // Fetch all active assignments for these managers
  const { data: assignments } = managerIds.length > 0 as any
    ? await (supabase as any)
        .from("association_managers")
        .select('user_id, association_id, assigned_at')
        .in('user_id', managerIds)
        .eq('portfolio_id', portfolioId)
        .is('ended_at', null)
    : { data: [] };

  const mgrAssociations = new Map<string, string[]>();
  (assignments ?? []).forEach((a: any) => {
    const arr = mgrAssociations.get(a.user_id) ?? [];
    arr.push(a.association_id);
    mgrAssociations.set(a.user_id, arr);
  });

  // Get assigned association details for door counts
  const allAssocIds = [...new Set((assignments ?? []).map((a: any) => a.association_id))] as string[];
  const { data: assignedAssociations } = allAssocIds.length > 0
    ? await supabase
        .from('associations')
        .select('id, name, unit_count')
        .in('id', allAssocIds)
        .eq('portfolio_id', portfolioId)
    : { data: [] };

  const assocMap = new Map<string, { name: string; unit_count: number | null }>();
  (assignedAssociations ?? []).forEach((a: any) => {
    assocMap.set(a.id, { name: a.name, unit_count: a.unit_count });
  });

  // Fetch open work orders for assigned associations
  const { data: workOrders } = allAssocIds.length > 0
    ? await supabase
        .from('service_requests')
        .select('association_id, status, created_at')
        .in('association_id', allAssocIds)
        .eq('portfolio_id', portfolioId)
        .in('status', ['open', 'waiting'])
    : { data: [] };

  // Fetch open violations for assigned associations
  const { data: violations } = allAssocIds.length > 0
    ? await supabase
        .from('violations')
        .select('association_id, status')
        .in('association_id', allAssocIds)
        .in('status', ['open', 'notice_sent', 'hearing_pending'])
    : { data: [] };

  // Fetch pending invitations
  const { data: invitations } = await supabase
    .from('user_invitations')
    .select('email, full_name, status, created_at')
    .eq('portfolio_id', portfolioId)
    .eq('hoa_role', 'manager')
    .eq('status', 'pending');

  const pendingInvites = invitations ?? [];

  // Build enriched manager data
  const enriched = managerList.map(m => {
    const assocIds = mgrAssociations.get(m.id) ?? [];
    const assocDetails = assocIds.map(id => assocMap.get(id)).filter(Boolean) as { name: string; unit_count: number | null }[];
    const totalDoors = assocDetails.reduce((sum, a) => sum + (a.unit_count ?? 0), 0);
    const openWOs = (workOrders ?? []).filter(w => assocIds.includes(w.association_id)).length;
    const now = Date.now();
    const overdueWOs = (workOrders ?? []).filter(w => {
      if (!assocIds.includes(w.association_id)) return false;
      const age = now - new Date(w.created_at).getTime();
      return age > 7 * 24 * 60 * 60 * 1000;
    }).length;
    const openViolations = (violations ?? []).filter(v => assocIds.includes(v.association_id)).length;
    const workloadScore = totalDoors > 0 ? Math.round((openWOs + openViolations) / Math.max(totalDoors / 50, 1) * 10) : 0;
    return {
      ...m,
      assocCount: assocIds.length,
      assocDetails,
      totalDoors,
      openWOs,
      overdueWOs,
      openViolations,
      workloadScore: Math.min(workloadScore, 100),
      status: m.last_login_at ? 'active' : 'inactive',
    };
  });

  const totalManagers = enriched.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Manager Oversight</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalManagers} manager{totalManagers !== 1 ? 's' : ''} · {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/company-admin/assignments">
            <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
              <ArrowRightLeft className="h-4 w-4" />
              Reassign
            </Button>
          </Link>
          <a href="#invite-section">
            <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Invite Manager
            </Button>
          </a>
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Pending Invitations</span>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
              {pendingInvites.length}
            </span>
          </div>
          <div className="space-y-2">
            {pendingInvites.map((inv, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-sm text-slate-300">{inv.full_name || inv.email}</span>
                  <span className="text-xs text-slate-400">{inv.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{timeAgo(inv.created_at)}</span>
                  <Button variant="secondary" size="sm" className="text-xs h-7 border-slate-700 text-slate-400 hover:text-white">
                    Resend
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search managers..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] pl-10 pr-4 py-2 text-sm text-slate-300 placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>
        <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
        <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
          <ArrowUpDown className="h-4 w-4" />
          Sort
        </Button>
      </div>

      {/* Manager Table */}
      {enriched.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-16 text-center">
          <Users className="h-10 w-10 text-slate-700 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">No managers found</p>
          <p className="text-xs text-slate-400 mt-1">Invite your first manager to get started.</p>
          <div className="mt-4">
            <Link href="#invite-section">
              <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
                Invite Manager
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Contact</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Associations</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Doors</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Open WOs</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Overdue</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Violations</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Workload</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Last Login</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {enriched.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.01] transition group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-400/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{m.full_name || 'Unnamed'}</p>
                          {m.mfa_enrolled_at && (
                            <span className="text-xs text-emerald-500">MFA enabled</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Mail className="h-3 w-3" />
                          {m.email ?? '—'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-slate-300 tabular-nums">{m.assocCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-slate-300 tabular-nums">{m.totalDoors}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.openWOs > 0 ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.openWOs > 5 ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'
                        }`}>
                          <Wrench className="h-3 w-3" />
                          {m.openWOs}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.overdueWOs > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-red-400 bg-red-400/10">
                          <AlertTriangle className="h-3 w-3" />
                          {m.overdueWOs}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.openViolations > 0 ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.openViolations > 3 ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'
                        }`}>
                          <FileWarning className="h-3 w-3" />
                          {m.openViolations}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="h-1.5 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              m.workloadScore > 70 ? 'bg-red-400' :
                              m.workloadScore > 40 ? 'bg-amber-400' :
                              'bg-emerald-400'
                            }`}
                            style={{ width: `${m.workloadScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 tabular-nums">{m.workloadScore}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{timeAgo(m.last_login_at)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-70 group-hover:opacity-100 transition">
                        <button className="text-xs text-slate-400 hover:text-white transition" title="View Details">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button className="text-xs text-blue-400 hover:text-blue-300 transition" title="Resend Invite">
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <button className="text-xs text-amber-400 hover:text-amber-300 transition" title="Reset Password">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button className="text-xs text-red-400 hover:text-red-300 transition" title="Disable">
                          <UserX className="h-3.5 w-3.5" />
                        </button>
                        <Link href={`/company-admin/assignments?manager=${m.id}`} className="text-xs text-emerald-400 hover:text-emerald-300 transition" title="Reassign">
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manager detail expandable sections — shown as cards below if managers exist */}
      {enriched.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">Manager Details</h3>
          {enriched.map((m) => (
            <details key={m.id} className="group rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-white/[0.01]">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-400/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{m.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-slate-400">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Associations</p>
                    <p className="text-sm font-semibold text-white">{m.assocCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Doors</p>
                    <p className="text-sm font-semibold text-white">{m.totalDoors}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-400">Workload</p>
                    <p className={`text-sm font-semibold ${
                      m.workloadScore > 70 ? 'text-red-400' :
                      m.workloadScore > 40 ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>{m.workloadScore}%</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400 group-open:hidden" />
                  <ChevronUp className="h-4 w-4 text-slate-400 hidden group-open:block" />
                </div>
              </summary>
              <div className="border-t border-white/[0.04] px-5 py-4 space-y-4">
                {/* Assigned Associations */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Assigned Associations</h4>
                  {m.assocDetails.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No associations assigned</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {m.assocDetails.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-white/[0.04] px-3 py-2">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <div className="min-w-0">
                            <p className="text-xs text-slate-300 truncate">{a.name}</p>
                            <p className="text-xs text-slate-400">{a.unit_count ?? '—'} doors</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2">
                    <p className="text-xs text-slate-400">Open Tasks</p>
                    <p className="text-sm font-semibold text-white">{m.openWOs}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2">
                    <p className="text-xs text-slate-400">Overdue Tasks</p>
                    <p className={`text-sm font-semibold ${m.overdueWOs > 0 ? 'text-red-400' : 'text-white'}`}>{m.overdueWOs}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2">
                    <p className="text-xs text-slate-400">Open Violations</p>
                    <p className="text-sm font-semibold text-white">{m.openViolations}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2">
                    <p className="text-xs text-slate-400">Last Active</p>
                    <p className="text-sm font-semibold text-white">{timeAgo(m.last_login_at)}</p>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Invite Manager Section */}
      <div id="invite-section">
        <InviteManagerSection />
      </div>
    </div>
  );
}
