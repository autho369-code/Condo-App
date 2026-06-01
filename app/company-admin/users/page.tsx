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
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  UserX,
  UserPlus,
  Send,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Eye,
  Pencil,
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

function RoleBadge({ role }: { role: string | null }) {
  const map: Record<string, { color: string; label: string }> = {
    manager: { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'Manager' },
    accountant: { color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', label: 'Accountant' },
    property_manager: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'Property Mgr' },
    assistant_manager: { color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', label: 'Asst. Manager' },
    company_admin: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'Company Admin' },
  };
  const s = (role && map[role]) ? map[role] : { color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', label: role ?? 'Unknown' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${s.color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: 'text-emerald-400 bg-emerald-400/10', label: 'Active' },
    invited: { color: 'text-blue-400 bg-blue-400/10', label: 'Invited' },
    pending: { color: 'text-amber-400 bg-amber-400/10', label: 'Pending' },
    disabled: { color: 'text-slate-400 bg-slate-400/10', label: 'Disabled' },
    revoked: { color: 'text-red-400 bg-red-400/10', label: 'Revoked' },
    expired: { color: 'text-red-400 bg-red-400/10', label: 'Expired' },
  };
  const s = (status && map[status]) ? map[status] : { color: 'text-slate-400 bg-slate-500/10', label: status ?? 'Unknown' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function MfaBadge({ enrolled }: { enrolled: boolean }) {
  if (enrolled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-emerald-400 bg-emerald-400/10">
        <ShieldCheck className="h-3 w-3" />
        MFA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-red-400 bg-red-400/10">
      <ShieldOff className="h-3 w-3" />
      Off
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function CompanyUsersPage() {
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

  // Fetch all staff profiles for this portfolio with relevant roles
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, full_name, email, hoa_role, last_login_at, last_login_ip, mfa_enrolled_at')
    .eq('portfolio_id', portfolioId)
    .in('hoa_role', ['manager'])
    .order('full_name', { ascending: true });

  if (userError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">Error loading users</h2>
          <p className="text-sm text-slate-400 mt-1">{userError.message}</p>
        </div>
      </div>
    );
  }

  const userList = users ?? [];
  const userIds = userList.map(u => u.id);

  // Fetch assignments for these users
  const { data: assignments } = (userIds as string[]).length > 0
    ? await db
        .from("association_managers")
        .select('user_id, association_id')
        .in('user_id', userIds)
        .eq('portfolio_id', portfolioId)
        .is('ended_at', null)
    : { data: [] };

  const userAssocMap = new Map<string, string[]>();
  ((assignments as any[]) ?? []).forEach((a: any) => {
    const arr = userAssocMap.get(a.user_id) ?? [];
    arr.push(a.association_id);
    userAssocMap.set(a.user_id, arr);
  });

  // Get association names
  const allAssocIds = [...new Set((assignments ?? []).map((a: any) => a.association_id))] as string[];
  const { data: assocData } = allAssocIds.length > 0
    ? await supabase
        .from('associations')
        .select('id, name')
        .in('id', allAssocIds)
        .eq('portfolio_id', portfolioId)
    : { data: [] };

  const assocNameMap = new Map<string, string>();
  (assocData ?? []).forEach((a: any) => {
    assocNameMap.set(a.id, a.name);
  });

  // Fetch user invitations for these emails
  const userEmails = userList.map(u => u.email).filter(Boolean) as string[];
  const { data: invitations } = userEmails.length > 0
    ? await supabase
        .from('user_invitations')
        .select('email, status, created_at')
        .in('email', userEmails)
        .eq('portfolio_id', portfolioId)
        .order('created_at', { ascending: false })
    : { data: [] };

  const inviteMap = new Map<string, { status: string; created_at: string }>();
  (invitations ?? []).forEach(inv => {
    if (!inviteMap.has(inv.email)) {
      inviteMap.set(inv.email, { status: inv.status, created_at: inv.created_at });
    }
  });

  // Enrich users
  const enriched = userList.map(u => {
    const assignedIds = userAssocMap.get(u.id) ?? [];
    const assocNames = assignedIds.map(id => assocNameMap.get(id)).filter(Boolean) as string[];
    const invite = u.email ? inviteMap.get(u.email) : null;
    const inviteStatus = invite?.status ?? (u.last_login_at ? 'active' : null);
    const status = invite?.status === 'pending' ? 'invited'
      : invite?.status === 'revoked' ? 'disabled'
      : invite?.status === 'expired' ? 'expired'
      : (u.last_login_at ? 'active' : 'inactive');
    return {
      ...u,
      assignedAssociations: assocNames,
      assignedCount: assocNames.length,
      inviteStatus,
      status,
      mfaEnabled: !!u.mfa_enrolled_at,
    };
  });

  const totalUsers = enriched.length;
  const activeUsers = enriched.filter(u => u.status === 'active').length;
  const pendingInvites = enriched.filter(u => u.inviteStatus === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Users & Access Control</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalUsers} user{totalUsers !== 1 ? 's' : ''} · {activeUsers} active · {pendingInvites} pending invite{pendingInvites !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/company-admin/managers">
            <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
              <Users className="h-4 w-4" />
              Manager Oversight
            </Button>
          </Link>
          <Link href="/company-admin/managers#invite-section">
            <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Invite User
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] pl-10 pr-4 py-2 text-sm text-slate-300 placeholder:text-slate-400 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>
        <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
          <Filter className="h-4 w-4" />
          Role
        </Button>
        <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
          <Filter className="h-4 w-4" />
          Status
        </Button>
        <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
          <Filter className="h-4 w-4" />
          Association
        </Button>
        <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
          <ArrowUpDown className="h-4 w-4" />
          Sort
        </Button>
      </div>

      {/* Users Table */}
      {enriched.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-16 text-center">
          <Users className="h-10 w-10 text-slate-700 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">No users found</p>
          <p className="text-xs text-slate-400 mt-1">Invite staff members to get started.</p>
          <div className="mt-4">
            <Link href="/company-admin/managers#invite-section">
              <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                <UserPlus className="h-4 w-4" />
                Invite User
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
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Email</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned To</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Invite</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Last Login</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">MFA</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {enriched.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.01] transition group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center bg-blue-400/10`}>
                          <Users className="h-4 w-4 text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-white">{u.full_name || 'Unnamed'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-slate-400">
                        <Mail className="h-3 w-3 text-slate-400" />
                        {u.email ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RoleBadge role={u.hoa_role} />
                    </td>
                    <td className="px-4 py-3">
                      {u.assignedCount > 0 ? (
                        <div>
                          <span className="text-sm text-slate-300">{u.assignedAssociations[0]}</span>
                          {u.assignedCount > 1 && (
                            <span className="text-xs text-slate-400 ml-1">
                              +{u.assignedCount - 1} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.inviteStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-amber-400 bg-amber-400/10">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      ) : u.inviteStatus === 'accepted' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-emerald-400 bg-emerald-400/10">
                          <CheckCircle2 className="h-3 w-3" />
                          Accepted
                        </span>
                      ) : u.inviteStatus === 'revoked' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-red-400 bg-red-400/10">
                          <XCircle className="h-3 w-3" />
                          Revoked
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{timeAgo(u.last_login_at)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <MfaBadge enrolled={u.mfaEnabled} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-70 group-hover:opacity-100 transition">
                        {/* View */}
                        <button className="text-xs text-slate-400 hover:text-white transition" title="View Profile">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {/* Resend Invite */}
                        {u.inviteStatus === 'pending' && (
                          <button className="text-xs text-blue-400 hover:text-blue-300 transition" title="Resend Invite">
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Reset Password */}
                        <button className="text-xs text-amber-400 hover:text-amber-300 transition" title="Reset Password">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        {/* Change Role */}
                        <button className="text-xs text-purple-400 hover:text-purple-300 transition" title="Change Role">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {/* Disable/Enable */}
                        {u.status === 'disabled' ? (
                          <button className="text-xs text-emerald-400 hover:text-emerald-300 transition" title="Enable">
                            <UserCheck className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button className="text-xs text-red-400 hover:text-red-300 transition" title="Disable">
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Reassign */}
                        <Link
                          href={`/company-admin/assignments?manager=${u.id}`}
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                          title="Change Assignment"
                        >
                          <Building2 className="h-3.5 w-3.5" />
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

      {/* Summary Cards */}
      {enriched.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total Users</p>
            <p className="text-xl font-bold text-white mt-1">{totalUsers}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Active Users</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{activeUsers}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Pending Invites</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{pendingInvites}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">MFA Enrolled</p>
            <p className="text-xl font-bold text-white mt-1">
              {enriched.filter(u => u.mfaEnabled).length} / {totalUsers}
            </p>
          </div>
        </div>
      )}

      {/* Role Distribution */}
      {enriched.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Role Distribution</h3>
          <div className="flex flex-wrap gap-3">
            {['manager', 'accountant', 'property_manager'].map(role => {
              const count = enriched.filter(u => u.hoa_role === role).length;
              if (count === 0) return null;
              return (
                <div key={role} className="flex items-center gap-2 rounded-lg border border-white/[0.04] px-3 py-2">
                  <RoleBadge role={role} />
                  <span className="text-sm font-semibold text-white tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
