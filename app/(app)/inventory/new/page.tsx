import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewInventoryItemPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;

  async function createItem(formData: FormData) {
    'use server';
    await requireStaff();
    const supabase = await createClient();
    const name = (formData.get('name') as string)?.trim();
    if (!name) redirect('/inventory/new?error=' + encodeURIComponent('Item name is required.'));

    const num = (key: string) => {
      const raw = (formData.get(key) as string)?.trim();
      if (!raw) return null;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : null;
    };

    const { error } = await (supabase as any).from('inventory_items').insert({
      name,
      sku: (formData.get('sku') as string)?.trim() || null,
      category: (formData.get('category') as string)?.trim() || null,
      quantity_on_hand: num('quantity_on_hand') ?? 0,
      reorder_point: num('reorder_point'),
      unit_of_measure: (formData.get('unit_of_measure') as string)?.trim() || null,
      location: (formData.get('location') as string)?.trim() || null,
      unit_cost: num('unit_cost'),
    });
    if (error) redirect('/inventory/new?error=' + encodeURIComponent(error.message));
    redirect('/inventory');
  }

  return (
    <DataWorkspace
      title="New inventory item"
      description="Add a part, supply, or consumable to the managed inventory."
      actions={<Link href="/inventory"><Button variant="secondary">Back to inventory</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not create item">{sp.error}</Alert>}
        <form action={createItem}>
          <Surface>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Item name">
                <Input name="name" required placeholder="e.g. Furnace filter 16x25x1" />
              </Field>
              <Field label="SKU (optional)">
                <Input name="sku" placeholder="e.g. FLT-1625" />
              </Field>
              <Field label="Category (optional)">
                <Input name="category" placeholder="e.g. Filters, Bulbs, Hardware" />
              </Field>
              <Field label="Storage location (optional)">
                <Input name="location" placeholder="e.g. Bldg A basement shelf 3" />
              </Field>
              <Field label="Quantity on hand">
                <Input name="quantity_on_hand" type="number" step="1" min="0" defaultValue="0" />
              </Field>
              <Field label="Reorder point (optional)">
                <Input name="reorder_point" type="number" step="1" min="0" placeholder="Alert when at or below" />
              </Field>
              <Field label="Unit of measure (optional)">
                <Input name="unit_of_measure" placeholder="e.g. each, box, gallon" />
              </Field>
              <Field label="Unit cost (optional)">
                <Input name="unit_cost" type="number" step="0.01" min="0" placeholder="$0.00" />
              </Field>
            </div>
          </Surface>
          <div className="mt-6">
            <Button type="submit">Create item</Button>
          </div>
        </form>
      </div>
    </DataWorkspace>
  );
}
