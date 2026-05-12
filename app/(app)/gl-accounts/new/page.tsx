import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createGLAccount } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewGLAccountPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">New GL Account</h1>
          <Link href="/gl-accounts" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createGLAccount} className="space-y-4 border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <Field label="Number"><Input name="number" required inputMode="numeric" /></Field>
            <Field label="Name"><Input name="name" required /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <select name="account_type" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select type</option>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="cash">Cash</option>
              </select>
            </Field>
            <Field label="Fund Account">
              <select name="fund_account" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">None</option>
                <option value="operating">Operating</option>
                <option value="reserve">Reserve</option>
                <option value="special_assessment">Special Assessment</option>
              </select>
            </Field>
          </div>

          <Field label="Association">
            <select name="association_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Portfolio-level</option>
              {(associations ?? []).map((association: any) => (
                <option key={association.id} value={association.id}>{association.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Description"><textarea name="description" rows={3} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" /></Field>
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="include_on_cash_flow" /> Include on cash flow</label>
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="subject_to_management_fees" /> Subject to management fees</label>

          <div className="flex justify-end gap-2">
            <Link href="/gl-accounts" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save GL Account</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
