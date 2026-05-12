import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createRecurringJournalEntry } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewRecurringJournalEntryPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: glAccounts } = await (supabase as any)
    .from('gl_accounts')
    .select('id, number, name')
    .eq('active', true)
    .order('number');

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">New Recurring Journal Entry</h1>
          <Link href="/journal-entries/recurring" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createRecurringJournalEntry} className="space-y-4 border border-ink-100 bg-white p-5">
          <Field label="Name"><Input name="name" required /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Frequency">
              <select name="frequency" defaultValue="monthly" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </Field>
            <Field label="Interval"><Input name="interval_count" type="number" min="1" defaultValue="1" /></Field>
            <Field label="Next Post Date"><Input name="next_post_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <GLSelect name="debit_gl_account_id" label="Debit GL Account" accounts={glAccounts ?? []} />
            <GLSelect name="credit_gl_account_id" label="Credit GL Account" accounts={glAccounts ?? []} />
          </div>

          <Field label="Amount"><Input name="amount" required inputMode="decimal" placeholder="0.00" /></Field>
          <Field label="Memo"><textarea name="memo" rows={3} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" /></Field>
          <label className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" name="auto_generate" defaultChecked /> Auto-generate when due</label>

          <div className="flex justify-end gap-2">
            <Link href="/journal-entries/recurring" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save Recurring Entry</Button>
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
