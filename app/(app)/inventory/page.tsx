import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { inventoryWorkflowCards } from '@/lib/inventory/workflows';

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
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const category = sp.category ?? 'all';

  // Query inventory_items — if the table doesn't exist yet, supabase returns an error
  // that we catch gracefully so the page still renders with an empty list.
  let allRows: (InventoryRow & { category: string | null })[] = [];
  let queryError: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from('inventory_items')
      .select('id, name, sku, category, quantity_on_hand, reorder_point, unit_of_measure, location, unit_cost')
      .order('name');

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
  if (category !== 'all') rows = rows.filter((row) => row.category === category);
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
      rail={
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-500">Inventory tasks</div>
            <div className="mt-2 space-y-2">
              {inventoryWorkflowCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="block rounded border border-gray-200 p-3 hover:border-brand-300 hover:bg-brand-50"
                >
                  <div className="font-medium text-gray-950">{card.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{card.description}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Stock adjustments and new items are review-first workflows. Changes are logged for audit.
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <nav className="flex flex-wrap gap-5 border-b border-gray-200 text-sm">
          <Link
            href="/inventory"
            className="border-b-2 border-brand-600 px-1 pb-2 font-semibold text-brand-700"
          >
            All Items
          </Link>
          <Link
            href="/inventory?view=categories"
            className="border-b-2 border-transparent px-1 pb-2 text-gray-500 hover:text-gray-900"
          >
            Categories
          </Link>
          <Link
            href="/reports/inventory"
            className="border-b-2 border-transparent px-1 pb-2 text-gray-500 hover:text-gray-900"
          >
            Reports
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
          <label className="text-xs font-medium uppercase text-gray-500">
            Category
            <select
              name="category"
              defaultValue={category}
              className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </FilterBar>

        {queryError ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="font-medium text-amber-800">Inventory table not available</p>
            <p className="mt-1 text-sm text-amber-700">
              The <code className="rounded bg-amber-100 px-1 text-xs">inventory_items</code> table
              has not been created yet in Supabase. Run the migration to enable inventory management.
            </p>
            <p className="mt-1 text-xs text-amber-600">{queryError}</p>
          </div>
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
                      <div className="font-medium text-gray-950">{row.name}</div>
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
      </div>
    </DataWorkspace>
  );
}
