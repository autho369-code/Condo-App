import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Alert, Badge } from '@/components/ui/shell';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { ownerPayableAction } from '@/lib/rpcs/owner-payables';
import { money, date } from '@/lib/utils';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPE: Record<string, string> = { refund: 'Refund', settlement: 'Settlement', distribution: 'Distribution', other: 'Other' };
const METHOD: Record<string, string> = { check: 'Check', echeck: 'eCheck', ach: 'ACH', cash: 'Cash', other: 'Other' };
const DONE: Record<string, string> = {
  approve: 'Payable approved and posted to the ledger',
  pay: 'Payment recorded',
  void_payment: 'Payment voided — the payable is open again',
  void: 'Payable voided',
};

export default async function HomeownerPayablePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string; saved?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const db = (await createClient()) as any;

  const { data: p } = await db
    .from('owner_payables')
    .select('*, owners(full_name, email), associations(name), gl_accounts(number, name), bank_accounts(name, bank_name)')
    .eq('id', id)
    .maybeSingle();
  if (!p) notFound();

  const [{ data: banks }, { data: entries }, { data: hold }] = await Promise.all([
    db.from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .or(`association_id.is.null,association_id.eq.${p.association_id}`)
      .order('name'),
    db.from('journal_entries')
      .select('id, entry_date, description, source_type, reference_number')
      .eq('source_id', id)
      .in('source_type', ['owner_payable', 'owner_payable_payment', 'owner_payable_payment_void', 'owner_payable_void'])
      .order('created_at'),
    db.from('owner_financial_details').select('hold_payments').eq('owner_id', p.owner_id).maybeSingle(),
  ]);
  const open = p.status === 'draft' || p.status === 'pending_approval';

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/bills/owner-payable" className="transition-colors hover:text-gray-700">Homeowner payables</Link>
              {' · '}
              {p.owners?.full_name}
            </>
          }
          title={`${TYPE[p.payable_type] ?? 'Payable'} to ${p.owners?.full_name ?? 'homeowner'}`}
        />
      }
    >
      {sp.error && <Alert tone="danger" title="Could not update homeowner payable">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success" title="Homeowner payable saved">Approve it to post it to the ledger, then record the payment.</Alert>}
      {sp.done && DONE[sp.done] && <Alert tone="success" title={DONE[sp.done]} />}
      {hold?.hold_payments && p.status === 'approved' && (
        <Alert tone="warning" title="Payments to this homeowner are on hold">
          Clear &quot;Hold payments&quot; on the <Link href={`/owners/${p.owner_id}`} className="font-medium underline">homeowner</Link> before paying.
        </Alert>
      )}

      <Section title="Details" actions={<Badge status={p.status} />} padded>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Homeowner</dt><dd className="font-medium text-gray-900"><Link href={`/owners/${p.owner_id}`} className="hover:underline">{p.owners?.full_name ?? '—'}</Link></dd></div>
          <div><dt className="text-gray-500">Association</dt><dd className="text-gray-900">{p.associations?.name ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Amount</dt><dd className="font-semibold tabular-nums text-gray-950">{money(p.amount)}</dd></div>
          <div><dt className="text-gray-500">Type</dt><dd className="text-gray-900">{TYPE[p.payable_type] ?? p.payable_type}</dd></div>
          <div><dt className="text-gray-500">Payable date</dt><dd className="text-gray-900">{date(p.payable_date)}</dd></div>
          <div><dt className="text-gray-500">Due date</dt><dd className="text-gray-900">{date(p.due_date)}</dd></div>
          <div><dt className="text-gray-500">GL account</dt><dd className="text-gray-900">{p.gl_accounts ? `${p.gl_accounts.number} — ${p.gl_accounts.name}` : '—'}</dd></div>
          <div><dt className="text-gray-500">Bank account</dt><dd className="text-gray-900">{p.bank_accounts?.name ?? '—'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Memo</dt><dd className="text-gray-900">{p.memo ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Approved</dt><dd className="text-gray-900">{p.approved_at ? date(p.approved_at) : '—'}</dd></div>
          <div>
            <dt className="text-gray-500">Paid</dt>
            <dd className="text-gray-900">
              {p.paid_at ? `${date(p.paid_at)} · ${METHOD[p.payment_method] ?? p.payment_method ?? ''}${p.payment_reference ? ` ${p.payment_reference}` : ''}` : '—'}
            </dd>
          </div>
        </dl>
      </Section>

      {p.status === 'approved' && (
        <Section title="Record payment" padded>
          <form action={ownerPayableAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="op" value="pay" />
            <Field label="Paid from" htmlFor="bank_account_id">
              <Select id="bank_account_id" name="bank_account_id" defaultValue={p.bank_account_id ?? ''} required>
                <option value="">Select a bank account…</option>
                {(banks ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}{b.bank_name ? ` — ${b.bank_name}` : ''}</option>)}
              </Select>
            </Field>
            <Field label="Method" htmlFor="method">
              <Select id="method" name="method" defaultValue="check">
                {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Check # / reference" htmlFor="reference">
              <Input id="reference" name="reference" maxLength={80} />
            </Field>
            <Field label="Payment date" htmlFor="payment_date">
              <Input id="payment_date" name="payment_date" type="date" required defaultValue={todayInZone()} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-4">
              <PendingSubmit pendingLabel="Recording…">Record payment</PendingSubmit>
            </div>
          </form>
        </Section>
      )}

      {p.status === 'paid' && (
        <Section title="Void payment" padded>
          <form action={ownerPayableAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="op" value="void_payment" />
            <Field label="Reason" htmlFor="reason">
              <Input id="reason" name="reason" required minLength={3} maxLength={200} />
            </Field>
            <PendingSubmit variant="danger" pendingLabel="Voiding…">Void payment</PendingSubmit>
          </form>
          <p className="mt-2 text-xs text-gray-500">Reverses the payment entry and reopens the payable so it can be paid again or voided.</p>
        </Section>
      )}

      {(entries ?? []).length > 0 && (
        <Section title="Ledger entries" padded>
          <ul className="divide-y divide-gray-100 text-sm">
            {(entries ?? []).map((e: any) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium text-gray-900">{e.description}</span>
                <span className="text-gray-500">{date(e.entry_date)}{e.reference_number ? ` · ${e.reference_number}` : ''}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(open || p.status === 'approved') && (
        <div className="flex flex-wrap gap-2">
          {open && (
            <form action={ownerPayableAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="op" value="approve" />
              <PendingSubmit pendingLabel="Approving…">Approve</PendingSubmit>
            </form>
          )}
          <form action={ownerPayableAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="op" value="void" />
            <Button type="submit" variant="danger">Void payable</Button>
          </form>
        </div>
      )}
    </Workspace>
  );
}
