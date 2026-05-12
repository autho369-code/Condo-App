import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createJournalEntry } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewJournalEntryPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: associations }, { data: glAccounts }] = await Promise.all([
    (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name'),
    (supabase as any).from('gl_accounts').select('id, number, name, account_type').eq('active', true).order('number'),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">New Journal Entry</h1>
          <Link href="/journal-entries" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createJournalEntry} className="space-y-4 border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Entry Date"><Input name="entry_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Reference Number"><Input name="reference_number" /></Field>
          </div>

          <Field label="Association">
            <select name="association_id" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Portfolio-level</option>
              {(associations ?? []).map((association: any) => (
                <option key={association.id} value={association.id}>{association.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Description"><Input name="description" /></Field>

          <div className="grid gap-4 md:grid-cols-2">
            <GLSelect name="debit_gl_account_id" label="Debit GL Account" accounts={glAccounts ?? []} />
            <GLSelect name="credit_gl_account_id" label="Credit GL Account" accounts={glAccounts ?? []} />
          </div>

          <Field label="Amount"><Input name="amount" required inputMode="decimal" placeholder="0.00" /></Field>
          <Field label="Memo"><textarea name="memo" rows={3} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" /></Field>
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="posted" /> Post immediately</label>

          <div className="flex justify-end gap-2">
            <Link href="/journal-entries" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save Journal Entry</Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function GLSelect({ name, label, accounts }: { name: string; label: string; accounts: any[] }) {
  return (
    <Field label={label}>
      <select name={name} required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
        <option value="">Select GL account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>{account.number}: {account.name}</option>
        ))}
      </select>
    </Field>
  );
}
