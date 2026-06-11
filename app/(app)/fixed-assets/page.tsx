import Link from 'next/link';
import { Boxes, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireStaff();
  const { status: statusParam, q = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // ── FETCH: fixed_assets with association name joined ──
  const { data: assets } = await db
    .from('fixed_assets')
    .select(
      'id, name, asset_type, status, purchase_date, purchase_price, accumulated_depreciation, salvage_value, depreciation_method, useful_life_years, description, created_at, association_id, associations(name)'
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = (assets ?? []) as any[];

  // ── FILTER by status ──
  let filtered = rows;
  if (statusParam && statusParam !== 'all') {
    filtered = filtered.filter((a: any) => a.status === statusParam);
  }

  // ── SEARCH ──
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter(
      (a: any) =>
        (a.name ?? '').toLowerCase().includes(ql) ||
        (a.asset_type ?? '').toLowerCase().includes(ql) ||
        (a.associations?.name ?? '').toLowerCase().includes(ql) ||
        (a.description ?? '').toLowerCase().includes(ql)
    );
  }

  // ── METRICS ──
  const activeCount = rows.filter((a: any) => a.status === 'active').length;
  const disposedCount = rows.filter((a: any) => a.status === 'disposed').length;
  const soldCount = rows.filter((a: any) => a.status === 'sold').length;
  const fullyDepCount = rows.filter((a: any) => a.status === 'fully_depreciated').length;

  const totalPurchasePrice = rows.reduce(
    (s: number, a: any) => s + Number(a.purchase_price ?? 0),
    0
  );
  const totalCurrentValue = rows.reduce(
    (s: number, a: any) =>
      s + Number(a.purchase_price ?? 0) - Number(a.accumulated_depreciation ?? 0),
    0
  );

  const metrics: Metric[] = [
    { label: 'Active', value: activeCount },
    { label: 'Disposed', value: disposedCount },
    { label: 'Sold', value: soldCount },
    { label: 'Fully depreciated', value: fullyDepCount },
    { label: 'Total purchase', value: money(totalPurchasePrice) },
    { label: 'Current value', value: money(totalCurrentValue) },
  ];

  return (
    <DataWorkspace
      title="Fixed Assets"
      description="Track association property, equipment, and capital assets — purchase details, depreciation schedules, and disposal records."
      actions={
        <Link href="/fixed-assets/new">
          <Button><Plus className="h-4 w-4" /> New asset</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        {/* ── STATUS FILTERS ── */}
        <nav className="flex flex-wrap gap-1">
          <StatusFilterLink
            current={statusParam ?? 'all'}
            value="all"
            label="All"
            q={q}
          />
          <StatusFilterLink
            current={statusParam ?? 'all'}
            value="active"
            label="Active"
            q={q}
          />
          <StatusFilterLink
            current={statusParam ?? 'all'}
            value="disposed"
            label="Disposed"
            q={q}
          />
          <StatusFilterLink
            current={statusParam ?? 'all'}
            value="sold"
            label="Sold"
            q={q}
          />
          <StatusFilterLink
            current={statusParam ?? 'all'}
            value="fully_depreciated"
            label="Fully Depreciated"
            q={q}
          />
        </nav>

        {/* ── SEARCH ── */}
        <FilterBar action="/fixed-assets" searchDefault={q} searchPlaceholder="Search asset name, category, association...">
          {statusParam && statusParam !== 'all' && (
            <input type="hidden" name="status" value={statusParam} />
          )}
        </FilterBar>

        {/* ── FIXED ASSETS TABLE ── */}
        {filtered.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Asset Name</TH>
                <TH>Category</TH>
                <TH>Association</TH>
                <TH>Purchase Date</TH>
                <TH className="text-right">Purchase Price</TH>
                <TH className="text-right">Current Value</TH>
                <TH>Depreciation</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((asset: any) => {
                const currentValue =
                  Number(asset.purchase_price ?? 0) -
                  Number(asset.accumulated_depreciation ?? 0);

                return (
                  <TR key={asset.id}>
                    <TD className="font-medium text-gray-900">
                      {asset.name}
                      {asset.description && (
                        <div className="text-xs text-gray-500 mt-0.5 max-w-[260px] truncate">
                          {asset.description}
                        </div>
                      )}
                    </TD>
                    <TD className="text-sm text-gray-700">
                      {formatAssetType(asset.asset_type)}
                    </TD>
                    <TD className="text-sm text-gray-700">
                      {asset.associations?.name ?? '—'}
                    </TD>
                    <TD className="whitespace-nowrap text-sm tabular-nums text-gray-600">
                      {date(asset.purchase_date)}
                    </TD>
                    <TD className="text-right tabular-nums font-medium text-gray-900">
                      {money(asset.purchase_price)}
                    </TD>
                    <TD className="text-right tabular-nums font-medium text-gray-900">
                      {money(currentValue)}
                    </TD>
                    <TD className="text-sm text-gray-600">
                      <span className="capitalize">
                        {(asset.depreciation_method ?? 'none').replace(/_/g, ' ')}
                      </span>
                      {asset.useful_life_years && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({asset.useful_life_years}y)
                        </span>
                      )}
                    </TD>
                    <TD>
                      <AssetStatusChip status={asset.status} />
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
              title={
                q || (statusParam && statusParam !== 'all')
                  ? 'No fixed assets match this filter'
                  : 'No fixed assets recorded yet'
              }
              description="Track association property, equipment, and capital assets here."
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

// ── HELPERS ──

function formatAssetType(assetType: string | null): string {
  if (!assetType) return '—';
  return assetType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function AssetStatusChip({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <StatusChip tone="success">Active</StatusChip>;
    case 'disposed':
      return <StatusChip tone="neutral">Disposed</StatusChip>;
    case 'sold':
      return <StatusChip tone="info">Sold</StatusChip>;
    case 'fully_depreciated':
      return <StatusChip tone="warning">Fully Depreciated</StatusChip>;
    default:
      return <StatusChip tone="neutral">{status}</StatusChip>;
  }
}

function StatusFilterLink({
  current,
  value,
  label,
  q,
}: {
  current: string;
  value: string;
  label: string;
  q: string;
}) {
  const active = current === value;
  const params = new URLSearchParams();
  if (value !== 'all') params.set('status', value);
  if (q) params.set('q', q);
  const href = params.toString()
    ? `/fixed-assets?${params.toString()}`
    : '/fixed-assets';

  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-gray-900 text-white'
          : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );
}
