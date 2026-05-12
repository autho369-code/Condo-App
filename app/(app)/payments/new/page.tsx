import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createHomeownerReceipt } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewHomeownerReceiptPage() {
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
      .select('id, number, name, account_type')
      .eq('active', true)
      .order('number'),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Homeowner Receipt</h1>
          <Link href="/charges" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createHomeownerReceipt} className="space-y-4 border border-ink-100 bg-white p-5">
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
            <Field label="Amount"><Input name="amount" required inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Payment Date"><Input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Method">
              <select name="method" defaultValue="check" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="check">Check</option>
                <option value="ach">ACH</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="lockbox">Lockbox</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Reference"><Input name="reference" /></Field>
          </div>

          <Field label="Bank Account">
            <select name="bank_account_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Select bank account</option>
              {(bankAccounts ?? []).map((account: any) => (
                <option key={account.id} value={account.id}>{account.name}{account.bank_name ? ` - ${account.bank_name}` : ''}</option>
              ))}
            </select>
          </Field>

          <Field label="GL Account">
            <select name="gl_account_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Auto apply</option>
              {(glAccounts ?? []).map((account: any) => (
                <option key={account.id} value={account.id}>{account.number}: {account.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea name="notes" rows={3} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
          </Field>

          <div className="flex justify-end gap-2">
            <Link href="/charges" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save Receipt</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
