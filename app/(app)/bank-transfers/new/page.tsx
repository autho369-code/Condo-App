import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createBankTransfer } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewBankTransferPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: accounts } = await (supabase as any)
    .from('bank_accounts')
    .select('id, name, bank_name')
    .is('archived_at', null)
    .order('name');

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Bank Transfer</h1>
          <Link href="/bank-transfers" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createBankTransfer} className="space-y-4 border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <AccountSelect name="from_bank_account_id" label="From Account" accounts={accounts ?? []} />
            <AccountSelect name="to_bank_account_id" label="To Account" accounts={accounts ?? []} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount"><Input name="amount" required inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Transfer Date"><Input name="transfer_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          </div>

          <Field label="Reference Number"><Input name="reference_number" /></Field>
          <Field label="Memo"><textarea name="memo" rows={3} className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm" /></Field>

          <div className="flex justify-end gap-2">
            <Link href="/bank-transfers" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit">Save Transfer</Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function AccountSelect({ name, label, accounts }: { name: string; label: string; accounts: any[] }) {
  return (
    <Field label={label}>
      <select name={name} required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
        <option value="">Select account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>{account.name}{account.bank_name ? ` - ${account.bank_name}` : ''}</option>
        ))}
      </select>
    </Field>
  );
}
