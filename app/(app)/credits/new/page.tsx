import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createOwnerCredit } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewOwnerCreditPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: units }, { data: bankAccounts }, { data: glAccounts }] = await Promise.all([
    (supabase as any)
      .from('units')
      .select('id, unit_number, buildings(name, associations(name))')
      .is('archived_at', null)
      .order('unit_number')
      .limit(500),
    (supabase as any)
      .from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .order('name'),
    (supabase as any)
      .from('gl_accounts')
      .select('id, number, name')
      .eq('active', true)
      .order('number')
      .limit(500),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Owner Credit</h1>
          <Link href="/charges" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createOwnerCredit} className="space-y-4 border border-ink-100 bg-white p-5">
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

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Credit Amount"><Input name="amount" required inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Credit Date"><Input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Reference"><Input name="reference" placeholder="Credit memo, approval, or adjustment #" /></Field>
            <Field label="Reason"><Input name="reason" placeholder="Board approved credit, overpayment transfer..." /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bank Account">
              <select name="bank_account_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">No bank account</option>
                {(bankAccounts ?? []).map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.bank_name ? ` - ${account.bank_name}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="GL Account">
              <select name="gl_account_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">No GL account</option>
                {(glAccounts ?? []).map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.number} - {account.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea name="notes" rows={4} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
          </Field>

          <div className="rounded border border-amber-200 bg-champagne-50 p-3 text-sm text-amber-800">
            This saves a credit on the owner ledger. Use Apply Credits to allocate it to open charges.
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/charges" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save Credit</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
