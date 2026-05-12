import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createHomeownerCharge } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewHomeownerChargePage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: units }, { data: categories }] = await Promise.all([
    (supabase as any)
      .from('units')
      .select('id, unit_number, buildings(name, associations(name))')
      .is('archived_at', null)
      .order('unit_number')
      .limit(500),
    (supabase as any)
      .from('charge_categories')
      .select('id, name, default_amount')
      .eq('active', true)
      .order('name'),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Homeowner Charge</h1>
          <Link href="/charges" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createHomeownerCharge} className="space-y-4 border border-ink-100 bg-white p-5">
          <Field label="Unit">
            <select name="unit_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Select unit</option>
              {(units ?? []).map((unit: any) => (
                <option key={unit.id} value={unit.id}>
                  {unit.buildings?.associations?.name ?? unit.buildings?.name ?? 'Association'} - Unit {unit.unit_number}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Charge Category">
            <select name="charge_category_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Select category</option>
              {(categories ?? []).map((category: any) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount"><Input name="amount" required inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Due Date"><Input name="due_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          </div>

          <Field label="Description"><Input name="description" required /></Field>

          <div className="flex justify-end gap-2">
            <Link href="/charges" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save Charge</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
