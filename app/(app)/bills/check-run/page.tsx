import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { Alert, PageShell, PageHeader, Breadcrumb, Surface, SectionTitle } from '@/components/ui/shell';
import { Input, Field, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { recordBillPayments, writeChecks } from '@/lib/rpcs/bills';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { money, date } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CheckRunPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ rows: queue, error: queueError }, { data: banks, error: banksError }, { rows: approved, error: approvedError }] = await Promise.all([
    // Every approved check bill; the Data API returns at most 1,000 rows per request.
    fetchAllRows<any>(() => (supabase as any).from('v_check_writing_queue').select('*')
      .order('due_date', { ascending: true }).order('vendor_name').order('bill_id')),
    (supabase as any).from('bank_accounts')
      .select('id, name, bank_name, next_check_number, check_signature')
      .is('archived_at', null)
      .order('name'),
    // Approved, unpaid bills of vendors paid other than by printed check.
    fetchAllRows<any>(() => (supabase as any).from('payable_bills')
      .select('id, bill_number, amount, credit_applied, due_date, memo, vendors!inner(name, payment_type, is_auto_pay, hold_payments), associations(name)')
      .eq('status', 'approved')
      .is('paid_at', null)
      .is('archived_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('id')),
  ]);
  const loadError = queueError ?? banksError?.message ?? approvedError;
  // Vendors on "Hold payments" can't be paid until the hold is cleared.
  const otherBills = approved.filter((b: any) => !b.vendors?.hold_payments && (b.vendors?.payment_type !== 'check' || b.vendors?.is_auto_pay));
  const otherTotal = otherBills.reduce((sum: number, b: any) => sum + Number(b.amount ?? 0) - Number(b.credit_applied ?? 0), 0);
  const METHOD: Record<string, string> = { check: 'Auto-pay', echeck: 'eCheck', ach: 'ACH', online: 'Online' };

  const total = (queue ?? []).reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);
  const defaultBank = (banks ?? []).find((bank: any) => Boolean(bank.check_signature?.trim()));

  return (
    <PageShell>
      <Breadcrumb items={[{ label: 'Payables', href: '/bills' }, { label: 'Pay bills' }]} />
      <PageHeader
        title="Pay bills"
        description="Print checks for vendors paid by check, and record payments made by eCheck, ACH, online or auto-pay."
        actions={<Link href="/bills"><Button variant="secondary">Cancel</Button></Link>}
      />

      {sp.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Could not pay bills:</span> {sp.error}
        </div>
      )}

      {loadError && (
        <Alert tone="danger" title="Could not load the bills to pay." className="mb-6">{loadError}</Alert>
      )}

      {(banks ?? []).length > 0 && !defaultBank && (
        <Alert tone="warning" title="No bank account is set up to print checks." className="mb-6">
          Add an authorized check signer on a bank account first —{' '}
          {(banks ?? []).map((bank: any, i: number) => (
            <span key={bank.id}>{i > 0 && ', '}<Link href={`/bank-accounts/${bank.id}`} className="font-medium underline">{bank.name}</Link></span>
          ))}.
        </Alert>
      )}

      <form action={writeChecks as any} className="space-y-6">
        <Surface>
          <SectionTitle title="Run settings" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Bank account" htmlFor="bank_account_id">
              <Select id="bank_account_id" name="bank_account_id" required>
                {(banks ?? []).map((b: any) => (
                  <option key={b.id} value={b.id} disabled={!b.check_signature?.trim()}>{b.name} {b.bank_name ? `— ${b.bank_name}` : ''} (next: {b.next_check_number ?? '—'}){!b.check_signature?.trim() ? ' — signer setup required' : ''}</option>
                ))}
              </Select>
            </Field>
            <Field label="Starting check #" htmlFor="starting_check_number">
              <Input id="starting_check_number" name="starting_check_number" type="number" min={1}
                defaultValue={defaultBank?.next_check_number ?? ''} required />
            </Field>
            <Field label="Payment date" htmlFor="payment_date">
              <Input id="payment_date" name="payment_date" type="date" defaultValue={todayInZone()} />
            </Field>
          </div>
        </Surface>

        <div>
          <SectionTitle
            title="Approved bills to pay"
            actions={
              <div className="text-sm text-gray-600">
                {queue?.length ?? 0} bills · <span className="font-semibold tabular-nums">{money(total)}</span>
              </div>
            }
          />
          {queue?.length ? (
            <Table>
              <THead><tr>
                <TH className="w-8"><SelectAllCheckbox targetName="bill_ids" /></TH>
                <TH>Vendor</TH><TH>Association</TH><TH>Memo</TH>
                <TH className="text-right">Amount</TH><TH>Due</TH>
              </tr></THead>
              <tbody>
                {(queue ?? []).map((b: any) => (
                  <TR key={b.bill_id}>
                    <TD><input type="checkbox" name="bill_ids" value={b.bill_id} defaultChecked /></TD>
                    <TD className="font-medium">{b.vendor_name}</TD>
                    <TD>{b.association_name ?? '—'}</TD>
                    <TD className="max-w-sm truncate text-gray-600" title={b.memo ?? ''}>{b.memo ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{money(b.amount)}</TD>
                    <TD>{date(b.due_date)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-gray-200/70 bg-white p-6 text-center text-sm text-gray-500 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              No approved, unpaid bills for vendors that pay by check.
            </div>
          )}
        </div>

        <Surface>
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input type="checkbox" name="authorization_confirmed" required className="mt-1" />
            <span>
              <span className="block font-medium text-gray-950">I am authorized to issue these checks.</span>
              The system records my user identity and the bank account&apos;s configured signer label with this immutable check run. A physical or approved electronic signature is still required on the check.
            </span>
          </label>
        </Surface>

        <div className="flex justify-end gap-2">
          <Link href="/bills"><Button variant="secondary" type="button">Cancel</Button></Link>
          <Button type="submit">Write checks</Button>
        </div>
      </form>

      {otherBills.length > 0 && (
        <form id="other-payments" action={recordBillPayments} className="mt-10 space-y-6">
          <SectionTitle
            title="eCheck, ACH, online and auto-pay"
            actions={
              <div className="text-sm text-gray-600">
                {otherBills.length} bills · <span className="font-semibold tabular-nums">{money(otherTotal)}</span>
              </div>
            }
          />
          <p className="text-sm text-gray-600">These vendors are not paid by printed check. Once you have paid them from the bank, record the payment here to mark the bills paid.</p>
          <Table>
            <THead><tr>
              <TH className="w-8"><SelectAllCheckbox targetName="bill_ids" defaultChecked={false} /></TH>
              <TH>Vendor</TH><TH>Pay by</TH><TH>Association</TH><TH>Memo</TH>
              <TH className="text-right">Amount</TH><TH>Due</TH>
            </tr></THead>
            <tbody>
              {otherBills.map((b: any) => (
                <TR key={b.id}>
                  <TD><input type="checkbox" name="bill_ids" value={b.id} aria-label={`Select bill from ${b.vendors?.name ?? 'vendor'}`} /></TD>
                  <TD className="font-medium"><Link href={`/bills/${b.id}`} className="hover:underline">{b.vendors?.name}</Link></TD>
                  <TD>{b.vendors?.is_auto_pay ? 'Auto-pay' : METHOD[b.vendors?.payment_type] ?? b.vendors?.payment_type}</TD>
                  <TD>{b.associations?.name ?? '—'}</TD>
                  <TD className="max-w-sm truncate text-gray-600" title={b.memo ?? ''}>{b.memo ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{money(Number(b.amount ?? 0) - Number(b.credit_applied ?? 0))}</TD>
                  <TD>{date(b.due_date)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Surface>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Paid from bank account" htmlFor="other_bank_account_id">
                <Select id="other_bank_account_id" name="bank_account_id" required>
                  {(banks ?? []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} {b.bank_name ? `— ${b.bank_name}` : ''}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment date" htmlFor="other_payment_date">
                <Input id="other_payment_date" name="payment_date" type="date" required defaultValue={todayInZone()} />
              </Field>
              <Field label="Reference (confirmation #)" htmlFor="other_reference">
                <Input id="other_reference" name="reference" maxLength={80} />
              </Field>
            </div>
          </Surface>
          <div className="flex justify-end">
            <Button type="submit">Record payments</Button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
