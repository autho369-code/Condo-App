import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { newSubmissionToken, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { receiptMethodLabel } from '@/lib/payments/methods';
import { reallocatePayment, reversePayment } from '@/lib/rpcs/payments';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { isValidTimeZone } from '@/lib/time/display-zone';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; reallocated?: string; reversed?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const { data: p } = await db.from('payments')
    .select('id, amount, payment_date, method, reference, notes, processor, unit_id, reversed_at, reversal_reason, reversal_charge_id, units(unit_number, buildings(associations(name, timezone)))')
    .eq('id', id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: applications }, open] = await Promise.all([
    db.from('payment_applications').select('charge_id, amount_applied').eq('payment_id', id),
    fetchAllRows<any>(() => db.from('v_charge_balances')
      .select('charge_id, description, charge_type, charged_amount, balance_due, due_date')
      .eq('unit_id', p.unit_id)
      .gt('balance_due', 0)
      .order('due_date')
      .order('charge_id')),
  ]);
  const appliedHere = new Map<string, number>(((applications ?? []) as any[]).map((a) => [a.charge_id, Number(a.amount_applied)]));
  const missing = [...appliedHere.keys()].filter((cid) => !open.rows.some((c) => c.charge_id === cid));
  const { data: paidCharges } = missing.length
    ? await db.from('v_charge_balances').select('charge_id, description, charge_type, charged_amount, balance_due, due_date').in('charge_id', missing)
    : { data: [] };
  const charges = [...open.rows, ...(paidCharges ?? [])]
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  const applied = [...appliedHere.values()].reduce((s, v) => s + v, 0);
  const unapplied = Number(p.amount) - applied;
  const assoc = p.units?.buildings?.associations;
  const zone = assoc?.timezone && isValidTimeZone(assoc.timezone) ? assoc.timezone : undefined;
  const reversed = !!p.reversed_at;
  const isCredit = p.method === 'credit';

  return (
    <DataWorkspace
      title={`${isCredit ? 'Credit' : 'Payment'} ${money(p.amount)}`}
      description={`Unit ${p.units?.unit_number ?? '—'} · ${assoc?.name ?? 'Association'} · ${receiptMethodLabel(p.method)}${p.reference ? ` ${p.reference}` : ''} · received ${date(p.payment_date)}`}
      actions={
        <>
          <Link href={`/units/${p.unit_id}`}><Button variant="secondary">Back to unit</Button></Link>
          <Link href={`/payments/${id}/receipt`}><Button variant="secondary">Receipt</Button></Link>
        </>
      }
    >
      <div className="space-y-6">
        {sp.error && <Alert tone="danger" title="Could not save">{sp.error}</Alert>}
        {sp.reallocated && <Alert tone="success" title="Allocation saved" />}
        {sp.reversed && <Alert tone="success" title="Payment reversed">The amount is back on the owner&apos;s account and the charges it paid are open again.</Alert>}

        <Surface>
          <SectionTitle
            title="Status"
            actions={reversed ? <StatusChip tone="danger">Reversed</StatusChip> : <StatusChip tone="success">Received</StatusChip>}
          />
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-gray-500">Amount</dt><dd className="font-medium text-gray-900">{money(p.amount)}</dd></div>
            <div><dt className="text-gray-500">Applied to charges</dt><dd className="font-medium text-gray-900">{money(applied)}</dd></div>
            <div><dt className="text-gray-500">Credit on file</dt><dd className="font-medium text-gray-900">{money(unapplied)}</dd></div>
            <div><dt className="text-gray-500">Notes</dt><dd className="text-gray-900">{p.notes || '—'}</dd></div>
          </dl>
          {reversed && (
            <p className="mt-4 text-sm text-gray-600">
              Reversed {date(p.reversed_at)}: {p.reversal_reason}. The returned amount was charged back to the owner as a &ldquo;Returned payment&rdquo; charge.
            </p>
          )}
        </Surface>

        {!reversed && (
          <Surface>
            <SectionTitle
              title="Allocation"
              description="Choose which charges this payment pays. Any amount not allocated stays on the account as credit."
            />
            {charges.length === 0 ? (
              <p className="text-sm text-gray-500">This unit has no open charges to apply the payment to.</p>
            ) : (
              <form action={reallocatePayment} className="space-y-3">
                <input type="hidden" name="payment_id" value={id} />
                <Table>
                  <THead>
                    <TR>
                      <TH>Charge</TH>
                      <TH>Due</TH>
                      <TH className="text-right">Charged</TH>
                      <TH className="text-right">Available</TH>
                      <TH className="text-right">Apply</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {charges.map((c: any) => {
                      const here = appliedHere.get(c.charge_id) ?? 0;
                      const available = Number(c.balance_due) + here;
                      return (
                        <TR key={c.charge_id}>
                          <TD className="text-sm text-gray-900">{c.description || c.charge_type}</TD>
                          <TD className="whitespace-nowrap text-sm text-gray-600">{date(c.due_date)}</TD>
                          <TD className="text-right text-sm tabular-nums">{money(c.charged_amount)}</TD>
                          <TD className="text-right text-sm tabular-nums">{money(available)}</TD>
                          <TD className="text-right">
                            <Input
                              name={`alloc_${c.charge_id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              max={available.toFixed(2)}
                              defaultValue={here ? here.toFixed(2) : ''}
                              aria-label={`Amount to apply to ${c.description || c.charge_type}`}
                              className="ml-auto w-28 text-right"
                            />
                          </TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>
                <div className="flex justify-end">
                  <PendingSubmit pendingLabel="Saving…">Save allocation</PendingSubmit>
                </div>
              </form>
            )}
          </Surface>
        )}

        {!reversed && !isCredit && (
          <Surface>
            <SectionTitle
              title="Reverse payment"
              description="Use when a check bounces, a bank payment is returned or a card payment is disputed. The receipt stays on record; the amount is charged back to the owner and the charges it paid are open again."
            />
            <form action={reversePayment} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <input type="hidden" name="payment_id" value={id} />
              <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
              <Field label="Reason" htmlFor="reason" required className="sm:col-span-2">
                <Input id="reason" name="reason" required maxLength={200} placeholder="NSF – insufficient funds" />
              </Field>
              <Field label="Reversal date" htmlFor="reversal_date">
                <Input id="reversal_date" name="reversal_date" type="date" min={p.payment_date} defaultValue={todayInZone(zone)} />
              </Field>
              <label className="flex min-h-[40px] items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                <input type="checkbox" name="nsf_fee" className="h-4 w-4 rounded border-gray-300" />
                Charge the association&apos;s NSF fee
              </label>
              <div className="flex items-end justify-end">
                <PendingSubmit variant="danger" pendingLabel="Reversing…">Reverse payment</PendingSubmit>
              </div>
            </form>
          </Surface>
        )}
      </div>
    </DataWorkspace>
  );
}
