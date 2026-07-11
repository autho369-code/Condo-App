import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function NewBankTransferPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: accounts } = await db
    .from('bank_accounts')
    .select('id, name, bank_name, associations:association_id(name)')
    .eq('portfolio_id', me.portfolio?.id).is('archived_at', null).order('name');

  async function createTransfer(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const from = formData.get('from_bank_account_id') as string;
    const to = formData.get('to_bank_account_id') as string;
    const amount = parseFloat(formData.get('amount') as string);
    if (!from || !to) redirect('/bank-transfers/new?error=' + encodeURIComponent('Select both a source and destination account.'));
    if (from === to) redirect('/bank-transfers/new?error=' + encodeURIComponent('Source and destination must be different accounts.'));
    if (!Number.isFinite(amount) || amount <= 0) redirect('/bank-transfers/new?error=' + encodeURIComponent('Enter an amount greater than zero.'));

    const db = supabase as any;
    const transferDate = (formData.get('transfer_date') as string) || new Date().toISOString().slice(0, 10);
    const memo = (formData.get('memo') as string)?.trim() || null;
    const reference = (formData.get('reference_number') as string)?.trim() || null;

    const { data: transfer, error } = await db.from('bank_transfers').insert({
      portfolio_id: me.portfolio?.id,
      from_bank_account_id: from,
      to_bank_account_id: to,
      amount,
      transfer_date: transferDate,
      reference_number: reference,
      memo,
      created_by: me.auth_user_id,
    }).select('id').single();
    if (error || !transfer) redirect('/bank-transfers/new?error=' + encodeURIComponent(error?.message ?? 'Could not record transfer.'));

    // Post the transfer to the GL (debit destination, credit source) so it
    // affects balances instead of sitting "Incomplete" forever. Requires both
    // bank accounts to be linked to GL accounts.
    const { data: banks } = await db.from('bank_accounts').select('id, name, gl_account_id').in('id', [from, to]);
    const fromBank = (banks ?? []).find((b: any) => b.id === from);
    const toBank = (banks ?? []).find((b: any) => b.id === to);
    if (fromBank?.gl_account_id && toBank?.gl_account_id && fromBank.gl_account_id !== toBank.gl_account_id) {
      const { data: entry } = await db.from('journal_entries').insert({
        portfolio_id: me.portfolio?.id,
        entry_date: transferDate,
        description: `Bank transfer — ${fromBank.name} → ${toBank.name}`,
        reference_number: reference,
        memo,
        posted: false,
        created_by: me.auth_user_id,
      }).select('id').single();
      if (entry) {
        const { error: linesErr } = await db.from('journal_lines').insert([
          { entry_id: entry.id, gl_account_id: toBank.gl_account_id, debit_amount: amount, credit_amount: 0, memo, sort_order: 0 },
          { entry_id: entry.id, gl_account_id: fromBank.gl_account_id, debit_amount: 0, credit_amount: amount, memo, sort_order: 1 },
        ]);
        if (!linesErr) {
          const { error: postErr } = await db.from('journal_entries').update({ posted: true }).eq('id', entry.id);
          if (!postErr) {
            await db.from('bank_transfers').update({ journal_entry_id: entry.id }).eq('id', transfer.id);
          }
        } else {
          await db.from('journal_entries').delete().eq('id', entry.id); // roll back the orphan draft
        }
      }
    }
    redirect('/bank-transfers');
  }

  const acctLabel = (a: any) => `${a.name}${a.bank_name ? ` (${a.bank_name})` : ''}${a.associations?.name ? ` · ${a.associations.name}` : ''}`;

  return (
    <DataWorkspace
      title="New Bank Transfer"
      description="Record a transfer of funds between two bank accounts."
      actions={<Link href="/bank-transfers"><Button variant="secondary">Back to transfers</Button></Link>}
    >
      <form action={createTransfer} className="max-w-2xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not record transfer">{sp.error}</Alert>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="from_bank_account_id">From account <span className="text-red-500">*</span></Label>
            <select id="from_bank_account_id" name="from_bank_account_id" required className={inputCls}>
              <option value="">Select source</option>
              {(accounts ?? []).map((a: any) => <option key={a.id} value={a.id}>{acctLabel(a)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="to_bank_account_id">To account <span className="text-red-500">*</span></Label>
            <select id="to_bank_account_id" name="to_bank_account_id" required className={inputCls}>
              <option value="">Select destination</option>
              {(accounts ?? []).map((a: any) => <option key={a.id} value={a.id}>{acctLabel(a)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="amount">Amount <span className="text-red-500">*</span></Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
          </div>
          <div>
            <Label htmlFor="transfer_date">Transfer date</Label>
            <Input id="transfer_date" name="transfer_date" type="date" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="reference_number">Reference #</Label>
            <Input id="reference_number" name="reference_number" placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="memo">Memo</Label>
            <Input id="memo" name="memo" placeholder="Optional" />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/bank-transfers" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Record transfer</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
