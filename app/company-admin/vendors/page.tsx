import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Wrench,
  Search,
  Filter,
  Shield,
  Mail,
  Phone,
  Eye,
  Edit3,
  Briefcase,
  HardHat,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function firstJsonEntry(json: any): string | null {
  if (!json) return null;
  if (typeof json === 'string') return json;
  if (Array.isArray(json)) return json[0] ?? null;
  if (typeof json === 'object') {
    const keys = Object.keys(json);
    if (keys.length === 0) return null;
    return json[keys[0]];
  }
  return null;
}

function typeLabel(t: string | null): string {
  if (!t) return '—';
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
      Not Activated
    </span>
  );
}

function VendorTypeBadge({ vendorType }: { vendorType: string | null }) {
  const map: Record<string, string> = {
    contractor: 'bg-blue-400/10 text-blue-400 border-blue-500/20',
    vendor: 'bg-slate-400/10 text-slate-400 border-slate-600/30',
    supplier: 'bg-amber-400/10 text-amber-400 border-amber-500/20',
    service_provider: 'bg-purple-400/10 text-purple-400 border-purple-500/20',
    utility: 'bg-cyan-400/10 text-cyan-400 border-cyan-500/20',
  };
  const colors = map[vendorType ?? ''] ?? 'bg-slate-400/10 text-slate-400 border-slate-600/30';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}>
      {typeLabel(vendorType)}
    </span>
  );
}

function TradeBadge({ trade }: { trade: string | null }) {
  if (!trade) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-xs text-slate-300">
      <HardHat className="h-2.5 w-2.5" />
      {typeLabel(trade)}
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

export default async function VendorsPage() {
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

  // Fetch all vendors for this portfolio
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, vendor_type, trade, emails, phone_numbers, portal_activated')
    .eq('portfolio_id', portfolioId)
    .is('archived_at', null)
    .order('name', { ascending: true });

  const vendorList = vendors ?? [];

  // Get open work order counts per vendor
  const vendorIds = vendorList.map((v) => v.id);
  const { data: workOrders } = vendorIds.length > 0
    ? await supabase
        .from('work_orders')
        .select('vendor_id, status')
        .in('vendor_id', vendorIds)
        .eq('portfolio_id', portfolioId)
        .in('status', ['new', 'assigned', 'in_progress'])
    : { data: [] };

  const woMap = new Map<string, number>();
  (workOrders ?? []).forEach((wo: any) => {
    woMap.set(wo.vendor_id ?? '', (woMap.get(wo.vendor_id ?? '') ?? 0) + 1);
  });

  // Compute stats
  const totalVendors = vendorList.length;
  const activeVendors = vendorList.filter((v: any) => !v.archived_at).length;
  const portalActivated = vendorList.filter((v) => v.portal_activated).length;
  const totalOpenWOs = [...woMap.values()].reduce((sum, n) => sum + n, 0);

  // Extract unique vendor types and trades for filter dropdowns
  const vendorTypes = [...new Set(vendorList.map((v) => v.vendor_type).filter(Boolean))] as string[];
  const trades = [...new Set(vendorList.map((v) => v.trade).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Company Admin</p>
          <h1 className="mt-1 text-xl font-bold text-white">Vendor Directory</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalVendors} vendor{totalVendors !== 1 ? 's' : ''} in your portfolio
          </p>
        </div>
        <Link href="/company-admin/vendors">
          <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <Building2 className="h-4 w-4" />
            Add Vendor
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Vendors"
          value={totalVendors}
          icon={Building2}
          accent="emerald"
        />
        <StatCard
          label="Active"
          value={activeVendors}
          sub={totalVendors > 0 ? `${Math.round((activeVendors / totalVendors) * 100)}%` : undefined}
          icon={Briefcase}
          accent="blue"
        />
        <StatCard
          label="Portal Activated"
          value={portalActivated}
          sub="vendor portal"
          icon={Search}
          accent={portalActivated > 0 ? 'emerald' : 'slate'}
        />
        <StatCard
          label="Open Work Orders"
          value={totalOpenWOs}
          sub="across vendors"
          icon={Wrench}
          accent={totalOpenWOs > 10 ? 'amber' : totalOpenWOs > 20 ? 'red' : 'slate'}
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
            name="vendor_type"
            defaultValue=""
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">All Types</option>
            {vendorTypes.map((t) => (
              <option key={t} value={t}>{typeLabel(t)}</option>
            ))}
          </select>
          <select
            name="trade"
            defaultValue=""
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="">All Trades</option>
            {trades.map((t) => (
              <option key={t} value={t}>{typeLabel(t)}</option>
            ))}
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
      {vendorList.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-16 text-center">
          <Building2 className="h-10 w-10 text-slate-700 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-400">No vendors found</p>
          <p className="text-xs text-slate-400 mt-1">Vendors will appear here once added to your portfolio.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Vendor Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Trade</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Phone</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Portal</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Open WOs</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {vendorList.map((vendor) => {
                  const primaryEmail = firstJsonEntry(vendor.emails) ?? '—';
                  const primaryPhone = firstJsonEntry(vendor.phone_numbers) ?? '—';
                  const openWOs = woMap.get(vendor.id) ?? 0;

                  return (
                    <tr key={vendor.id} className="hover:bg-white/[0.01] transition">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{vendor.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <VendorTypeBadge vendorType={vendor.vendor_type} />
                      </td>
                      <td className="px-4 py-3">
                        <TradeBadge trade={vendor.trade} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-300 truncate max-w-[180px]">{primaryEmail}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-300 tabular-nums">{primaryPhone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PortalBadge activated={vendor.portal_activated} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {openWOs > 0 ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            openWOs > 10 ? 'text-red-400 bg-red-400/10' : openWOs > 5 ? 'text-amber-400 bg-amber-400/10' : 'text-emerald-400 bg-emerald-400/10'
                          }`}>
                            <Wrench className="h-3 w-3" />
                            {openWOs}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/company-admin/vendors/${vendor.id}`}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Link>
                          <Link
                            href={`/company-admin/vendors/${vendor.id}/edit`}
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
      {vendorList.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Total</p>
              <p className="text-lg font-bold text-white">{totalVendors}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Portal Activated</p>
              <p className="text-lg font-bold text-white">{portalActivated}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Not Activated</p>
              <p className="text-lg font-bold text-white">{totalVendors - portalActivated}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Open Work Orders</p>
              <p className="text-lg font-bold text-white">{totalOpenWOs}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
