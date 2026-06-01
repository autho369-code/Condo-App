import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Shield,
  AlertTriangle,
  MapPin,
  DoorOpen,
  Wrench,
  FileWarning,
  UserCheck,
  Mail,
  Phone,
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
    inactive: { color: 'text-slate-400 bg-slate-400/10', label: 'Inactive' },
    suspended: { color: 'text-amber-400 bg-amber-400/10', label: 'Suspended' },
    archived: { color: 'text-red-400 bg-red-400/10', label: 'Archived' },
  };
  const s = (status && map[status]) ? map[status] : { color: 'text-slate-400 bg-slate-500/10', label: status ?? 'Unknown' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function HealthBadge({ score }: { score: number }) {
  let color = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  let label = 'Good';
  if (score >= 3) { color = 'text-amber-400 bg-amber-400/10 border-amber-400/20'; label = 'Fair'; }
  if (score >= 6) { color = 'text-orange-400 bg-orange-400/10 border-orange-400/20'; label = 'Poor'; }
  if (score >= 9) { color = 'text-red-400 bg-red-400/10 border-red-400/20'; label = 'Critical'; }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function AssociationsPortfolioPage() {
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

  // Fetch all associations for this portfolio
  const { data: associations, error: assocError } = await supabase
    .from('associations')
    .select('id, name, address, city, state, zip, unit_count, status, created_at, archived_at')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (assocError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white">Error loading associations</h2>
          <p className="text-sm text-slate-400 mt-1">{assocError.message}</p>
        </div>
      </div>
    );
  }

  const associationList = associations ?? [];

  // Fetch assignments for all associations at once
  const assocIds = associationList.map((a: any) => a.id);
  const { data: assignments } = assocIds.length > 0 as any
    ? await (supabase as any)
        .from("association_managers")
        .select('association_id, user_id, assigned_at')
        .in('association_id', assocIds)
        .eq('portfolio_id', portfolioId)
        .is('ended_at', null)
    : { data: [] };

  const assignmentMap = new Map<string, { user_id: string; assigned_at: string }>();
  (assignments ?? []).forEach((a: any) => {
    assignmentMap.set(a.association_id, { user_id: a.user_id, assigned_at: a.assigned_at });
  });

  // Fetch manager profiles for all assigned managers
  const managerIds = [...new Set((assignments ?? []).map((a: any) => a.user_id).filter(Boolean))] as string[];
  const { data: managerProfiles } = managerIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email, last_login_at')
        .in('id', managerIds)
        .eq('portfolio_id', portfolioId)
    : { data: [] };

  const managerMap = new Map<string, { full_name: string | null; email: string | null; last_login_at: string | null }>();
  (managerProfiles ?? []).forEach(m => {
    managerMap.set(m.id, { full_name: m.full_name, email: m.email, last_login_at: m.last_login_at });
  });

  // Fetch board contacts for all associations
  const { data: boardMembers } = assocIds.length > 0
    ? await supabase
        .from('board_members')
        .select('association_id, full_name, email, phone, role, active')
        .in('association_id', assocIds)
        .eq('active', true)
    : { data: [] };

  const boardMap = new Map<string, { full_name: string; email: string | null; phone: string | null; role: string | null }[]>();
  (boardMembers ?? []).forEach(bm => {
    const arr = boardMap.get(bm.association_id) ?? [];
    arr.push({ full_name: bm.full_name, email: bm.email, phone: bm.phone, role: bm.role });
    boardMap.set(bm.association_id, arr);
  });

  // Fetch open work orders counts per association
  const { data: workOrders } = assocIds.length > 0
    ? await supabase
        .from('service_requests')
        .select('association_id, status')
        .in('association_id', assocIds)
        .eq('portfolio_id', portfolioId)
        .in('status', ['open', 'waiting'])
    : { data: [] };

  const woMap = new Map<string, number>();
  (workOrders ?? []).forEach(wo => {
    woMap.set(wo.association_id, (woMap.get(wo.association_id) ?? 0) + 1);
  });

  // Fetch open violations counts per association
  const { data: violations } = assocIds.length > 0
    ? await supabase
        .from('violations')
        .select('association_id, status')
        .in('association_id', assocIds)
        .in('status', ['open', 'notice_sent', 'hearing_pending'])
    : { data: [] };

  const vMap = new Map<string, number>();
  (violations ?? []).forEach(v => {
    vMap.set(v.association_id, (vMap.get(v.association_id) ?? 0) + 1);
  });

  // Compute enriched association data with health score
  const enriched = associationList.map((a: any) => {
    const assign = assignmentMap.get(a.id);
    const manager = assign ? managerMap.get(assign.user_id) : null;
    const board = boardMap.get(a.id) ?? [];
    const openWOs = woMap.get(a.id) ?? 0;
    const openViolations = vMap.get(a.id) ?? 0;
    const healthScore = openWOs + openViolations;
    return { ...a, manager, board, openWOs, openViolations, healthScore, assignedAt: assign?.assigned_at ?? null };
  });

  const totalAssociations = enriched.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Associations Portfolio</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalAssociations} association{totalAssociations !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/company-admin/assignments">
            <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
              <UserCheck className="h-4 w-4" />
              Assign Managers
            </Button>
          </Link>
          <Link href="/company-admin/associations">
            <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Add Association
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
            placeholder="Search associations..."
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

      {/* Table */}
      {enriched.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-16 text-center">
          <Building2 className="h-10 w-10 text-slate-700 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">No associations found</p>
          <p className="text-xs text-slate-400 mt-1">Add your first association to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">City/State</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Doors</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Manager</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Board Contact</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Open WOs</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Violations</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Health</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Last Activity</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {enriched.map((a: any) => (
                  <tr key={a.id} className="hover:bg-white/[0.01] transition">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{a.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.address}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-slate-300">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        {a.city}, {a.state}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-slate-300">
                        <DoorOpen className="h-3.5 w-3.5 text-slate-400" />
                        {a.unit_count ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.manager ? (
                        <div>
                          <p className="text-sm text-slate-300">{a.manager.full_name ?? 'Unnamed'}</p>
                          {a.manager.email && (
                            <p className="text-xs text-slate-400 truncate max-w-[160px]">{a.manager.email}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.board.length > 0 ? (
                        <div>
                          <p className="text-sm text-slate-300">{a.board[0].full_name}</p>
                          {(a.board[0].email || a.board[0].phone) && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {a.board[0].email && <Mail className="h-3 w-3 text-slate-400" />}
                              {a.board[0].phone && <Phone className="h-3 w-3 text-slate-400" />}
                              <span className="text-xs text-slate-400">{a.board[0].email || a.board[0].phone}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No board</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.openWOs > 0 ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.openWOs > 5 ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'
                        }`}>
                          <Wrench className="h-3 w-3" />
                          {a.openWOs}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.openViolations > 0 ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.openViolations > 3 ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10'
                        }`}>
                          <FileWarning className="h-3 w-3" />
                          {a.openViolations}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <HealthBadge score={a.healthScore} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400">
                        {a.manager?.last_login_at ? timeAgo(a.manager.last_login_at) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/company-admin/associations/${a.id}`}
                          className="text-xs text-slate-400 hover:text-white transition"
                        >
                          View
                        </Link>
                        <Link
                          href={`/company-admin/associations/${a.id}/edit`}
                          className="text-xs text-slate-400 hover:text-white transition"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/company-admin/assignments?association=${a.id}`}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition"
                        >
                          Assign
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

      {/* Summary footer */}
      {enriched.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total</p>
              <p className="text-lg font-bold text-white">{totalAssociations}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total Doors</p>
              <p className="text-lg font-bold text-white">
                {enriched.reduce((sum, a) => sum + (a.unit_count ?? 0), 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Assigned</p>
              <p className="text-lg font-bold text-white">
                {enriched.filter((a: any) => !!a.manager).length} / {totalAssociations}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Open Issues</p>
              <p className="text-lg font-bold text-white">
                {enriched.reduce((sum, a) => sum + a.healthScore, 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
