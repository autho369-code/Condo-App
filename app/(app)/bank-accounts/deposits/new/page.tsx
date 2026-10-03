import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, EmptyState, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { newSubmissionToken, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { createBankDeposit } from '@/lib/rpcs/bank-deposits';
import { todayInZone } from '@/lib/time/zoned';
import { date, money } from '@/lib/utils';
import { Landmark } from 'lucide-react';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewBankDepositPage({
  searchParams,
}: {
  searchParams: Promise<{ bank_account_id?: string; error?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const { rows: banks } = await fetchAllRows<any>(() => db.from('bank_accounts')
    .select('id, name, associations!bank_accounts_association_id_fkey(name)')
    .is('archived_at', null).order('name').order('id'));
  const bankId = UUID.test(sp.bank_account_id ?? '') ? sp.bank_account_id! : banks[0]?.id ?? '';

  // Receipts recorded to this bank that are not in a deposit yet.
  const [{ rows: payments }, { rows: others }] = bankId
    ? await Promise.all([
        fetchAllRows<any>(() => db.from('payments')
          .select('id, payment_date, amount, method, reference, units(unit_number)')
          .eq('bank_account_id', bankId).is('bank_deposit_id', null).is('reversed_at', null)
          .order('payment_date').order('id')),
        fetchAllRows<any>(() => db.from('other_receipts')
          .select('id, receipt_date, amount, payer_name, reference, memo')
          .eq('bank_account_id', bankId).is('bank_deposit_id', null).is('voided_at', null)
          .order('receipt_date').order('id')),
      ])
    : [{ rows: [] as any[] }, { rows: [] as any[] }];
  const total = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
    + others.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  return (
    <DataWorkspace
      title="New bank deposit"
      description="Group the receipts you took to the bank into one deposit, so it matches the single deposit line on the bank statement."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/bank-accounts/deposits"><Button variant="secondary">Bank deposits</Button></Link>
          <Link href="/bank-accounts/deposits/other"><Button variant="secondary">Other deposit</Button></Link>
        </div>
      }
    >
      <div className="space-y-5">
        {sp.error && <Alert tone="danger" title="Could not create the deposit">{sp.error}</Alert>}

        <Surface>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Field label="Bank account" htmlFor="bank_account_id" className="min-w-0 flex-1">
              <Select id="bank_account_id" name="bank_account_id" defaultValue={bankId}>
                {banks.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}{b.associations?.name ? ` — ${b.associations.name}` : ''}</option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">Show receipts</Button>
          </form>
        </Surface>

        {payments.length + others.length === 0 ? (
          <Surface padded={false}>
            <EmptyState icon={Landmark} title="No undeposited receipts" description="Every receipt recorded to this bank account is already in a deposit." />
          </Surface>
        ) : (
          <form action={createBankDeposit} className="space-y-5">
            <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
            <input type="hidden" name="bank_account_id" value={bankId} />
            <Table>
              <THead>
                <tr>
                  <TH className="w-10"><SelectAllCheckbox targetName="payment_id" /></TH>
                  <TH>Date</TH>
                  <TH>Received from</TH>
                  <TH>Method</TH>
                  <TH>Reference</TH>
                  <TH className="text-right">Amount</TH>
                </tr>
              </THead>
              <tbody>
                {payments.map((p: any) => (
                  <TR key={p.id}>
                    <TD><input type="checkbox" name="payment_id" value={p.id} defaultChecked aria-label="Include receipt" className="h-4 w-4 rounded border-gray-300" /></TD>
                    <TD className="whitespace-nowrap">{date(p.payment_date)}</TD>
                    <TD><Link href={`/payments/${p.id}`} className="hover:underline">Unit {p.units?.unit_number ?? '—'}</Link></TD>
                    <TD className="capitalize">{p.method?.replace(/_/g, ' ') ?? '—'}</TD>
                    <TD className="font-mono text-xs">{p.reference ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{money(p.amount)}</TD>
                  </TR>
                ))}
                {others.map((r: any) => (
                  <TR key={r.id}>
                    <TD><input type="checkbox" name="other_receipt_id" value={r.id} defaultChecked aria-label="Include receipt" className="h-4 w-4 rounded border-gray-300" /></TD>
                    <TD className="whitespace-nowrap">{date(r.receipt_date)}</TD>
                    <TD><Link href={`/receipts/other/${r.id}`} className="hover:underline">{r.payer_name ?? 'Other receipt'}</Link></TD>
                    <TD>Other receipt</TD>
                    <TD className="font-mono text-xs">{r.reference ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{money(r.amount)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
            <p className="text-sm text-gray-600">{payments.length + others.length} undeposited receipts · {money(total)}</p>
            <Surface>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Deposit date" htmlFor="deposit_date">
                  <Input id="deposit_date" name="deposit_date" type="date" required defaultValue={todayInZone()} />
                </Field>
                <Field label="Memo (optional)" htmlFor="memo">
                  <Input id="memo" name="memo" maxLength={200} />
                </Field>
              </div>
            </Surface>
            <PendingSubmit pendingLabel="Saving…">Save deposit</PendingSubmit>
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
