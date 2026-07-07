import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Alert } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

type Tab = 'all' | 'assignments' | 'keys';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: 'All Lock Boxes' },
  { key: 'assignments', label: 'Active Assignments' },
  { key: 'keys', label: 'Key Inventory' },
];

function parseTab(value: string | undefined): Tab {
  if (value === 'assignments') return 'assignments';
  if (value === 'keys') return 'keys';
  return 'all';
}

type LockBoxRow = {
  id: string;
  serial_number: string | null;
  combination: string | null;
  location_description: string | null;
  location_type: string | null;
  status: string;
  key_count: number;
  keys_contained: string[] | null;
  association_name: string | null;
  building_name: string | null;
  unit_number: string | null;
  notes: string | null;
  last_accessed_at: string | null;
  active_assignments: number;
};

type AssignmentRow = {
  id: string;
  lock_box_serial: string | null;
  lock_box_location: string | null;
  vendor_name: string | null;
  staff_name: string | null;
  assigned_at: string;
  expires_at: string | null;
  purpose: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  returned_at: string | null;
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <StatusChip tone="success">Active</StatusChip>;
    case 'inactive':
      return <StatusChip tone="neutral">Inactive</StatusChip>;
    case 'lost':
      return <StatusChip tone="danger">Lost</StatusChip>;
    case 'retired':
      return <StatusChip tone="warning">Retired</StatusChip>;
    default:
      return <StatusChip tone="neutral">{status}</StatusChip>;
  }
}

function LocationTypeLabel({ type }: { type: string | null }) {
  switch (type) {
    case 'building': return 'Building';
    case 'unit': return 'Unit';
    case 'gate': return 'Gate';
    case 'entrance': return 'Entrance';
    case 'pool': return 'Pool';
    default: return type ?? 'Other';
  }
}

export default async function LockBoxesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const tab = parseTab(sp.tab);

  const supabase = await createClient();

  // Fetch lock boxes
  let lockBoxes: LockBoxRow[] = [];
  let lockBoxError: string | null = null;
  try {
    const { data, error } = await (supabase as any)
      .from('lock_boxes')
      .select(`
        id, serial_number, combination, location_description, location_type,
        status, key_count, keys_contained, notes, last_accessed_at,
        association_id, building_id, unit_id,
        associations(name),
        buildings(name),
        units(unit_number)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      lockBoxError = error.message ?? 'Failed to load lock boxes';
    } else {
      lockBoxes = (data ?? []).map((row: any) => ({
        id: row.id,
        serial_number: row.serial_number,
        combination: row.combination,
        location_description: row.location_description,
        location_type: row.location_type,
        status: row.status ?? 'active',
        key_count: Number(row.key_count ?? 0),
        keys_contained: row.keys_contained,
        association_name: row.associations?.name ?? null,
        building_name: row.buildings?.name ?? null,
        unit_number: row.units?.unit_number ?? null,
        notes: row.notes,
        last_accessed_at: row.last_accessed_at,
        active_assignments: 0,
      }));
    }
  } catch (err: any) {
    lockBoxError = err.message ?? 'Failed to load lock boxes';
  }

  // Fetch active assignments count per lock box
  if (!lockBoxError) {
    try {
      const { data: counts } = await (supabase as any)
        .from('lock_box_assignments')
        .select('lock_box_id')
        .is('returned_at', null);

      if (counts) {
        const countMap: Record<string, number> = {};
        (counts as any[]).forEach((a: any) => {
          countMap[a.lock_box_id] = (countMap[a.lock_box_id] || 0) + 1;
        });
        lockBoxes = lockBoxes.map((lb) => ({
          ...lb,
          active_assignments: countMap[lb.id] || 0,
        }));
      }
    } catch {
      // Non-critical — just leaves counts at 0
    }
  }

  // Fetch assignments
  let assignments: AssignmentRow[] = [];
  let assignmentError: string | null = null;
  try {
    const { data, error } = await (supabase as any)
      .from('lock_box_assignments')
      .select(`
        id, assigned_at, expires_at, purpose, contact_phone, contact_email, returned_at,
        lock_boxes(serial_number, location_description),
        vendors(name),
        profiles(full_name, email)
      `)
      .order('assigned_at', { ascending: false });

    if (error) {
      assignmentError = error.message ?? 'Failed to load assignments';
    } else {
      assignments = (data ?? []).map((row: any) => ({
        id: row.id,
        lock_box_serial: row.lock_boxes?.serial_number ?? null,
        lock_box_location: row.lock_boxes?.location_description ?? null,
        vendor_name: row.vendors?.name ?? null,
        staff_name: row.profiles?.full_name ?? null,
        assigned_at: row.assigned_at,
        expires_at: row.expires_at,
        purpose: row.purpose,
        contact_phone: row.contact_phone,
        contact_email: row.contact_email,
        returned_at: row.returned_at,
      }));
    }
  } catch (err: any) {
    assignmentError = err.message ?? 'Failed to load assignments';
  }

  // Filtering
  const filteredBoxes = q
    ? lockBoxes.filter(
        (b) =>
          (b.serial_number ?? '').toLowerCase().includes(q) ||
          (b.location_description ?? '').toLowerCase().includes(q) ||
          (b.association_name ?? '').toLowerCase().includes(q) ||
          (b.building_name ?? '').toLowerCase().includes(q) ||
          (b.unit_number ?? '').toLowerCase().includes(q) ||
          (b.notes ?? '').toLowerCase().includes(q),
      )
    : lockBoxes;

  const activeAssignments = assignments.filter((a) => !a.returned_at);
  const filteredAssignments = q
    ? activeAssignments.filter(
        (a) =>
          (a.lock_box_serial ?? '').toLowerCase().includes(q) ||
          (a.lock_box_location ?? '').toLowerCase().includes(q) ||
          (a.vendor_name ?? '').toLowerCase().includes(q) ||
          (a.staff_name ?? '').toLowerCase().includes(q) ||
          (a.purpose ?? '').toLowerCase().includes(q),
      )
    : activeAssignments;

  // Metrics
  const totalBoxes = lockBoxes.length;
  const activeBoxes = lockBoxes.filter((b) => b.status === 'active').length;
  const totalAssignments = assignments.length;
  const activeAssignmentsCount = activeAssignments.length;
  const totalKeysTracked = lockBoxes.reduce((sum: number, b) => sum + b.key_count, 0);

  function formatDate(d: string | null): string {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatDateTime(d: string | null): string {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <DataWorkspace
      title="Lock Boxes"
      description="Manage physical lock boxes \u2014 locations, assignments, and key tracking per unit and building."
      actions={<Link href="/lock-boxes/new"><Button>Add Lock Box</Button></Link>}
    >
      <div className="space-y-4">
        {/* Metric strip */}
        <MetricStrip
          metrics={[
            { label: 'Total Boxes', value: String(totalBoxes) },
            { label: 'Active', value: String(activeBoxes) },
            { label: 'Keys Tracked', value: String(totalKeysTracked) },
            { label: 'Active Assignments', value: String(activeAssignmentsCount) },
          ]}
        />

        {/* Tab bar */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/lock-boxes?tab=${t.key === 'all' ? '' : t.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-gray-950 text-gray-950'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <FilterBar
          action="/lock-boxes"
          searchDefault={sp.q ?? ''}
          searchPlaceholder="Search lock boxes, locations, associations..."
        />

        {/* Lock Boxes tab */}
        {tab === 'all' && (
          <>
            {lockBoxError ? (
              <Alert tone="warning" title="Lock boxes table not available.">
                The lock_boxes table has not been created yet in Supabase. Run the migration to
                enable lock box management. ({lockBoxError})
              </Alert>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Serial #</TH>
                    <TH>Location</TH>
                    <TH>Type</TH>
                    <TH>Association / Building / Unit</TH>
                    <TH>Combination</TH>
                    <TH>Keys</TH>
                    <TH>Assignments</TH>
                    <TH>Status</TH>
                    <TH>Last Accessed</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredBoxes.length === 0 ? (
                    <TR>
                      <TD colSpan={9} className="py-10 text-center text-gray-500">
                        {lockBoxes.length === 0
                          ? 'No lock boxes yet. Use Add Lock Box to register your first lock box.'
                          : 'No lock boxes match this search.'}
                      </TD>
                    </TR>
                  ) : (
                    filteredBoxes.map((box: any) => (
                      <TR key={box.id} className="hover:bg-gray-50">
                        <TD className="font-mono text-xs">{box.serial_number ?? '\u2014'}</TD>
                        <TD>{box.location_description ?? '\u2014'}</TD>
                        <TD>
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            <LocationTypeLabel type={box.location_type} />
                          </span>
                        </TD>
                        <TD className="text-xs">
                          {box.association_name && <div className="font-medium">{box.association_name}</div>}
                          {box.building_name && <div className="text-gray-500">{box.building_name}</div>}
                          {box.unit_number && <div className="text-gray-400">Unit {box.unit_number}</div>}
                          {!box.association_name && !box.building_name && !box.unit_number && '\u2014'}
                        </TD>
                        <TD className="font-mono text-xs">{box.combination ?? '\u2014'}</TD>
                        <TD>{box.key_count}</TD>
                        <TD>
                          {box.active_assignments > 0 ? (
                            <StatusChip tone="info">{box.active_assignments} active</StatusChip>
                          ) : (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </TD>
                        <TD>
                          <StatusBadge status={box.status} />
                        </TD>
                        <TD className="text-xs text-gray-500">{formatDateTime(box.last_accessed_at)}</TD>
                      </TR>
                    ))
                  )}
                </tbody>
              </Table>
            )}
          </>
        )}

        {/* Active Assignments tab */}
        {tab === 'assignments' && (
          <>
            {assignmentError ? (
              <Alert tone="warning" title="Assignments table not available.">
                The lock_box_assignments table has not been created yet. Run the migration.
                ({assignmentError})
              </Alert>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Lock Box</TH>
                    <TH>Assigned To</TH>
                    <TH>Type</TH>
                    <TH>Purpose</TH>
                    <TH>Assigned</TH>
                    <TH>Expires</TH>
                    <TH>Contact</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {filteredAssignments.length === 0 ? (
                    <TR>
                      <TD colSpan={8} className="py-10 text-center text-gray-500">
                        {activeAssignments.length === 0
                          ? 'No active assignments. Assignments will appear here once lock boxes are assigned to vendors or staff.'
                          : 'No assignments match this search.'}
                      </TD>
                    </TR>
                  ) : (
                    filteredAssignments.map((a: any) => (
                      <TR key={a.id} className="hover:bg-gray-50">
                        <TD>
                          <div className="font-medium text-xs">{a.lock_box_serial ?? '\u2014'}</div>
                          {a.lock_box_location && (
                            <div className="text-gray-400 text-xs">{a.lock_box_location}</div>
                          )}
                        </TD>
                        <TD className="font-medium">
                          {a.vendor_name ?? a.staff_name ?? 'Unknown'}
                        </TD>
                        <TD>
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                            {a.vendor_name ? 'Vendor' : 'Staff'}
                          </span>
                        </TD>
                        <TD className="text-xs">{a.purpose ?? '\u2014'}</TD>
                        <TD className="text-xs">{formatDate(a.assigned_at)}</TD>
                        <TD className="text-xs">
                          {a.expires_at ? (
                            new Date(a.expires_at) < new Date() ? (
                              <StatusChip tone="danger">Expired</StatusChip>
                            ) : (
                              formatDate(a.expires_at)
                            )
                          ) : (
                            <span className="text-gray-400">No expiry</span>
                          )}
                        </TD>
                        <TD className="text-xs">
                          {a.contact_phone && <div>{a.contact_phone}</div>}
                          {a.contact_email && <div className="text-gray-600">{a.contact_email}</div>}
                          {!a.contact_phone && !a.contact_email && '\u2014'}
                        </TD>
                        <TD>
                          <StatusChip tone="success">Active</StatusChip>
                        </TD>
                      </TR>
                    ))
                  )}
                </tbody>
              </Table>
            )}
          </>
        )}

        {/* Key Inventory tab */}
        {tab === 'keys' && (
          <>
            {lockBoxError ? (
              <Alert tone="warning" title="Lock boxes data not available.">
                {lockBoxError}
              </Alert>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Key Description</TH>
                    <TH>Lock Box</TH>
                    <TH>Location</TH>
                    <TH>Association / Building / Unit</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <tbody>
                  {(() => {
                    const keyRows: Array<{
                      key: string;
                      lockBoxId: string;
                      serial: string | null;
                      location: string | null;
                      association: string | null;
                      building: string | null;
                      unit: string | null;
                      status: string;
                    }> = [];

                    lockBoxes.forEach((box) => {
                      const keys = box.keys_contained ?? [];
                      if (keys.length === 0) {
                        keyRows.push({
                          key: '(no keys tracked)',
                          lockBoxId: box.id,
                          serial: box.serial_number,
                          location: box.location_description,
                          association: box.association_name,
                          building: box.building_name,
                          unit: box.unit_number,
                          status: box.status,
                        });
                      } else {
                        keys.forEach((k: string) => {
                          keyRows.push({
                            key: k,
                            lockBoxId: box.id,
                            serial: box.serial_number,
                            location: box.location_description,
                            association: box.association_name,
                            building: box.building_name,
                            unit: box.unit_number,
                            status: box.status,
                          });
                        });
                      }
                    });

                    const filteredKeys = q
                      ? keyRows.filter(
                          (k) =>
                            k.key.toLowerCase().includes(q) ||
                            (k.serial ?? '').toLowerCase().includes(q) ||
                            (k.location ?? '').toLowerCase().includes(q) ||
                            (k.association ?? '').toLowerCase().includes(q) ||
                            (k.building ?? '').toLowerCase().includes(q) ||
                            (k.unit ?? '').toLowerCase().includes(q),
                        )
                      : keyRows;

                    if (filteredKeys.length === 0) {
                      return (
                        <TR>
                          <TD colSpan={5} className="py-10 text-center text-gray-500">
                            {q
                              ? 'No keys match this search.'
                              : 'No keys tracked. Keys will appear here once lock boxes are created with key information.'}
                          </TD>
                        </TR>
                      );
                    }

                    return filteredKeys.map((k, i) => (
                      <TR key={`${k.lockBoxId}-${i}`} className="hover:bg-gray-50">
                        <TD className="font-medium">{k.key}</TD>
                        <TD className="font-mono text-xs">{k.serial ?? '\u2014'}</TD>
                        <TD className="text-xs">{k.location ?? '\u2014'}</TD>
                        <TD className="text-xs">
                          {k.association && <div className="font-medium">{k.association}</div>}
                          {k.building && <div className="text-gray-500">{k.building}</div>}
                          {k.unit && <div className="text-gray-400">Unit {k.unit}</div>}
                          {!k.association && !k.building && !k.unit && '\u2014'}
                        </TD>
                        <TD>
                          <StatusBadge status={k.status} />
                        </TD>
                      </TR>
                    ));
                  })()}
                </tbody>
              </Table>
            )}
          </>
        )}
      </div>
    </DataWorkspace>
  );
}
