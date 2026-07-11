import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewBankDepositPage({ searchParams }: { searchParams: Promise<{ error?: string; posted?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: accounts }, { data: associations }, { data: glAccounts }] = await Promise.all([
    db.from('bank_accounts').select('id, name, gl_account_id').is('archived_at', null).order('name'),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('gl_accounts').select('id, number, name').eq('portfolio_id', me.portfolio?.id).eq('active', true).order('number'),
  ]);

  async function recordDeposit(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const db = supabase as any;
    const fail = (m: string) => redirect('/bank-accounts/deposits/new?error=' + encodeURIComponent(m));

    const bankAccountId = formData.get('bank_account_id') as string;
    const creditGlId = formData.get('credit_gl_id') as string;
    const associationId = (formData.get('association_id') as string) || null;
    const depositDate = formData.get('deposit_date') as string;
    const amount = parseFloat(formData.get('amount') as string) || 0;
    const memo = (formData.get('memo') as string)?.trim() || null;
    const receivedFrom = (formData.get('received_from') as string)?.trim() || null;

    if (!bankAccountId) fail('Select a bank account.');
    if (!creditGlId) fail('Select the GL account to credit.');
    if (!depositDate) fail('Deposit date is required.');
    if (amount <= 0) fail('Deposit amount must be greater than zero.');

    const { data: bank } = await db.from('bank_accounts').select('id, name, gl_account_id').eq('id', bankAccountId).single();
    if (!bank) fail('Bank account not found.');
    if (!bank.gl_account_id) fail(`"${bank.name}" has no linked GL account. Link one on the bank account before recording deposits.`);
    if (bank.gl_account_id === creditGlId) fail('The credited GL account must differ from the bank account’s GL account.');

    const description = `Bank deposit — ${bank.name}${receivedFrom ? ` (from ${receivedFrom})` : ''}`;

    // Same draft -> lines -> post pattern as manual journal entries: the
    // deposit debits the bank's GL account and credits the selected account.
    const { data: entry, error: entryErr } = await db.from('journal_entries').insert({
      portfolio_id: me.portfolio?.id,
      entry_date: depositDate,
      description,
      reference_number: null,
      memo,
      posted: false,
      created_by: me.auth_user_id,
    }).select('id').single();
    if (entryErr || !entry) fail(entryErr?.message ?? 'Could not create the deposit entry.');

    const { error: linesErr } = await db.from('journal_lines').insert([
      { entry_id: entry.id, gl_account_id: bank.gl_account_id, association_id: associationId, debit_amount: amount, credit_amount: 0, memo, sort_order: 0 },
      { entry_id: entry.id, gl_account_id: creditGlId, association_id: associationId, debit_amount: 0, credit_amount: amount, memo, sort_order: 1 },
    ]);
    if (linesErr) {
      await db.from('journal_entries').delete().eq('id', entry.id); // roll back the orphan draft
      fail(`Could not save deposit lines: ${linesErr.message}`);
    }

    const { error: postErr } = await db.from('journal_entries').update({ posted: true }).eq('id', entry.id);
    if (postErr) fail(`Saved as draft, but posting failed: ${postErr.message}`);

    redirect('/bank-accounts/deposits/new?posted=1');
  }

  return (
    <DataWorkspace
      title="Record bank deposit"
      description="Record a deposit into a bank account. The deposit posts to the General Ledger immediately as a balanced journal entry."
      actions={<Link href="/bank-accounts"><Button variant="secondary">Back to bank accounts</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not record deposit">{sp.error}</Alert>}
        {sp.posted && <Alert tone="success" title="Deposit recorded">The deposit was posted to the General Ledger.</Alert>}
        {(glAccounts ?? []).length === 0 ? (
          <Alert tone="warning" title="No GL accounts yet">
            Add accounts to your chart of accounts first — <Link href="/gl-accounts/new" className="font-medium underline">create a GL account</Link>.
          </Alert>
        ) : (
          <form action={recordDeposit}>
            <Surface>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bank account (debited)">
                  <Select name="bank_account_id" required>
                    <option value="">Select account</option>
                    {(accounts ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </Select>
                </Field>
                <Field label="Credit GL account (source of funds)">
                  <Select name="credit_gl_id" required>
                    <option value="">Select GL account</option>
                    {(glAccounts ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.number} — {row.name}</option>)}
                  </Select>
                </Field>
                <Field label="Association (optional)">
                  <Select name="association_id">
                    <option value="">Portfolio-level</option>
                    {(associations ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}
                  </Select>
                </Field>
                <Field label="Deposit date">
                  <Input name="deposit_date" type="date" required />
                </Field>
                <Field label="Amount">
                  <Input name="amount" type="number" step="0.01" min="0.01" placeholder="$0.00" required />
                </Field>
                <Field label="Received from (optional)">
                  <Input name="received_from" placeholder="Payer / source" />
                </Field>
              </div>
              <Field label="Memo (optional)" className="mt-4">
                <Textarea name="memo" rows={3} placeholder="Deposit details" />
              </Field>
            </Surface>
            <div className="mt-6">
              <Button type="submit">Record deposit</Button>
            </div>
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
