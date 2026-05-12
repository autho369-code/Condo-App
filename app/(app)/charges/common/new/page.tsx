import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createCommonAssociationCharge } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewCommonChargePage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  await requireStaff();
  const { posted } = await searchParams;
  const supabase = await createClient();
  const [{ data: associations }, { data: categories }] = await Promise.all([
    (supabase as any)
      .from('associations')
      .select('id, name, units:buildings(units(id))')
      .is('archived_at', null)
      .order('name'),
    (supabase as any)
      .from('charge_categories')
      .select('id, name, default_amount')
      .eq('active', true)
      .order('name'),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Common Charge</h1>
          <Link href="/charges" className="text-sm text-ink-600 hover:text-ink-900">Back to Receipts</Link>
        </div>

        {posted !== undefined && (
          <div className="border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-900">
            Posted {posted} charge{posted === '1' ? '' : 's'}.
          </div>
        )}

        <form action={createCommonAssociationCharge} className="space-y-4 border border-ink-100 bg-white p-5">
          <Field label="Association">
            <select name="association_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Select association</option>
              {(associations ?? []).map((association: any) => (
                <option key={association.id} value={association.id}>{association.name}</option>
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
            <Button type="submit">Post Common Charge</Button>
          </div>
        </form>

        {associations && associations.length > 0 && (
          <Table>
            <THead>
              <TR><TH>Association</TH><TH>Units</TH></TR>
            </THead>
            <tbody>
              {associations.map((association: any) => (
                <TR key={association.id}>
                  <TD>{association.name}</TD>
                  <TD>{unitCount(association)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </main>
    </div>
  );
}

function unitCount(association: any) {
  return (association.units ?? []).reduce((sum: number, building: any) => sum + (building.units?.length ?? 0), 0);
}
