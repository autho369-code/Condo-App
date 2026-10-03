import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireFinanceStaff } from '@/lib/auth/me';
import { claimSubmission, completeSubmission, newSubmissionToken, releaseSubmission, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { todayInZone } from '@/lib/time/zoned';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewBankDepositPage({ searchParams }: { searchParams: Promise<{ error?: string; posted?: string }> }) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [{ rows: accounts }, { rows: glAccounts }] = await Promise.all([
    fetchAllRows<any>(() => db.from('bank_accounts').select('id, name, gl_account_id, associations!bank_accounts_association_id_fkey(name)').is('archived_at', null).order('name').order('id')),
    fetchAllRows<any>(() => db.from('gl_accounts').select('id, number, name, associations(name)').eq('portfolio_id', me.portfolio?.id).eq('active', true).order('number').order('id')),
  ]);

  async function recordDeposit(formData: FormData) {
    'use server';
    await requireFinanceStaff();
    const db = (await createClient()) as any;
    const fail = (m: string): never => redirect('/bank-accounts/deposits/new?error=' + encodeURIComponent(m));
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const bankAccountId = String(formData.get('bank_account_id') ?? '');
    const creditGlId = String(formData.get('credit_gl_id') ?? '');
    const depositDate = String(formData.get('deposit_date') ?? '');
    const amount = Number(String(formData.get('amount') ?? '').replace(/[$,\s]/g, ''));
    if (!UUID.test(bankAccountId)) fail('Select a bank account.');
    if (!UUID.test(creditGlId)) fail('Select the GL account to credit.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(depositDate)) fail('Deposit date is required.');
    if (!Number.isFinite(amount) || amount <= 0) fail('Deposit amount must be greater than zero.');

    // A double click must not post the deposit twice.
    const claim = await claimSubmission(db, formData, 'bank_deposit');
    if (claim.status === 'error') fail(claim.message);
    if (claim.status === 'duplicate') redirect('/bank-accounts/deposits/new?posted=1');
    const token = (claim as { token: string }).token;

    // One RPC posts the entry and both lines on the bank's own association, so
    // the deposit shows in that bank's balance, activity and reconciliation.
    const { data: entryId, error } = await db.rpc('record_bank_deposit', {
      p_bank_account_id: bankAccountId,
      p_credit_gl_id: creditGlId,
      p_deposit_date: depositDate,
      p_amount: amount,
      p_memo: String(formData.get('memo') ?? ''),
      p_received_from: String(formData.get('received_from') ?? ''),
    });
    if (error) {
      await releaseSubmission(db, token);
      fail(error.message);
    }
    await completeSubmission(db, token, String(entryId));
    redirect('/bank-accounts/deposits/new?posted=1');
  }

  return (
    <DataWorkspace
      title="Record bank deposit"
      description="Record a deposit that is not an owner payment (interest, insurance proceeds, transfers in). Owner payments recorded as receipts on the unit already post to the bank account — do not deposit them again here."
      actions={<Link href="/bank-accounts"><Button variant="secondary">Back to bank accounts</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not record deposit">{sp.error}</Alert>}
        {sp.posted && <Alert tone="success" title="Deposit recorded">The deposit was posted to the General Ledger.</Alert>}
        {glAccounts.length === 0 ? (
          <Alert tone="warning" title="No GL accounts yet">
            Add accounts to your chart of accounts first — <Link href="/gl-accounts/new" className="font-medium underline">create a GL account</Link>.
          </Alert>
        ) : (
          <form action={recordDeposit}>
            <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
            <Surface>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bank account (debited)">
                  <Select name="bank_account_id" required>
                    <option value="">Select account</option>
                    {accounts.map((row: any) => <option key={row.id} value={row.id}>{row.name}{row.associations?.name ? ` — ${row.associations.name}` : ''}</option>)}
                  </Select>
                </Field>
                <Field label="Credit GL account (source of funds)">
                  <Select name="credit_gl_id" required>
                    <option value="">Select GL account</option>
                    {glAccounts.map((row: any) => <option key={row.id} value={row.id}>{row.number} — {row.name}{row.associations?.name ? ` (${row.associations.name})` : ''}</option>)}
                  </Select>
                </Field>
                <Field label="Deposit date">
                  <Input name="deposit_date" type="date" required defaultValue={todayInZone()} />
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
              <PendingSubmit pendingLabel="Recording…">Record deposit</PendingSubmit>
            </div>
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
