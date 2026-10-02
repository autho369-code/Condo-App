import { fetchAllRows } from '@/lib/supabase/fetch-all';
import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type InventoryRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  quantity_on_hand: number;
  reorder_point: number | null;
  unit_of_measure: string | null;
  location: string | null;
  unit_cost: number | null;
  total_value: number | null;
};

function LowStockChip({ quantity, reorderPoint }: { quantity: number; reorderPoint: number | null }) {
  if (reorderPoint === null) return <StatusChip tone="neutral">No target</StatusChip>;
  if (quantity === 0) return <StatusChip tone="danger">Out of stock</StatusChip>;
  if (quantity <= reorderPoint) return <StatusChip tone="warning">Low stock</StatusChip>;
  return <StatusChip tone="success">In stock</StatusChip>;
}

function formatMoney(cents: number | null): string {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(cents);
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; location?: string; view?: string; archived?: string; removed?: string; added?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const category = sp.category ?? 'all';
  // Location filter values: '' all, 'none' no location, 'loc:<name>' one
  // location (prefixed, so a location named "none" or "all" still works).
  const locationParam = sp.location ?? '';
  const location = locationParam === 'none' ? 'none' : locationParam.startsWith('loc:') ? locationParam : '';
  const view = sp.view === 'categories' ? 'categories' : sp.view === 'locations' ? 'locations' : 'items';

  // Query inventory_items — if the table doesn't exist yet, supabase returns an error
  // that we catch gracefully so the page still renders with an empty list.
  let allRows: (InventoryRow & { category: string | null })[] = [];
  let queryError: string | null = null;
  let listTruncated = false;
  let removedItems: { id: string; name: string; category: string | null }[] = [];
  try {
    const supabase = await createClient();
    // Every item, paged past PostgREST's 1,000-row cap.
    const { rows: data, error: fetchError, truncated } = await fetchAllRows<any>(() => (supabase as any)
      .from('inventory_items')
      .select('id, name, sku, category, quantity_on_hand, reorder_point, unit_of_measure, location, unit_cost')
      .is('archived_at', null)
      .order('name')
      .order('id'));
    const error = fetchError ? { message: fetchError } : null;
    listTruncated = truncated;
    const { data: removedData } = sp.removed === '1'
      ? await (supabase as any).from('inventory_items').select('id, name, category, archived_at').not('archived_at', 'is', null).order('name')
      : { data: null };
    removedItems = (removedData ?? []) as { id: string; name: string; category: string | null }[];

    if (error) {
      queryError = error.message ?? 'Unknown database error';
    } else {
      allRows = (data ?? []).map((row: any) => ({
        ...row,
        quantity_on_hand: Number(row.quantity_on_hand ?? 0),
        reorder_point: row.reorder_point != null ? Number(row.reorder_point) : null,
        unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
        total_value:
          row.unit_cost != null && row.quantity_on_hand != null
            ? Number(row.unit_cost) * Number(row.quantity_on_hand)
            : null,
      }));
    }
  } catch (err: any) {
    queryError = err.message ?? 'Failed to load inventory';
  }

  // Filtering
  const categories: string[] = Array.from(
    new Set(allRows.map((row) => row.category).filter(Boolean) as string[]),
  ).sort();
  let rows = allRows;
  const locations: string[] = Array.from(
    new Set(allRows.map((row) => row.location).filter(Boolean) as string[]),
  ).sort();
  if (category !== 'all') rows = rows.filter((row) => row.category === category);
  if (location === 'none') rows = rows.filter((row) => !row.location);
  else if (location) rows = rows.filter((row) => row.location === location.slice(4));
  if (q) {
    rows = rows.filter((row) =>
      [row.name, row.sku, row.category, row.location, row.unit_of_measure].some((value) =>
        value?.toLowerCase().includes(q),
      ),
    );
  }

  // Metrics
  const totalItems = allRows.length;
  const lowStock = allRows.filter((row) => row.reorder_point != null && row.quantity_on_hand <= row.reorder_point).length;
  const outOfStock = allRows.filter((row) => row.quantity_on_hand === 0).length;
  const totalValue = allRows.reduce((sum, row) => sum + (row.total_value ?? 0), 0);

  return (
    <DataWorkspace
      title="Inventory"
      description="Consumables and parts kept on-hand for common maintenance — filters, bulbs, paint, hardware."
      actions={
        <>
          <Link href="/inventory/bulk"><Button variant="secondary">Bulk add items</Button></Link>
          <Link href="/inventory/new"><Button>New Inventory Item</Button></Link>
        </>
      }
    >
      <div className="space-y-4">
        {listTruncated && <Alert tone="warning" title="List is incomplete">There are more inventory items than this page can load. Filter by category or location.</Alert>}
        {sp.added && <Alert tone="success">{`${sp.added} item${sp.added === '1' ? '' : 's'} added to inventory.`}</Alert>}
        {sp.archived && <Alert tone="success">Item removed from inventory. Its history stays in the Inventory Usage report.</Alert>}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          <Link
            href="/inventory"
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${view === 'items' ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 transition-colors hover:text-gray-700'}`}
          >
            All Items
          </Link>
          <Link
            href="/inventory?view=categories"
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${view === 'categories' ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 transition-colors hover:text-gray-700'}`}
          >
            Categories
          </Link>
          <Link
            href="/inventory?view=locations"
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${view === 'locations' ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 transition-colors hover:text-gray-700'}`}
          >
            Locations
          </Link>
          <Link
            href="/reports/inventory_status"
            className="whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Inventory Status report
          </Link>
          <Link
            href="/reports/inventory_usage"
            className="whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            Inventory Usage report
          </Link>
        </nav>

        <MetricStrip
          metrics={[
            { label: 'Total items', value: totalItems },
            {
              label: 'Low stock',
              value: lowStock,
              sublabel: lowStock > 0 ? `${outOfStock} out of stock` : undefined,
            },
            {
              label: 'Total value',
              value: formatMoney(totalValue),
            },
            {
              label: 'Categories',
              value: categories.length,
            },
          ]}
        />

        <FilterBar
          action="/inventory"
          searchDefault={sp.q ?? ''}
          searchPlaceholder="Search item name, SKU, category, or location"
        >
          <FilterSelect label="Category" name="category" defaultValue={category}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Location" name="location" defaultValue={location}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l} value={`loc:${l}`}>
                {l}
              </option>
            ))}
            <option value="none">No location</option>
          </FilterSelect>
        </FilterBar>

        {queryError ? (
          <Alert tone="danger" title="Could not load inventory.">{queryError}</Alert>
        ) : view === 'locations' ? (
          <Table>
            <THead>
              <TR>
                <TH>Location</TH>
                <TH>Items</TH>
                <TH>Total Quantity</TH>
                <TH>Total Value</TH>
              </TR>
            </THead>
            <tbody>
              {allRows.length === 0 ? (
                <TR>
                  <TD colSpan={4} className="py-10 text-center text-gray-500">
                    No inventory items yet. Use New Inventory Item to add your first item.
                  </TD>
                </TR>
              ) : (
                [
                  ...locations.map((name) => ({ key: `loc:${name}`, label: name, none: false })),
                  ...(allRows.some((r) => !r.location) ? [{ key: 'none', label: 'No location', none: true }] : []),
                ].map(({ key, label, none }) => {
                  const items = allRows.filter((r) => (none ? !r.location : r.location === label));
                  return (
                    <TR key={key} className="hover:bg-gray-50">
                      <TD>
                        <Link href={`/inventory?location=${encodeURIComponent(key)}`} className={`font-medium hover:underline ${none ? 'text-gray-500' : 'text-gray-950'}`}>
                          {label}
                        </Link>
                      </TD>
                      <TD className="tabular-nums text-gray-900">{items.length}</TD>
                      <TD className="tabular-nums text-gray-900">{items.reduce((s, r) => s + r.quantity_on_hand, 0)}</TD>
                      <TD className="tabular-nums text-gray-900">{formatMoney(items.reduce((s, r) => s + (r.total_value ?? 0), 0))}</TD>
                    </TR>
                  );
                })
              )}
            </tbody>
          </Table>
        ) : view === 'categories' ? (
          <Table>
            <THead>
              <TR>
                <TH>Category</TH>
                <TH>Items</TH>
                <TH>Total Quantity</TH>
                <TH>Total Value</TH>
              </TR>
            </THead>
            <tbody>
              {categories.length === 0 && allRows.every((r) => !r.category) && allRows.length === 0 ? (
                <TR>
                  <TD colSpan={4} className="py-10 text-center text-gray-500">
                    No inventory items yet. Use New Inventory Item to add your first item.
                  </TD>
                </TR>
              ) : (
                [...categories, ...(allRows.some((r) => !r.category) ? ['Uncategorized'] : [])].map((c) => {
                  const items = allRows.filter((r) => (c === 'Uncategorized' ? !r.category : r.category === c));
                  return (
                    <TR key={c} className="hover:bg-gray-50">
                      <TD>
                        <Link href={c === 'Uncategorized' ? '/inventory' : `/inventory?category=${encodeURIComponent(c)}`} className="font-medium text-gray-950 hover:underline">
                          {c}
                        </Link>
                      </TD>
                      <TD className="tabular-nums text-gray-900">{items.length}</TD>
                      <TD className="tabular-nums text-gray-900">{items.reduce((s, r) => s + r.quantity_on_hand, 0)}</TD>
                      <TD className="tabular-nums text-gray-900">{formatMoney(items.reduce((s, r) => s + (r.total_value ?? 0), 0))}</TD>
                    </TR>
                  );
                })
              )}
            </tbody>
          </Table>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Item Name</TH>
                <TH>SKU</TH>
                <TH>Category</TH>
                <TH>Quantity</TH>
                <TH>Unit</TH>
                <TH>Location</TH>
                <TH>Unit Cost</TH>
                <TH>Total Value</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {rows.length === 0 ? (
                <TR>
                  <TD colSpan={9} className="py-10 text-center text-gray-500">
                    {allRows.length === 0
                      ? 'No inventory items yet. Use New Inventory Item to add your first item.'
                      : 'No items match this filter.'}
                  </TD>
                </TR>
              ) : (
                rows.map((row) => (
                  <TR key={row.id} className="hover:bg-gray-50">
                    <TD>
                      <Link href={`/inventory/${row.id}`} className="font-medium text-gray-950 hover:underline">{row.name}</Link>
                    </TD>
                    <TD>
                      <span className="font-mono text-xs text-gray-600">
                        {row.sku ?? '—'}
                      </span>
                    </TD>
                    <TD>
                      {row.category ? (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          {row.category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TD>
                    <TD>
                      <span
                        className={
                          row.reorder_point != null && row.quantity_on_hand <= row.reorder_point
                            ? 'font-semibold text-amber-700'
                            : 'text-gray-900'
                        }
                      >
                        {row.quantity_on_hand}
                      </span>
                    </TD>
                    <TD className="text-gray-600">{row.unit_of_measure ?? '—'}</TD>
                    <TD className="text-gray-600">{row.location ?? '—'}</TD>
                    <TD className="tabular-nums text-gray-900">
                      {formatMoney(row.unit_cost)}
                    </TD>
                    <TD className="tabular-nums text-gray-900">
                      {formatMoney(row.total_value)}
                    </TD>
                    <TD>
                      <LowStockChip
                        quantity={row.quantity_on_hand}
                        reorderPoint={row.reorder_point}
                      />
                    </TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        )}
        <div className="text-sm">
          {sp.removed === '1' ? (
            <div className="space-y-2">
              <Link href="/inventory" className="text-gray-500 underline underline-offset-4 hover:text-gray-900">Hide removed items</Link>
              {removedItems.length === 0 ? (
                <p className="text-gray-500">No removed items.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {removedItems.map((r) => (
                    <li key={r.id}><Link href={`/inventory/${r.id}`} className="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">{r.name}</Link></li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <Link href="/inventory?removed=1" className="text-gray-500 underline underline-offset-4 hover:text-gray-900">Show removed items</Link>
          )}
        </div>
      </div>
    </DataWorkspace>
  );
}
