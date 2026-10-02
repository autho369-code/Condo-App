import { fetchAllRows } from '@/lib/supabase/fetch-all';

/** Association and unit pickers for the asset form (RLS-scoped, complete lists). */
export async function loadAssetOptions(db: any) {
  const [assocs, units] = await Promise.all([
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
    fetchAllRows<any>(() => db.from('units')
      .select('id, unit_number, buildings!inner(association_id, associations(name))')
      .is('archived_at', null)
      .order('unit_number')
      .order('id'), { maxRows: 20000 }),
  ]);
  const associations = assocs.rows.map((a) => ({ id: a.id as string, name: a.name as string }));
  const unitOptions = units.rows
    .map((u) => ({
      id: u.id as string,
      association_id: u.buildings?.association_id as string,
      label: `${u.buildings?.associations?.name ?? 'Association'} · ${u.unit_number ?? 'Unit'}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const error = assocs.error ?? units.error;
  const truncated = assocs.truncated || units.truncated;
  return { associations, units: unitOptions, error, truncated };
}
