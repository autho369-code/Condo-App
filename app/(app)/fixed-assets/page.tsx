import Link from 'next/link';
import { Boxes, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { ASSET_STATUSES, label } from '@/components/fixed-assets/asset-fields';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { money, date } from '@/lib/utils';
import { depreciationToDate } from '@/lib/fixed-assets/depreciation';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; association?: string; type?: string; removed?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const status = ASSET_STATUSES.includes(sp.status ?? '') ? sp.status! : 'all';
  const association = UUID.test(sp.association ?? '') ? sp.association! : '';
  const type = (sp.type ?? '').trim();
  const q = (sp.q ?? '').trim();
  const db = (await createClient()) as any;

  const [assetResult, assocResult] = await Promise.all([
    fetchAllRows<any>(() => db
      .from('fixed_assets')
      .select('id, name, asset_type, status, make, model, serial_number, placed_in_service_date, warranty_expiration_date, purchase_date, purchase_price, salvage_value, useful_life_years, depreciation_method, accumulated_depreciation, disposed_at, description, association_id, associations(name), units(unit_number)')
      .is('archived_at', null)
      .order('name')
      .order('id'), { maxRows: 20000 }),
    fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id')),
  ]);
  const today = todayInZone();
  // Book value uses straight-line depreciation calculated to today (display
  // only; nothing is posted to the ledger). See lib/fixed-assets/depreciation.
  const rows = assetResult.rows.map((a) => ({ ...a, dep: depreciationToDate(a, today) }));
  const loadError = assetResult.error ?? assocResult.error;

  const types = [...new Set(rows.map((a) => (a.asset_type ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const ql = q.toLowerCase();
  const filtered = rows.filter((a) =>
    (status === 'all' || a.status === status) &&
    (!association || a.association_id === association) &&
    (!type || (a.asset_type ?? '').trim() === type) &&
    (!ql || [a.name, a.asset_type, a.make, a.model, a.serial_number, a.description, a.associations?.name, a.units?.unit_number]
      .some((v) => String(v ?? '').toLowerCase().includes(ql))));

  const in90 = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 90);
    return d.toISOString().slice(0, 10);
  })();
  const active = rows.filter((a) => a.status === 'active');
  const expiringSoon = active.filter((a) => a.warranty_expiration_date && a.warranty_expiration_date >= today && a.warranty_expiration_date <= in90).length;
  // Value totals cover assets still in service (disposed and sold assets are
  // off the books) and follow the filters shown, like the table below.
  const inService = filtered.filter((a) => a.status === 'active' || a.status === 'fully_depreciated');
  const cost = inService.reduce((s, a) => s + Number(a.purchase_price ?? 0), 0);
  const book = inService.reduce((s, a) => s + (a.dep.bookValue ?? 0), 0);
  const partial = assetResult.truncated || !!assetResult.error;
  const filtering = status !== 'all' || association || type || q;
  const valueScope = filtering ? 'In service, matching filters' : 'Active and fully depreciated';
  const metrics: Metric[] = [
    { label: 'Active', value: partial ? '—' : active.length },
    { label: 'Warranties ending in 90 days', value: partial ? '—' : expiringSoon },
    { label: 'Cost in service', value: partial ? '—' : money(cost), sublabel: valueScope },
    { label: 'Book value in service', value: partial ? '—' : money(book), sublabel: `${valueScope} · calculated straight-line to today` },
  ];

  const statusHref = (value: string) => {
    const p = new URLSearchParams();
    if (value !== 'all') p.set('status', value);
    if (association) p.set('association', association);
    if (type) p.set('type', type);
    if (q) p.set('q', q);
    return p.toString() ? `/fixed-assets?${p}` : '/fixed-assets';
  };

  return (
    <DataWorkspace
      title="Fixed Assets"
      description="Equipment, appliances and other capital assets at each association: where they are, warranty, and value."
      actions={
        <Link href="/fixed-assets/new">
          <Button><Plus className="h-4 w-4" /> Add fixed asset</Button>
        </Link>
      }
    >
      <div className="space-y-4">
        {loadError && <Alert tone="danger" title="Could not load fixed assets">{loadError}</Alert>}
        {assetResult.truncated && <Alert tone="warning" title="List is incomplete">There are more fixed assets than this page can load.</Alert>}
        {sp.removed && <Alert tone="success">Asset removed from fixed assets.</Alert>}

        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {['all', ...ASSET_STATUSES].map((s) => (
            <Link
              key={s}
              href={statusHref(s)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${status === s ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 transition-colors hover:text-gray-700'}`}
            >
              {s === 'all' ? 'All' : label(s)}
            </Link>
          ))}
          <Link
            href="/reports/fixed_assets"
            className="whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Fixed Assets report
          </Link>
        </nav>

        <MetricStrip metrics={metrics} />

        <FilterBar action="/fixed-assets" searchDefault={q} searchPlaceholder="Search name, make, model, serial number...">
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <FilterSelect label="Association" name="association" defaultValue={association}>
            <option value="">All associations</option>
            {assocResult.rows.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Type" name="type" defaultValue={type}>
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
        </FilterBar>

        {filtered.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Asset</TH>
                <TH>Type</TH>
                <TH>Association</TH>
                <TH>Unit</TH>
                <TH>Status</TH>
                <TH>Placed in service</TH>
                <TH>Warranty expiration</TH>
                <TH>Serial number</TH>
                <TH className="text-right">Cost</TH>
                <TH className="text-right" title="Cost less straight-line depreciation calculated to today">Book value (calc.)</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((a) => {
                const expired = a.warranty_expiration_date && a.warranty_expiration_date < today;
                return (
                  <TR key={a.id}>
                    <TD className="font-medium text-gray-900">
                      <Link href={`/fixed-assets/${a.id}`} className="underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">{a.name}</Link>
                      {(a.make || a.model) && <div className="mt-0.5 text-xs text-gray-500">{[a.make, a.model].filter(Boolean).join(' ')}</div>}
                    </TD>
                    <TD className="text-sm text-gray-700">{a.asset_type ?? '—'}</TD>
                    <TD className="text-sm text-gray-700">{a.associations?.name ?? '—'}</TD>
                    <TD className="text-sm text-gray-700">{a.units?.unit_number ?? '—'}</TD>
                    <TD><AssetStatusChip status={a.status} /></TD>
                    <TD className="whitespace-nowrap text-sm tabular-nums text-gray-600">{date(a.placed_in_service_date)}</TD>
                    <TD className="whitespace-nowrap text-sm tabular-nums text-gray-600">
                      {date(a.warranty_expiration_date)}
                      {expired && <span className="ml-2"><StatusChip tone="neutral">Expired</StatusChip></span>}
                    </TD>
                    <TD className="text-sm text-gray-600">{a.serial_number ?? '—'}</TD>
                    <TD className="text-right tabular-nums text-gray-900">{a.purchase_price != null ? money(a.purchase_price) : '—'}</TD>
                    <TD className="text-right tabular-nums text-gray-900">
                      {a.dep.bookValue != null ? money(a.dep.bookValue) : '—'}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={Boxes}
              title={filtering ? 'No fixed assets match this filter' : 'No fixed assets recorded yet'}
              description="Add association equipment, appliances and other capital assets here."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

function AssetStatusChip({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <StatusChip tone="success">Active</StatusChip>;
    case 'sold':
      return <StatusChip tone="info">Sold</StatusChip>;
    case 'fully_depreciated':
      return <StatusChip tone="warning">Fully depreciated</StatusChip>;
    default:
      return <StatusChip tone="neutral">{label(status)}</StatusChip>;
  }
}
