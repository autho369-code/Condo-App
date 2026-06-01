import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Users,
  Shield,
  XCircle,
  CheckCircle2,
  DoorOpen,
  Wrench,
  FileWarning,
  ArrowRightLeft,
  Link2,
  Link2Off,
  ChevronRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function WorkloadBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct > 70 ? 'bg-red-400' : pct > 40 ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function HealthDot({ score }: { score: number }) {
  let color = 'bg-emerald-400';
  if (score >= 3) color = 'bg-amber-400';
  if (score >= 6) color = 'bg-red-400';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function AssignmentEnginePage() {
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

  // Fetch all associations
  const { data: associations } = await supabase
    .from('associations')
    .select('id, name, city, state, unit_count, status')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name', { ascending: true });

  const assocList = associations ?? [];
  const assocIds = assocList.map((a: any) => a.id);

  // Fetch all active assignments
  const { data: assignments } = await (supabase as any)
    .from("association_managers")
    .select('id, association_id, user_id, assigned_at')
    .eq('portfolio_id', portfolioId)
    .is('ended_at', null);

  const assignmentList = assignments ?? [];

  // Build assignment map
  const assignMap = new Map<string, { id: string; user_id: string; assigned_at: string }>();
  assignmentList.forEach((a: any) => {
    assignMap.set(a.association_id, { id: a.id, user_id: a.user_id, assigned_at: a.assigned_at });
  });

  const assignedAssocIds = new Set(assignmentList.map((a: any) => a.association_id));
  const unassignedAssociations = assocList.filter((a: any) => !assignedAssocIds.has(a.id));

  // Fetch open WOs and violations per association for health scores
  const { data: workOrders } = assocIds.length > 0
    ? await supabase
        .from('service_requests')
        .select('association_id, status')
        .in('association_id', assocIds)
        .eq('portfolio_id', portfolioId)
        .in('status', ['open', 'waiting'])
    : { data: [] };

  const { data: violations } = assocIds.length > 0
    ? await supabase
        .from('violations')
        .select('association_id, status')
        .in('association_id', assocIds)
        .in('status', ['open', 'notice_sent', 'hearing_pending'])
    : { data: [] };

  const woCountMap = new Map<string, number>();
  (workOrders ?? []).forEach(w => {
    woCountMap.set(w.association_id, (woCountMap.get(w.association_id) ?? 0) + 1);
  });
  const vCountMap = new Map<string, number>();
  (violations ?? []).forEach(v => {
    vCountMap.set(v.association_id, (vCountMap.get(v.association_id) ?? 0) + 1);
  });

  // Fetch all managers
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, full_name, email, last_login_at')
    .eq('portfolio_id', portfolioId)
    .eq('hoa_role', 'manager')
    .order('full_name', { ascending: true });

  const managerList = managers ?? [];
  const managerIds = managerList.map(m => m.id);

  // Build manager assignment counts
  const mgrAssocMap = new Map<string, string[]>();
  assignmentList.forEach((a: any) => {
    const arr = mgrAssocMap.get(a.user_id) ?? [];
    arr.push(a.association_id);
    mgrAssocMap.set(a.user_id, arr);
  });

  // Assign score for workload
  const MAX_DOORS_PER_MANAGER = 500;

  const enrichedManagers = managerList.map(m => {
    const assignedIds = mgrAssocMap.get(m.id) ?? [];
    const totalDoors = assignedIds.reduce((sum, aid) => {
      const a = assocList.find(x => x.id === aid);
      return sum + (a?.unit_count ?? 0);
    }, 0);
    const openIssues = assignedIds.reduce((sum, aid) => {
      return sum + (woCountMap.get(aid) ?? 0) + (vCountMap.get(aid) ?? 0);
    }, 0);
    const workloadPct = Math.min(Math.round((totalDoors / MAX_DOORS_PER_MANAGER) * 100), 100);
    return {
      ...m,
      assocCount: assignedIds.length,
      totalDoors,
      openIssues,
      workloadPct,
    };
  });

  // Build current assignments with full details
  const currentAssignments = assignmentList.map((a: any) => {
    const assoc = assocList.find(x => x.id === a.association_id);
    const mgr = managerList.find(m => m.id === a.user_id);
    const openWOs = woCountMap.get(a.association_id) ?? 0;
    const openViolations = vCountMap.get(a.association_id) ?? 0;
    return {
      ...a,
      associationName: assoc?.name ?? 'Unknown',
      associationCity: assoc?.city ?? '',
      unitCount: assoc?.unit_count ?? 0,
      managerName: mgr?.full_name ?? 'Unknown',
      managerEmail: mgr?.email ?? '',
      openWOs,
      openViolations,
      healthScore: openWOs + openViolations,
    };
  });

  // Enrich unassigned associations with health data
  const enrichedUnassigned = unassignedAssociations.map((a: any) => ({
    ...a,
    openWOs: woCountMap.get(a.id) ?? 0,
    openViolations: vCountMap.get(a.id) ?? 0,
    healthScore: (woCountMap.get(a.id) ?? 0) + (vCountMap.get(a.id) ?? 0),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Association Assignment Engine</h1>
          <p className="mt-1 text-sm text-slate-400">
            {assocList.length} association{assocList.length !== 1 ? 's' : ''} · {managerList.length} manager{managerList.length !== 1 ? 's' : ''} · {currentAssignments.length} assigned
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/company-admin/managers">
            <Button variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
              <Users className="h-4 w-4" />
              Manage Managers
            </Button>
          </Link>
        </div>
      </div>

      {/* Assignment Form */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">Assign Association to Manager</h3>
        </div>
        <form action="/api/company-admin/assignments/assign" method="POST" className="flex items-end gap-3 flex-wrap">
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Association</label>
            <select
              name="association_id"
              required
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            >
              <option value="">Select association...</option>
              {enrichedUnassigned.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.city}, {a.state} ({a.unit_count ?? 0} doors)
                </option>
              ))}
              {currentAssignments.map((ca: any) => (
                <option key={ca.association_id} value={ca.association_id}>
                  {ca.associationName} — {ca.associationCity} ({ca.unitCount} doors) — [Currently: {ca.managerName}]
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Manager</label>
            <select
              name="manager_id"
              required
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-300 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            >
              <option value="">Select manager...</option>
              {enrichedManagers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email} — {m.assocCount} assoc, {m.totalDoors} doors
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <Link2 className="h-4 w-4" />
            Assign
          </Button>
        </form>
        <div className="flex items-center gap-2 mt-3">
          <form action="/api/company-admin/assignments/transfer" method="POST" className="contents">
            <input type="hidden" name="action" value="transfer" />
            <Button type="submit" variant="secondary" size="sm" className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
              <ArrowRightLeft className="h-4 w-4" />
              Transfer
            </Button>
          </form>
          <form action="/api/company-admin/assignments/remove" method="POST" className="contents">
            <input type="hidden" name="action" value="remove" />
            <Button type="submit" variant="secondary" size="sm" className="gap-2 border-slate-700 text-red-400 hover:bg-red-500/20">
              <Link2Off className="h-4 w-4" />
              Remove
            </Button>
          </form>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Unassigned Associations */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-3">
            <Building2 className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Unassigned
            </h3>
            <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
              {enrichedUnassigned.length}
            </span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {enrichedUnassigned.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs text-slate-400">All associations are assigned</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {enrichedUnassigned.map((a: any) => (
                  <div key={a.id} className="px-4 py-3 hover:bg-white/[0.01] transition">
                    <div className="flex items-start gap-2">
                      <HealthDot score={a.healthScore} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.city}, {a.state}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <DoorOpen className="h-3 w-3" />
                            {a.unit_count ?? 0}
                          </span>
                          {a.openWOs > 0 && (
                            <span className="flex items-center gap-1 text-amber-400">
                              <Wrench className="h-3 w-3" />
                              {a.openWOs}
                            </span>
                          )}
                          {a.openViolations > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                              <FileWarning className="h-3 w-3" />
                              {a.openViolations}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Managers */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-3">
            <Users className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Managers
            </h3>
            <span className="ml-auto rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
              {managerList.length}
            </span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {enrichedManagers.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Users className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No managers found</p>
                <Link href="/company-admin/managers" className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 inline-block">
                  Invite a manager →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {enrichedManagers.map(m => (
                  <div key={m.id} className="px-4 py-3 hover:bg-white/[0.01] transition">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{m.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400 truncate">{m.email}</p>
                      </div>
                      <span className="text-xs text-slate-400">{m.last_login_at ? 'active' : 'inactive'}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Building2 className="h-3 w-3" />
                        {m.assocCount} assoc
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <DoorOpen className="h-3 w-3" />
                        {m.totalDoors} doors
                      </span>
                    </div>
                    <div className="mt-2">
                      <WorkloadBar pct={m.workloadPct} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Current Assignments */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-3">
            <Link2 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Assignments
            </h3>
            <span className="ml-auto rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
              {currentAssignments.length}
            </span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {currentAssignments.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Link2 className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No assignments yet</p>
                <p className="text-xs text-slate-400 mt-1">Select an association and manager above</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {currentAssignments.map((ca: any) => (
                  <div key={ca.id} className="px-4 py-3 hover:bg-white/[0.01] transition group">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <p className="text-sm font-medium text-white truncate">{ca.associationName}</p>
                        </div>
                        <p className="text-xs text-slate-400 ml-5">{ca.associationCity}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button className="p-1 text-slate-400 hover:text-red-400 transition" title="Remove">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-5 mt-1">
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                      <Users className="h-3 w-3 text-slate-400" />
                      <span className="text-xs text-slate-400 truncate">{ca.managerName}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-5 mt-1.5 text-xs text-slate-400">
                      <span>{ca.unitCount} doors</span>
                      {ca.openWOs > 0 && (
                        <span className="text-amber-400">{ca.openWOs} open</span>
                      )}
                      {ca.openViolations > 0 && (
                        <span className="text-red-400">{ca.openViolations} violations</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total Associations</p>
            <p className="text-lg font-bold text-white">{assocList.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total Managers</p>
            <p className="text-lg font-bold text-white">{managerList.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Assigned</p>
            <p className="text-lg font-bold text-emerald-400">{currentAssignments.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Unassigned</p>
            <p className={`text-lg font-bold ${enrichedUnassigned.length > 0 ? 'text-amber-400' : 'text-white'}`}>
              {enrichedUnassigned.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total Doors</p>
            <p className="text-lg font-bold text-white">
              {assocList.reduce((sum, a) => sum + (a.unit_count ?? 0), 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Avg Doors/Manager</p>
            <p className="text-lg font-bold text-white">
              {managerList.length > 0
                ? Math.round(assocList.reduce((sum, a) => sum + (a.unit_count ?? 0), 0) / managerList.length)
                : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
