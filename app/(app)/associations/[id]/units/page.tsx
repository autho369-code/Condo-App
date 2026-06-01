import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type UnitRow = {
  id: string;
  unit_number: string;
  ownership_pct: number | null;
  owners: string;
  renter: string | null;
  dues: number | null;
};

export default async function AssociationUnitsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; items_per_page?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = Math.max(1, Math.min(100, Number(sp.items_per_page ?? PAGE_SIZE)));

  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: units } = await (supabase as any)
    .from('units')
    .select(`
      id, unit_number, ownership_pct,
      building:buildings!inner ( id, association_id, archived_at )
    `)
    .eq('building.association_id', id)
    .is('archived_at', null)
    .order('unit_number');

  const unitIds = (units ?? []).map((u: any) => u.id);

  const { data: occs } = unitIds.length > 0
    ? await (supabase as any)
        .from('occupancies')
        .select('unit_id, owner_id, occupancy_type, status, is_primary, share_pct, dues_amount')
        .in('unit_id', unitIds)
        .eq('status', 'current')
    : { data: [] as any[] };

  const ownerIds = Array.from(new Set((occs ?? []).map((o: any) => o.owner_id).filter(Boolean)));
  const { data: owners } = ownerIds.length > 0
    ? await (supabase as any).from('owners').select('id, full_name').in('id', ownerIds)
    : { data: [] as any[] };

  const ownerById = new Map<string, { id: string; full_name: string }>();
  (owners ?? []).forEach((o: any) => ownerById.set(o.id, o));

  const occByUnit = new Map<string, any[]>();
  (occs ?? []).forEach((o: any) => {
    const arr = occByUnit.get(o.unit_id) ?? [];
    arr.push(o);
    occByUnit.set(o.unit_id, arr);
  });

  const rows: UnitRow[] = (units ?? []).map((u: any) => {
    const list = occByUnit.get(u.id) ?? [];
    const ownerOccs = list.filter((o: any) => o.occupancy_type === 'owner');
    const tenantOccs = list.filter((o: any) => o.occupancy_type === 'tenant');

    ownerOccs.sort((a: any, b: any) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return (b.share_pct ?? 0) - (a.share_pct ?? 0);
    });
    const owners = ownerOccs
      .map((o: any) => ownerById.get(o.owner_id)?.full_name)
      .filter(Boolean)
      .join(' & ');

    const primaryOwner = ownerOccs.find((o: any) => o.is_primary) ?? ownerOccs[0];
    const dues = primaryOwner?.dues_amount ?? null;

    const tenantOcc = tenantOccs[0];
    const renter = tenantOcc ? (ownerById.get(tenantOcc.owner_id)?.full_name ?? null) : null;

    return {
      id: u.id,
      unit_number: u.unit_number,
      ownership_pct: u.ownership_pct != null ? Number(u.ownership_pct) : null,
      owners,
      renter,
      dues: dues != null ? Number(dues) : null,
    };
  });

  const occupiedUnits = rows.filter((r) => occByUnit.get(r.id)?.length).length;
  const ownerOccupied = rows.filter((r) => {
    const list = occByUnit.get(r.id) ?? [];
    return list.some((o: any) => o.occupancy_type === 'owner');
  }).length;
  const ownerOccupiedPct = occupiedUnits > 0 ? Math.round((ownerOccupied / occupiedUnits) * 100) : 0;

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const slice = rows.slice(start, end);

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="units" />
          <WorkspaceHeader
            title={assoc.name}
            subtitle={`${ownerOccupiedPct}% Owner Occupied`}
          />
        </>
      }
      rail={rail}
    >
      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="w-20 px-4 py-2 text-left font-semibold">Unit</th>
              <th className="px-4 py-2 text-left font-semibold">Homeowner</th>
              <th className="px-4 py-2 text-left font-semibold">Renter Occupied</th>
              <th className="px-4 py-2 text-left font-semibold">Ownership Percentage</th>
              <th className="px-4 py-2 text-left font-semibold">Dues</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No units in this association.</td></tr>
            ) : slice.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/units/${r.id}`} className="text-blue-700 hover:underline">{r.unit_number}</Link>
                </td>
                <td className="px-4 py-3">
                  {r.owners ? <span className="text-blue-700">{r.owners}</span> : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-700">{r.renter ?? '--'}</td>
                <td className="px-4 py-3 tabular-nums text-gray-700">
                  {r.ownership_pct != null ? `${r.ownership_pct.toFixed(6)}%` : '—'}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-700">
                  {r.dues != null ? r.dues.toFixed(2) : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm text-slate-400">
        Displaying: <span className="tabular-nums">{total === 0 ? 0 : start + 1}</span>-<span className="tabular-nums">{end}</span> of <span className="tabular-nums">{total}</span>
      </div>
    </Workspace>
  );
}
