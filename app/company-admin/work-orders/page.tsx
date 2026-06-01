import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import {
  Wrench,
  Shield,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Building2,
  User,
  HardHat,
  MoreHorizontal,
  Calendar,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface WorkOrderRow {
  id: string;
  number: string | null;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  scheduled_date: string | null;
  completed_date: string | null;
  associationName: string | null;
  associationId: string;
  unitNumber: string | null;
  managerName: string | null;
  vendorName: string | null;
  vendorId: string | null;
  daysOpen: number;
  isOverdue: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysAgo(ts: string): number {
  return Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
}

/* -------------------------------------------------------------------------- */
/*  Components                                                                */
/* -------------------------------------------------------------------------- */

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    emergency: 'bg-red-400/10 text-red-400 border-red-500/20',
    high: 'bg-amber-400/10 text-amber-400 border-amber-500/20',
    medium: 'bg-blue-400/10 text-blue-400 border-blue-500/20',
    low: 'bg-slate-400/10 text-slate-400 border-slate-600/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
        styles[priority] || styles.low
      }`}
    >
      {priority === 'emergency' && (
        <span className="h-1.5 w-1.5 rounded-full bg-red-400 mr-1" />
      )}
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-blue-400/10 text-blue-400 border-blue-500/20',
    in_progress: 'bg-amber-400/10 text-amber-400 border-amber-500/20',
    pending: 'bg-purple-400/10 text-purple-400 border-purple-500/20',
    completed: 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20',
    closed: 'bg-slate-400/10 text-slate-400 border-slate-600/30',
    canceled: 'bg-red-400/10 text-red-400 border-red-500/20',
  };
  const labels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    pending: 'Pending',
    completed: 'Completed',
    closed: 'Closed',
    canceled: 'Canceled',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
        styles[status] || styles.low
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function WorkOrdersPage() {
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

  // Fetch all data: work orders, associations, units (via buildings), profiles, vendors
  const [
    { data: workOrders },
    { data: associations },
    { data: units },
    { data: profiles },
    { data: vendors },
  ] = await Promise.all([
    supabase
      .from('work_orders')
      .select(
        'id, number, title, status, priority, created_at, scheduled_date, completed_date, association_id, unit_id, vendor_id, assignee_id, created_by',
      )
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('associations')
      .select('id, name')
      .eq('portfolio_id', portfolioId)
      .is('archived_at', null),
    supabase.from('units').select('id, unit_number, building_id'),
    supabase
      .from('profiles')
      .select('id, full_name, email, hoa_role')
      .eq('portfolio_id', portfolioId),
    supabase
      .from('vendors')
      .select('id, name')
      .eq('portfolio_id', portfolioId),
  ]);

  const woList = workOrders ?? [];
  const assocMap = new Map<string, string>();
  const unitMap = new Map<string, string>();
  const profileMap = new Map<string, string>();
  const vendorMap = new Map<string, string>();

  for (const a of associations ?? []) assocMap.set(a.id, a.name);
  for (const u of units ?? []) unitMap.set(u.id, u.unit_number);
  for (const p of profiles ?? [])
    profileMap.set(p.id, p.full_name ?? p.email ?? 'Unknown');
  for (const v of vendors ?? []) vendorMap.set(v.id, v.name);

  // Build work order rows
  const rows: WorkOrderRow[] = woList.map((wo: any) => {
    const createdAt = wo.created_at;
    const days = createdAt ? daysAgo(createdAt) : 0;
    const isOverdue =
      days > 7 &&
      wo.status !== 'completed' &&
      wo.status !== 'closed' &&
      wo.status !== 'canceled';

    return {
      id: wo.id,
      number: wo.number ?? null,
      title: wo.title,
      status: wo.status,
      priority: wo.priority,
      created_at: createdAt,
      scheduled_date: wo.scheduled_date ?? null,
      completed_date: wo.completed_date ?? null,
      associationName: assocMap.get(wo.association_id) ?? null,
      associationId: wo.association_id,
      unitNumber: wo.unit_id ? unitMap.get(wo.unit_id) ?? null : null,
      managerName:
        (wo.assignee_id ? profileMap.get(wo.assignee_id) : null) ??
        (wo.created_by ? profileMap.get(wo.created_by) : null) ??
        null,
      vendorName: wo.vendor_id ? vendorMap.get(wo.vendor_id) ?? null : null,
      vendorId: wo.vendor_id ?? null,
      daysOpen: days,
      isOverdue,
    };
  });

  // Stats
  const totalOpen = rows.filter(
    (r) => r.status === 'new' || r.status === 'pending',
  ).length;
  const inProgress = rows.filter((r) => r.status === 'in_progress').length;
  const overdue = rows.filter((r) => r.isOverdue).length;
  const completedThisMonth = rows.filter((r) => {
    if (r.status !== 'completed' && r.status !== 'closed') return false;
    if (!r.completed_date) return false;
    const completedDate = new Date(r.completed_date);
    const now = new Date();
    return (
      completedDate.getMonth() === now.getMonth() &&
      completedDate.getFullYear() === now.getFullYear()
    );
  }).length;

  // Unique values for dropdowns
  const uniqueStatuses = Array.from(new Set(rows.map((r) => r.status))).sort();
  const uniquePriorities = Array.from(new Set(rows.map((r) => r.priority))).sort();
  const uniqueAssociations = Array.from(
    new Set(
      rows.map((r) => r.associationId).filter(Boolean),
    ),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Company Admin
        </p>
        <h1 className="mt-1 text-xl font-bold text-white">Work Orders Oversight</h1>
        <p className="mt-1 text-sm text-slate-400">
          {rows.length} work orders across {uniqueAssociations.length} associations
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/15 to-blue-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Total Open
          </p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums mt-1">
            {totalOpen}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 to-amber-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            In Progress
          </p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums mt-1">
            {inProgress}
          </p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/15 to-red-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Overdue</p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums mt-1">
            {overdue}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Completed (Month)
          </p>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums mt-1">
            {completedThisMonth}
          </p>
        </div>
      </div>

      {/* Filters + Search (server-component placeholder — client filter will be in a future client component wrapper) */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Filters &amp; Search
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* Status filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">
              Status
            </label>
            <select className="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500/50">
              <option value="">All Statuses</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">
              Priority
            </label>
            <select className="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500/50">
              <option value="">All Priorities</option>
              {uniquePriorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Association filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">
              Association
            </label>
            <select className="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500/50">
              <option value="">All Associations</option>
              {uniqueAssociations.map((id) => (
                <option key={id} value={id}>
                  {assocMap.get(id) ?? id}
                </option>
              ))}
            </select>
          </div>

          {/* Manager filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">
              Manager
            </label>
            <select className="rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 px-3 py-2 focus:outline-none focus:border-emerald-500/50">
              <option value="">All Managers</option>
              {Array.from(new Set(rows.map((r) => r.managerName).filter(Boolean))).map(
                (name) => (
                  <option key={name} value={name!}>
                    {name}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">
              Search Title
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search work orders..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 pl-9 pr-3 py-2 focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Filters are applied client-side — full server-side filtering available in a future release.
        </p>
      </div>

      {/* Work Orders Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Wrench className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No work orders found</p>
            <p className="text-xs text-slate-500 mt-1">
              Work orders will appear here as they are created
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02] text-xs text-slate-400 uppercase">
                  <th className="text-left px-4 py-3 font-medium">WO #</th>
                  <th className="text-left px-4 py-3 font-medium">Title</th>
                  <th className="text-left px-4 py-3 font-medium">Association</th>
                  <th className="text-left px-4 py-3 font-medium">Unit</th>
                  <th className="text-left px-4 py-3 font-medium">Manager</th>
                  <th className="text-left px-4 py-3 font-medium">Vendor</th>
                  <th className="text-center px-4 py-3 font-medium">Priority</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Created</th>
                  <th className="text-right px-4 py-3 font-medium">Days Open</th>
                  <th className="text-center px-4 py-3 font-medium">Overdue</th>
                  <th className="text-center px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-white/[0.02] ${
                      row.isOverdue ? 'bg-red-500/5' : ''
                    }`}
                  >
                    {/* WO Number */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-500">
                        {row.number ?? row.id.slice(0, 8)}
                      </span>
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white max-w-xs truncate">
                        {row.title}
                      </p>
                      {row.scheduled_date && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(row.scheduled_date)}
                        </p>
                      )}
                    </td>

                    {/* Association */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/company-admin/associations`}
                        className="text-sm text-slate-300 hover:text-emerald-400 flex items-center gap-1"
                      >
                        <Building2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate max-w-[120px]">
                          {row.associationName ?? '—'}
                        </span>
                      </Link>
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {row.unitNumber ?? '—'}
                    </td>

                    {/* Manager */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-300 flex items-center gap-1">
                        <User className="h-3 w-3 flex-shrink-0" />
                        {row.managerName ?? 'Unassigned'}
                      </span>
                    </td>

                    {/* Vendor */}
                    <td className="px-4 py-3">
                      {row.vendorName ? (
                        <span className="text-sm text-slate-300 flex items-center gap-1">
                          <HardHat className="h-3 w-3 flex-shrink-0" />
                          {row.vendorName}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3 text-center">
                      <PriorityBadge priority={row.priority} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {fmtDate(row.created_at)}
                    </td>

                    {/* Days Open */}
                    <td className="px-4 py-3 text-right text-sm tabular-nums whitespace-nowrap">
                      <span
                        className={
                          row.daysOpen > 14
                            ? 'text-red-400 font-semibold'
                            : row.daysOpen > 7
                              ? 'text-amber-400'
                              : 'text-slate-300'
                        }
                      >
                        {row.daysOpen}d
                      </span>
                    </td>

                    {/* Overdue */}
                    <td className="px-4 py-3 text-center">
                      {row.isOverdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/company-admin/work-orders`}
                          className="inline-flex items-center justify-center rounded-md p-1 text-slate-500 hover:text-emerald-400 hover:bg-emerald-400/10"
                          title="View"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/company-admin/work-orders`}
                          className="inline-flex items-center justify-center rounded-md p-1 text-slate-500 hover:text-amber-400 hover:bg-amber-400/10"
                          title="Reassign"
                        >
                          <User className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/company-admin/work-orders`}
                          className="inline-flex items-center justify-center rounded-md p-1 text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                          title="Escalate"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/company-admin/work-orders`}
                          className="inline-flex items-center justify-center rounded-md p-1 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10"
                          title="Add Note"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination placeholder */}
      {rows.length > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing 20 of {rows.length} work orders
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled
              className="border-slate-700 text-slate-500"
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
