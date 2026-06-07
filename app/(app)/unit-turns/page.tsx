import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Types ──
type TurnStatus = 'pending' | 'in_progress' | 'complete';
const TURN_STATUSES: TurnStatus[] = ['pending', 'in_progress', 'complete'];

// ── Helpers ──
function mapWorkOrderStatusToTurn(woStatus: string | null): TurnStatus {
  switch (woStatus) {
    case 'new':
    case 'assigned':
      return 'pending';
    case 'scheduled':
    case 'in_progress':
      return 'in_progress';
    case 'done':
    case 'completed':
    case 'billed':
    case 'closed':
      return 'complete';
    case 'cancelled':
    default:
      return 'pending';
  }
}

function turnStatusChip(status: TurnStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'pending':    return { label: 'Pending',     tone: 'warning' };
    case 'in_progress': return { label: 'In Progress', tone: 'info' };
    case 'complete':   return { label: 'Complete',    tone: 'success' };
  }
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Page ──
export default async function UnitTurnsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; association_id?: string }>;
}) {
  await requireStaff();
  const { q = '', status = '', association_id = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // Derive unit-turn data from work_orders linked to units.
  // The unit_turns table (pending schema) is not yet in the DB,
  // so we treat any work order with a unit_id as a potential unit turn.
  const [
    { data: rows },
    { data: associations },
  ] = await Promise.all([
    db.from('work_orders')
      .select('id, title, number, status, scheduled_date, unit_id, association_id, vendor_id, created_at, units(unit_number), associations(name), vendors(name)')
      .is('archived_at', null)
      .not('unit_id', 'is', null)
      .order('scheduled_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);

  const all = (rows ?? []) as any[];

  // Augment each row with derived turn status
  const turnRows = all.map((row: any) => ({
    ...row,
    turnStatus: mapWorkOrderStatusToTurn(row.status),
  }));

  // ── Filter ──
  let filtered = [...turnRows];
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (r: any) =>
        (r.title ?? '').toLowerCase().includes(ql) ||
        (r.number ?? '').toLowerCase().includes(ql) ||
        (r.units?.unit_number ?? '').toLowerCase().includes(ql) ||
        (r.associations?.name ?? '').toLowerCase().includes(ql) ||
        (r.vendors?.name ?? '').toLowerCase().includes(ql),
    );
  }
  if (status) {
    filtered = filtered.filter((r: any) => r.turnStatus === status);
  }
  if (association_id) {
    filtered = filtered.filter((r: any) => r.association_id === association_id);
  }

  // ── Metrics ──
  const pending = turnRows.filter((r: any) => r.turnStatus === 'pending').length;
  const inProgress = turnRows.filter((r: any) => r.turnStatus === 'in_progress').length;
  const complete = turnRows.filter((r: any) => r.turnStatus === 'complete').length;
  const total = turnRows.length;

  // ── Render ──
  return (
    <DataWorkspace
      title="Unit Turns"
      description="Track unit move-out preparation, cleaning, inspection, and re-listing workflows."
      actions={
        <Link
          href="/work-orders/new"
          className="rounded bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + New unit turn
        </Link>
      }
      rail={<UnitTurnsRail />}
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Total turns', value: total, sublabel: 'All tracked units' },
            { label: 'Pending', value: pending, sublabel: <Link href="/unit-turns?status=pending" className="text-blue-700 hover:underline">Awaiting action</Link> },
            { label: 'In Progress', value: inProgress, sublabel: <Link href="/unit-turns?status=in_progress" className="text-blue-700 hover:underline">Active work</Link> },
            { label: 'Complete', value: complete, sublabel: <Link href="/unit-turns?status=complete" className="text-blue-700 hover:underline">Ready for move-in</Link> },
          ]}
        />

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/unit-turns"
          searchDefault={q}
          searchPlaceholder="Search by title, unit number, association, or vendor..."
        >
          <label className="text-xs font-medium uppercase text-gray-500">
            Status
            <select
              name="status"
              defaultValue={status}
              className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900"
            >
              <option value="">All statuses</option>
              {TURN_STATUSES.map((s) => (
                <option key={s} value={s}>{formatLabel(s)}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium uppercase text-gray-500">
            Association
            <select
              name="association_id"
              defaultValue={association_id}
              className="mt-1 h-9 max-w-[200px] rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900"
            >
              <option value="">All</option>
              {(associations ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        </FilterBar>

        {/* ── TABLE ── */}
        {filtered.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Unit</TH>
                <TH>Association</TH>
                <TH>Status</TH>
                <TH>Scheduled Date</TH>
                <TH>Assigned Vendor</TH>
                <TH>Tasks</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((row: any) => {
                const sc = turnStatusChip(row.turnStatus);
                return (
                  <TR key={row.id}>
                    <TD>
                      <div className="font-medium text-gray-900">
                        {row.units?.unit_number ?? '—'}
                      </div>
                      <div className="text-xs text-gray-500">
                        WO #{row.number ?? row.id.slice(0, 8)}
                      </div>
                    </TD>
                    <TD className="text-sm text-gray-700">
                      {row.associations?.name ?? '—'}
                    </TD>
                    <TD>
                      <StatusChip tone={sc.tone}>{sc.label}</StatusChip>
                    </TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">
                      {date(row.scheduled_date) ?? '—'}
                    </TD>
                    <TD className="text-sm">
                      {row.vendors?.name ? (
                        <Link
                          href={`/vendors/${row.vendor_id}`}
                          className="text-blue-700 hover:underline"
                        >
                          {row.vendors.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        <Link
                          href={`/work-orders/${row.id}`}
                          className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          Work Order
                        </Link>
                        <Link
                          href={`/unit-turns/new?unit_id=${row.unit_id}`}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
                        >
                          New Turn
                        </Link>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            No unit turns match the current filters.
            {all.length === 0 && (
              <div className="mt-2">
                <p>Unit turns are derived from work orders assigned to units.</p>
                <p className="mt-1 text-xs text-gray-400">
                  Create a <Link href="/work-orders/new" className="text-blue-700 hover:underline">new work order</Link> assigned to a unit to populate this view.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

// ── DataWorkspace Rail (Task Panel) ──
function UnitTurnsRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/unit-turns/new" label="+ New Unit Turn" />
          <RailLink href="/work-orders/new" label="+ New Work Order" />
          <RailLink href="/unit-turns?status=pending" label="Pending Queue" />
          <RailLink href="/unit-turns?status=in_progress" label="In Progress" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Reports</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports/unit_turn" label="Unit Turn Report" />
          <RailLink href="/reports/work_order" label="Work Order Report" />
          <RailLink href="/reports/unit_availability" label="Unit Availability" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Quick Links</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/work-orders" label="All Work Orders" />
          <RailLink href="/vendors" label="Vendor Directory" />
          <RailLink href="/inspections" label="Inspections" />
          <RailLink href="/units" label="Units Directory" />
        </div>
      </section>
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}
