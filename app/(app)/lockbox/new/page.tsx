import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createLockboxBatch } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewLockboxBatchPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: bankAccounts }, { data: associations }, { data: units }] = await Promise.all([
    (supabase as any).from('bank_accounts').select('id, name, bank_name').is('archived_at', null).order('name'),
    (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name'),
    (supabase as any)
      .from('units')
      .select('id, unit_number, buildings(name, associations(name))')
      .is('archived_at', null)
      .order('unit_number')
      .limit(500),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">New Lockbox Batch</h1>
          <Link href="/lockbox" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createLockboxBatch} className="space-y-4 border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Provider"><Input name="provider" required placeholder="Bank lockbox provider" /></Field>
            <Field label="Provider Batch ID"><Input name="provider_batch_id" /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Received Date"><Input name="received_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Batch Date"><Input name="batch_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          </div>

          <Field label="Bank Account">
            <select name="bank_account_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Not assigned</option>
              {(bankAccounts ?? []).map((account: any) => (
                <option key={account.id} value={account.id}>{account.name}{account.bank_name ? ` - ${account.bank_name}` : ''}</option>
              ))}
            </select>
          </Field>

          <Field label="Deposit Reference"><Input name="deposit_reference" /></Field>

          <section className="space-y-4 border-t border-ink-100 pt-4">
            <h2 className="text-sm font-semibold text-ink-900">First Check Item</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Payer Name"><Input name="payer_name" /></Field>
              <Field label="Check Number"><Input name="check_number" /></Field>
            </div>
            <Field label="Check Amount"><Input name="check_amount" inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Association">
              <select name="association_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select association</option>
                {(associations ?? []).map((association: any) => (
                  <option key={association.id} value={association.id}>{association.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Matched Unit">
              <select name="unit_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Leave unmatched</option>
                {(units ?? []).map((unit: any) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.buildings?.associations?.name ?? unit.buildings?.name ?? 'Association'} - Unit {unit.unit_number}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Routing Number"><Input name="routing_number" /></Field>
              <Field label="Masked Account"><Input name="account_number_masked" placeholder="****1234" /></Field>
            </div>
          </section>

          <Field label="Notes"><textarea name="notes" rows={3} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" /></Field>

          <div className="flex justify-end gap-2">
            <Link href="/lockbox" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save Lockbox Batch</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
