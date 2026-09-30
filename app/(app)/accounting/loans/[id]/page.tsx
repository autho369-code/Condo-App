import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { amortizationSchedule, FREQUENCY_LABEL, interestFor, type LoanFrequency } from '@/lib/loans/amortization';
import { recordLoanPayment, saveLoanSetup, voidLoanPayment } from '@/lib/rpcs/loans';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCHEDULE_ROWS = 36;

export default async function LoanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireFinanceStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = (await createClient()) as any;

  const { data: loan } = await db
    .from('association_loans')
    .select('*, associations(name)')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();
  if (!loan) notFound();

  const [{ data: payments }, { data: glAccounts }, { data: banks }] = await Promise.all([
    db.from('loan_payments')
      .select('id, payment_date, amount, principal, interest, balance_after, reference, memo, voided_at, void_reason, bank_account_id')
      .eq('loan_id', id)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
    db.from('gl_accounts')
      .select('id, number, name, account_type, association_id')
      .eq('portfolio_id', me.portfolio?.id)
      .eq('active', true)
      .order('number'),
    db.from('bank_accounts')
      .select('id, name, association_id, gl_account_id')
      .is('archived_at', null)
      .order('name'),
  ]);

  const forAssociation = (row: any) => !row.association_id || row.association_id === loan.association_id;
  const gls = (glAccounts ?? []).filter(forAssociation);
  const liabilityGls = gls.filter((g: any) => String(g.account_type) === 'liability');
  const interestGls = gls.filter((g: any) => ['expense', 'other_expense'].includes(String(g.account_type)));
  const assocBanks = (banks ?? []).filter(forAssociation).filter((b: any) => b.gl_account_id);
  const bankName = (bid: string) => (banks ?? []).find((b: any) => b.id === bid)?.name ?? '—';

  const hasPayments = (payments ?? []).length > 0;
  const setupComplete = !!(loan.gl_account_id && loan.interest_gl_account_id);
  const active = loan.status !== 'paid_off' && Number(loan.current_balance ?? 0) > 0;
  const balance = Number(loan.current_balance ?? 0);
  const rate = Number(loan.interest_rate ?? 0);
  const payment = Number(loan.payment_amount ?? 0);
  const frequency = (loan.payment_frequency ?? 'monthly') as LoanFrequency;
  const schedule = amortizationSchedule({
    balance, annualRatePct: rate, payment, frequency, firstPaymentDate: loan.next_payment_date,
  });
  const nextInterest = interestFor(balance, rate, frequency);
  const today = new Date().toISOString().slice(0, 10);
  const back = `/accounting/loans/${id}`;

  const glOption = (g: any) => <option key={g.id} value={g.id}>{g.number} — {g.name}</option>;

  return (
    <DataWorkspace
      title={loan.lender}
      description={`${loan.associations?.name ?? ''} · ${String(loan.loan_type ?? 'loan').replace(/_/g, ' ')}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={`/associations/${loan.association_id}/profile`}><Button variant="secondary">Association profile</Button></Link>
          <Link href="/accounting/loans"><Button variant="secondary">All loans</Button></Link>
        </div>
      }
    >
      <div className="space-y-5">
        {sp.error && <Alert tone="danger" title="Could not complete that">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">{sp.saved}</Alert>}
        {!setupComplete && (
          <Alert tone="warning" title="Finish the loan setup">
            Choose the loan&apos;s liability account and interest expense account below before recording payments.
          </Alert>
        )}

        <MetricStrip
          metrics={[
            { label: 'Balance', value: money(balance), sublabel: loan.original_principal ? `of ${money(loan.original_principal)} borrowed` : undefined },
            { label: 'Rate · payment', value: `${rate}%`, sublabel: payment ? `${money(payment)} ${FREQUENCY_LABEL[frequency].toLowerCase()}` : 'No payment set' },
            { label: 'Next due', value: loan.next_payment_date ? date(loan.next_payment_date) : '—', sublabel: loan.next_payment_date && loan.next_payment_date < today && active ? 'Overdue' : undefined },
            {
              label: 'Projected payoff',
              value: loan.status === 'paid_off' ? 'Paid off' : schedule.neverPaysOff ? 'Never' : schedule.payoffDate ? date(schedule.payoffDate) : '—',
              sublabel: schedule.neverPaysOff ? 'Payment does not cover interest' : schedule.totalInterest ? `${money(schedule.totalInterest)} interest to go` : undefined,
            },
          ]}
        />

        {active && setupComplete && (
          <Surface>
            <SectionTitle
              title="Record payment"
              description="Posts one journal entry: principal reduces the loan, interest goes to interest expense, the total comes out of the bank account."
            />
            <form action={recordLoanPayment} className="grid gap-4 sm:grid-cols-3">
              <input type="hidden" name="loan_id" value={loan.id} />
              <Field label="Payment date">
                <Input name="payment_date" type="date" required defaultValue={loan.next_payment_date && loan.next_payment_date <= today ? loan.next_payment_date : today} />
              </Field>
              <Field label="Amount paid">
                <Input name="amount" type="number" step="0.01" min="0.01" required defaultValue={payment ? payment.toFixed(2) : ''} />
              </Field>
              <Field label="Interest portion" hint={`Leave blank to calculate: ${money(nextInterest)} at ${rate}% on the current balance.`}>
                <Input name="interest" type="number" step="0.01" min="0" placeholder={nextInterest.toFixed(2)} />
              </Field>
              <Field label="Paid from">
                <Select name="bank_account_id" defaultValue={loan.bank_account_id ?? ''} required>
                  <option value="">Select bank account</option>
                  {assocBanks.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Reference (optional)">
                <Input name="reference" maxLength={100} placeholder="Check #, ACH trace" />
              </Field>
              <Field label="Memo (optional)">
                <Input name="memo" maxLength={1000} />
              </Field>
              <div className="sm:col-span-3"><Button type="submit">Record payment</Button></div>
            </form>
          </Surface>
        )}

        <Surface padded={false}>
          <div className="px-5 pt-5"><SectionTitle title="Payments" /></div>
          {!hasPayments ? (
            <p className="px-5 pb-5 text-sm text-gray-500">No payments recorded yet.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH className="text-right">Paid</TH>
                  <TH className="text-right">Principal</TH>
                  <TH className="text-right">Interest</TH>
                  <TH className="text-right">Balance after</TH>
                  <TH>From · reference</TH>
                  <TH><span className="sr-only">Void</span></TH>
                </tr>
              </THead>
              <tbody>
                {(payments ?? []).map((p: any) => (
                  <TR key={p.id}>
                    <TD className="whitespace-nowrap">{date(p.payment_date)}</TD>
                    <TD className={`text-right tabular-nums ${p.voided_at ? 'text-gray-400 line-through' : ''}`}>{money(p.amount)}</TD>
                    <TD className="text-right tabular-nums text-gray-600">{money(p.principal)}</TD>
                    <TD className="text-right tabular-nums text-gray-600">{money(p.interest)}</TD>
                    <TD className="text-right tabular-nums text-gray-600">{p.voided_at ? '—' : money(p.balance_after)}</TD>
                    <TD className="text-sm text-gray-600">
                      {bankName(p.bank_account_id)}{p.reference ? ` · ${p.reference}` : ''}
                      {p.voided_at && <div className="mt-1"><StatusChip tone="neutral">Void</StatusChip> <span className="text-xs">{p.void_reason}</span></div>}
                    </TD>
                    <TD className="text-right">
                      {!p.voided_at && (
                        <form action={voidLoanPayment} className="flex justify-end gap-2">
                          <input type="hidden" name="loan_id" value={loan.id} />
                          <input type="hidden" name="payment_id" value={p.id} />
                          <Input name="reason" required maxLength={500} placeholder="Reason" aria-label="Reason for voiding" className="w-36" />
                          <Button type="submit" variant="secondary" size="sm">Void</Button>
                        </form>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Surface>

        <Surface>
          <SectionTitle title="Loan setup" description="Accounts are limited to this association (or company-wide accounts)." />
          <form action={saveLoanSetup} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="loan_id" value={loan.id} />
            <Field label="Lender">
              <Input name="lender" defaultValue={loan.lender} maxLength={200} required />
            </Field>
            <Field label="Payment frequency">
              <Select name="payment_frequency" defaultValue={frequency}>
                {(Object.keys(FREQUENCY_LABEL) as LoanFrequency[]).map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
              </Select>
            </Field>
            <Field label="Loan liability account" hint="Principal payments reduce this account.">
              <Select name="gl_account_id" defaultValue={loan.gl_account_id ?? ''}>
                <option value="">Select account</option>
                {liabilityGls.map(glOption)}
              </Select>
            </Field>
            <Field label="Interest expense account">
              <Select name="interest_gl_account_id" defaultValue={loan.interest_gl_account_id ?? ''}>
                <option value="">Select account</option>
                {interestGls.map(glOption)}
              </Select>
            </Field>
            <Field label="Default bank account">
              <Select name="bank_account_id" defaultValue={loan.bank_account_id ?? ''}>
                <option value="">None</option>
                {assocBanks.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Interest rate (% per year)">
              <Input name="interest_rate" type="number" step="0.001" min="0" max="50" defaultValue={loan.interest_rate ?? ''} />
            </Field>
            <Field label="Scheduled payment">
              <Input name="payment_amount" type="number" step="0.01" min="0.01" defaultValue={loan.payment_amount ?? ''} />
            </Field>
            <Field label="Next payment due">
              <Input name="next_payment_date" type="date" defaultValue={loan.next_payment_date ?? ''} />
            </Field>
            <Field label="Maturity date">
              <Input name="maturity_date" type="date" defaultValue={loan.maturity_date ?? ''} />
            </Field>
            {!hasPayments && (
              <Field label="Current balance" hint="Editable until the first payment is recorded; after that the balance moves only with payments.">
                <Input name="current_balance" type="number" step="0.01" min="0" defaultValue={loan.current_balance ?? ''} />
              </Field>
            )}
            <div className="sm:col-span-2"><Button type="submit" variant="secondary">Save setup</Button></div>
          </form>
        </Surface>

        {active && payment > 0 && (
          <Surface padded={false}>
            <div className="px-5 pt-5">
              <SectionTitle
                title="Amortization schedule"
                description={schedule.neverPaysOff
                  ? `The ${money(payment)} payment doesn't cover the ${money(nextInterest)} interest per period, so the balance never goes down.`
                  : `From today's balance at ${rate}%. ${schedule.rows.length > SCHEDULE_ROWS ? `Showing the next ${SCHEDULE_ROWS} of ${schedule.rows.length} payments.` : ''}${schedule.truncated ? ' Stops at 50 years.' : ''}`}
              />
            </div>
            {schedule.rows.length > 0 && (
              <Table>
                <THead>
                  <tr>
                    <TH>#</TH>
                    <TH>Due</TH>
                    <TH className="text-right">Payment</TH>
                    <TH className="text-right">Principal</TH>
                    <TH className="text-right">Interest</TH>
                    <TH className="text-right">Balance</TH>
                  </tr>
                </THead>
                <tbody>
                  {schedule.rows.slice(0, SCHEDULE_ROWS).map((r) => (
                    <TR key={r.n}>
                      <TD className="text-gray-500">{r.n}</TD>
                      <TD className="whitespace-nowrap">{r.date ? date(r.date) : '—'}</TD>
                      <TD className="text-right tabular-nums">{money(r.payment)}</TD>
                      <TD className="text-right tabular-nums text-gray-600">{money(r.principal)}</TD>
                      <TD className="text-right tabular-nums text-gray-600">{money(r.interest)}</TD>
                      <TD className="text-right tabular-nums">{money(r.balance)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
