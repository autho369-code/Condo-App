import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createBulkChargesOrCredits } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BulkChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; posted?: string; kind?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: associations }, { data: units }, { data: categories }, { data: bankAccounts }, { data: glAccounts }] = await Promise.all([
    (supabase as any)
      .from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    (supabase as any)
      .from('units')
      .select('id, unit_number, buildings!inner(name, association_id, associations(name))')
      .is('archived_at', null)
      .order('unit_number')
      .limit(500),
    (supabase as any)
      .from('charge_categories')
      .select('id, name, default_amount')
      .eq('active', true)
      .order('name'),
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

  const rows = sp.association
    ? (units ?? []).filter((unit: any) => unit.buildings?.association_id === sp.association)
    : (units ?? []);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Bulk Charges and Credits</h1>
          <Link href="/charges" className="text-sm text-ink-600 hover:text-ink-900">Back to Receipts</Link>
        </div>

        {sp.posted !== undefined && (
          <div className="border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-900">
            Posted {sp.posted} bulk {sp.kind === 'credits' ? 'credit' : 'charge'}{sp.posted === '1' ? '' : 's'}.
          </div>
        )}

        <form action="/charges/bulk" className="grid gap-4 border border-ink-100 bg-white p-5 md:grid-cols-[1fr_auto]">
          <Field label="Association">
            <select name="association" defaultValue={sp.association ?? ''} className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">All associations</option>
              {(associations ?? []).map((association: any) => (
                <option key={association.id} value={association.id}>{association.name}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">Filter units</Button>
          </div>
        </form>

        <form action={createBulkChargesOrCredits} className="space-y-4 border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Action">
              <select name="operation" defaultValue="charge" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="charge">Post charges</option>
                <option value="credit">Create credits</option>
              </select>
            </Field>
            <Field label="Amount"><Input name="amount" required inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Date"><Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Charge Category">
              <select name="charge_category_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select for charges</option>
                {(categories ?? []).map((category: any) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Bank Account">
              <select name="bank_account_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Optional for credits</option>
                {(bankAccounts ?? []).map((account: any) => (
                  <option key={account.id} value={account.id}>{account.name}{account.bank_name ? ` - ${account.bank_name}` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="GL Account">
              <select name="gl_account_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Optional for credits</option>
                {(glAccounts ?? []).map((account: any) => (
                  <option key={account.id} value={account.id}>{account.number} - {account.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Description"><Input name="description" required placeholder="Reason shown on ledgers" /></Field>
            <Field label="Reference"><Input name="reference" placeholder="Optional batch reference" /></Field>
          </div>

          <div className="overflow-x-auto border border-ink-100">
            <Table>
              <THead>
                <TR><TH className="w-10"></TH><TH>Association</TH><TH>Building</TH><TH>Unit</TH></TR>
              </THead>
              <tbody>
                {rows.map((unit: any) => (
                  <TR key={unit.id}>
                    <TD><input type="checkbox" name="unit_ids" value={unit.id} /></TD>
                    <TD>{unit.buildings?.associations?.name ?? 'Association'}</TD>
                    <TD>{unit.buildings?.name ?? '-'}</TD>
                    <TD className="font-medium">Unit {unit.unit_number}</TD>
                  </TR>
                ))}
                {rows.length === 0 && (
                  <TR><TD colSpan={4} className="px-6 py-10 text-center text-sm text-ink-500">No units match this filter.</TD></TR>
                )}
              </tbody>
            </Table>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/charges" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit" disabled={rows.length === 0}>Post Selected</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
