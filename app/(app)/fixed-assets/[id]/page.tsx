import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { AssetFields, label } from '@/components/fixed-assets/asset-fields';
import { Button } from '@/components/ui/button';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { loadAssetOptions } from '@/lib/fixed-assets/options';
import { archiveFixedAsset, updateFixedAsset } from '@/lib/rpcs/fixed-assets';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';
import { depreciationToDate } from '@/lib/fixed-assets/depreciation';
import { todayInZone } from '@/lib/time/zoned';
import { PendingSubmit } from '@/components/ui/pending-submit';

export const dynamic = 'force-dynamic';

export default async function FixedAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = (await createClient()) as any;

  const { data: asset } = await db
    .from('fixed_assets')
    .select('*, associations(name), units(unit_number)')
    .eq('id', id)
    .maybeSingle();
  if (!asset) notFound();
  const removed = !!asset.archived_at;
  // Platform operators can look but not change; RLS also limits writes to finance staff.
  const canEdit = me.is_staff && !removed;
  const options = canEdit ? await loadAssetOptions(db) : null;

  const cost = asset.purchase_price != null ? Number(asset.purchase_price) : null;
  const dep = depreciationToDate(asset, todayInZone());
  const depLabel = dep.basis === 'calculated'
    ? 'Calculated straight-line to today; not posted to the ledger'
    : dep.basis === 'none'
      ? 'No depreciation method set'
      : `Recorded value. ${dep.note ?? ''}`.trim();

  const details: [string, React.ReactNode][] = [
    ['Association', asset.associations?.name ?? '—'],
    ['Unit', asset.units?.unit_number ?? '—'],
    ['Type', asset.asset_type ?? '—'],
    ['Status', label(asset.status)],
    ['Placed in service', date(asset.placed_in_service_date)],
    ['Warranty expiration', date(asset.warranty_expiration_date)],
    ['Make', asset.make ?? '—'],
    ['Model', asset.model ?? '—'],
    ['Serial number', asset.serial_number ?? '—'],
    ['Purchase date', date(asset.purchase_date)],
    ['Depreciation', `${label(asset.depreciation_method)}${asset.useful_life_years ? ` · ${asset.useful_life_years} years` : ''}`],
    ['Salvage value', money(asset.salvage_value)],
  ];
  if (asset.status === 'disposed' || asset.status === 'sold') {
    details.push(['Disposal or sale date', asset.disposed_at ? date(String(asset.disposed_at).slice(0, 10)) : '—']);
    details.push(['Disposal or sale amount', asset.disposed_amount != null ? money(asset.disposed_amount) : '—']);
  }

  return (
    <DataWorkspace
      title={asset.name}
      description={asset.description || [asset.asset_type, asset.associations?.name].filter(Boolean).join(' · ') || 'Fixed asset'}
      actions={<Link href="/fixed-assets"><Button variant="secondary">Back to fixed assets</Button></Link>}
    >
      <div className="space-y-4">
        {removed && <Alert tone="info" title="Removed from fixed assets">This asset is no longer on the register. Its details are kept here for reference.</Alert>}
        {sp.error && <Alert tone="danger" title="Could not save">{sp.error}</Alert>}
        {sp.saved === 'created' && <Alert tone="success">Fixed asset added.</Alert>}
        {sp.saved === '1' && <Alert tone="success">Asset details saved.</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Cost', value: cost != null ? money(cost) : '—' },
            { label: 'Accumulated depreciation', value: money(dep.accumulated), sublabel: depLabel },
            { label: 'Book value', value: dep.bookValue != null ? money(dep.bookValue) : '—', sublabel: dep.basis === 'calculated' ? 'Cost less calculated depreciation' : undefined },
            { label: 'Status', value: label(asset.status) },
          ]}
        />

        <Surface>
          <SectionTitle title="Details" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] text-gray-500">{k}</dt>
                <dd className="text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Surface>

        {canEdit && options && (
          <Surface>
            <SectionTitle title="Edit asset" />
            {options.error && <Alert tone="danger" title="Could not load associations and units">{options.error}</Alert>}
            <form action={updateFixedAsset}>
              <input type="hidden" name="asset_id" value={asset.id} />
              <AssetFields associations={options.associations} units={options.units} asset={asset} />
              <div className="mt-5 border-t border-gray-100 pt-4">
                <Button type="submit">Save asset</Button>
              </div>
            </form>
            <form action={archiveFixedAsset} className="mt-4 border-t border-gray-100 pt-4">
              <input type="hidden" name="asset_id" value={asset.id} />
              <PendingSubmit variant="secondary" pendingLabel="Removing…" confirm="Remove this asset from the fixed assets list?">Remove from fixed assets</PendingSubmit>
              <span className="ml-3 text-xs text-gray-500">The record is kept; it no longer shows on the list or the Fixed Assets report.</span>
            </form>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
