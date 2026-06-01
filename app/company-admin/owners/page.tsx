import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import {
  Users,
  UserCheck,
  Clock,
  Shield,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Building2,
  Eye,
  Edit3,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
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

function PortalBadge({ activated }: { activated: boolean }) {
  return activated ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Activated
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/30 bg-slate-400/10 px-2 py-0.5 text-xs font-medium text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      Pending
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
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
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

export default async function OwnersPage() {
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

  // Fetch all owners for this portfolio
  const { data: owners } = await supabase
    .from('owners')
    .select('id, full_name, email, phone, mailing_address, portal_activated, portal_login_last_at, created_at')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('full_name', { ascending: true });

  const ownerList = owners ?? [];

  // For each owner, get their associations through unit_owners -> units -> buildings -> associations
  const ownerIds = ownerList.map((o) => o.id);

  // Fetch unit_owners for these owners
  const { data: unitOwners } = ownerIds.length > 0
    ? await supabase
        .from('unit_owners')
        .select('owner_id, unit_id')
        .in('owner_id', ownerIds)
        .is('end_date', null)
    : { data: [] };

  // Build owner -> unit mappings
  const ownerUnitMap = new Map<string, string[]>();
  (unitOwners ?? []).forEach((uo) => {
    const arr = ownerUnitMap.get(uo.owner_id) ?? [];
    arr.push(uo.unit_id);
    ownerUnitMap.set(uo.owner_id, arr);
  });

  // Fetch units for all unit_ids
  const allUnitIds = [...new Set((unitOwners ?? []).map((uo) => uo.unit_id))];
  const { data: units } = allUnitIds.length > 0
    ? await supabase
        .from('units')
        .select('id, building_id')
        .in('id', allUnitIds)
    : { data: [] };

  const unitBuildingMap = new Map<string, string>();
  (units ?? []).forEach((u) => unitBuildingMap.set(u.id, u.building_id));

  // Fetch buildings
  const allBuildingIds = [...new Set((units ?? []).map((u) => u.building_id))];
  const { data: buildings } = allBuildingIds.length > 0
    ? await supabase
        .from('buildings')
        .select('id, association_id')
        .in('id', allBuildingIds)
    : { data: [] };

  const buildingAssocMap = new Map<string, string>();
  (buildings ?? []).forEach((b) => buildingAssocMap.set(b.id, b.association_id));

  // Fetch associations for these associations
  const allAssocIds = [...new Set((buildings ?? []).map((b) => b.association_id))];
  const { data: associations } = allAssocIds.length > 0
    ? await supabase
        .from('associations')
        .select('id, name')
        .in('id', allAssocIds)
        .eq('portfolio_id', portfolioId)
        .is('archived_at', null)
    : { data: [] };

  const assocNameMap = new Map<string, string>();
  (associations ?? []).forEach((a) => assocNameMap.set(a.id, a.name));

  // Build owner -> association names
  const ownerAssociationsMap = new Map<string, string[]>();
  ownerList.forEach((owner) => {
    const unitIds = ownerUnitMap.get(owner.id) ?? [];
    const assocNames = new Set<string>();
    unitIds.forEach((uid) => {
      const buildingId = unitBuildingMap.get(uid);
      if (buildingId) {
        const assocId = buildingAssocMap.get(buildingId);
        if (assocId) {
          const name = assocNameMap.get(assocId);
          if (name) assocNames.add(name);
        }
      }
    });
    ownerAssociationsMap.set(owner.id, [...assocNames]);
  });

  // Compute stats
  const totalOwners = ownerList.length;
  const portalActivated = ownerList.filter((o) => o.portal_activated).length;
  const pendingActivation = totalOwners - portalActivated;
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const activeThisMonth = ownerList.filter((o) => o.portal_login_last_at && o.portal_login_last_at >= monthAgo).length;

  // Get unique associations for filter dropdown
  const uniqueAssociations = [...new Set([...assocNameMap.values()])].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Owners Directory</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalOwners} owner{totalOwners !== 1 ? 's' : ''} across your portfolio
          </p>
        </div>
        <Link href="/company-admin/owners">
          <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <UserCheck className="h-4 w-4" />
            Add Owner
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Owners"
          value={totalOwners}
          icon={Users}
          accent="emerald"
        />
        <StatCard
          label="Portal Activated"
          value={portalActivated}
          sub={totalOwners > 0 ? `${Math.round((portalActivated / totalOwners) * 100)}%` : undefined}
          icon={UserCheck}
          accent="blue"
        />
        <StatCard
          label="Pending Activation"
          value={pendingActivation}
          sub="not yet activated"
          icon={Clock}
          accent={pendingActivation > 0 ? 'amber' : 'slate'}
        />
        <StatCard
          label="Active This Month"
          value={activeThisMonth}
          sub="logged in"
          icon={Users}
          accent="purple"
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <form className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Filters</span>
          </div>
          <select
            name="association"
            defaultValue=""
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">All Associations</option>
            {uniqueAssociations.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            name="portal_status"
            defaultValue=""
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">All Portal Status</option>
            <option value="activated">Activated</option>
            <option value="pending">Pending</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              name="search"
              placeholder="Search by name..."
              className="rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500/50 w-48"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            <Search className="h-3.5 w-3.5" />
            Apply
          </button>
        </form>
      </div>

      {/* Table */}
      {ownerList.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-16 text-center">
          <Users className="h-10 w-10 text-slate-700 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">No owners found</p>
          <p className="text-xs text-slate-400 mt-1">Owners will appear here once added to your portfolio.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Association(s)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Portal Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Last Login</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {ownerList.map((owner) => {
                  const assocNames = ownerAssociationsMap.get(owner.id) ?? [];
                  return (
                    <tr key={owner.id} className="hover:bg-white/[0.01] transition">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{owner.full_name}</p>
                          {owner.mailing_address && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <p className="text-xs text-slate-400 truncate max-w-[180px]">{owner.mailing_address}</p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-300">{owner.email ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-300">{owner.phone ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {assocNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assocNames.slice(0, 2).map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-xs text-slate-300"
                              >
                                <Building2 className="h-2.5 w-2.5" />
                                {name}
                              </span>
                            ))}
                            {assocNames.length > 2 && (
                              <span className="text-xs text-slate-400">+{assocNames.length - 2} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PortalBadge activated={owner.portal_activated} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400">{timeAgo(owner.portal_login_last_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/company-admin/owners/${owner.id}`}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Link>
                          <Link
                            href={`/company-admin/owners/${owner.id}/edit`}
                            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition"
                          >
                            <Edit3 className="h-3 w-3" />
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary footer */}
      {ownerList.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total</p>
              <p className="text-lg font-bold text-white">{totalOwners}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Activated</p>
              <p className="text-lg font-bold text-white">{portalActivated}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Pending</p>
              <p className="text-lg font-bold text-white">{pendingActivation}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Active This Month</p>
              <p className="text-lg font-bold text-white">{activeThisMonth}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
