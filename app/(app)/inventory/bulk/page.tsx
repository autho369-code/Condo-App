import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_LINES = 500;
const COLUMNS = ['Name', 'Quantity', 'Category', 'Location', 'Reorder point', 'Unit cost', 'SKU', 'Unit'];

/** Splits one comma-separated line; a field may be wrapped in double quotes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export default async function BulkInventoryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;

  async function bulkAdd(formData: FormData) {
    'use server';
    await requireStaff();
    const fail = (message: string): never => redirect('/inventory/bulk?error=' + encodeURIComponent(message));
    const text = String(formData.get('items') ?? '');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // A header row copied from a spreadsheet is skipped.
    if (lines.length && /^name\s*,/i.test(lines[0])) lines.shift();
    if (lines.length === 0) fail('Enter at least one item, one per line.');
    if (lines.length > MAX_LINES) fail(`Add at most ${MAX_LINES} items at a time.`);

    const num = (raw: string | undefined, lineNo: number, label: string) => {
      if (!raw) return null;
      const n = Number(raw.replace(/[$,]/g, ''));
      if (!Number.isFinite(n) || n < 0) fail(`Line ${lineNo}: ${label} "${raw}" must be a number of 0 or more.`);
      return n;
    };

    const rows = lines.map((line, i) => {
      const lineNo = i + 1;
      const [name, qty, category, location, reorder, cost, sku, unit] = splitLine(line);
      if (!name) fail(`Line ${lineNo}: the item name is missing.`);
      return {
        name,
        quantity_on_hand: num(qty, lineNo, 'Quantity') ?? 0,
        category: category || null,
        location: location || null,
        reorder_point: num(reorder, lineNo, 'Reorder point'),
        unit_cost: num(cost, lineNo, 'Unit cost'),
        sku: sku || null,
        ...(unit ? { unit_of_measure: unit } : {}),
      };
    });

    // One insert: every line is added, or none is.
    const supabase = await createClient();
    const { data, error } = await (supabase as any).from('inventory_items').insert(rows).select('id');
    if (error) fail(error.message);
    redirect(`/inventory?added=${(data ?? []).length}`);
  }

  return (
    <DataWorkspace
      title="Bulk add inventory items"
      description="Paste or type one item per line to add many items at once."
      actions={<Link href="/inventory"><Button variant="secondary">Back to inventory</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not add items">{sp.error}</Alert>}
        <form action={bulkAdd}>
          <Surface>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                One item per line, fields separated by commas, in this order:{' '}
                <span className="font-medium text-gray-900">{COLUMNS.join(', ')}</span>. Only the name is required;
                leave a field empty to skip it. Up to {MAX_LINES} lines. If any line has a problem, nothing is added.
              </p>
              <Field label="Items">
                <textarea
                  name="items"
                  required
                  rows={12}
                  placeholder={'Furnace filter 16x25x1, 24, Filters, Bldg A basement, 6, 8.50\nLED bulb A19, 40, Bulbs, Storage room, 10, 3.25'}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
                <Button type="submit">Add items</Button>
              </div>
            </div>
          </Surface>
        </form>
      </div>
    </DataWorkspace>
  );
}
