import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { VendorSelect } from '@/components/vendors/vendor-select';
import { newSubmissionToken, SUBMISSION_FIELD } from '@/lib/forms/submission';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { recordCreditCardCharge, saveCreditCardAccount, voidCreditCardCharge } from '@/lib/rpcs/credit-cards';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';
import { todayInZone } from '@/lib/time/zoned';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;
// Accounts a card purchase can't be coded to (the card's own liability is excluded separately).
const BLOCKED_TYPES = ['cash', 'accounts_receivable', 'accounts_payable'];

export default async function CreditCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; charged?: string; voided?: string; page?: string }>;
}) {
  await requireFinanceStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const db = (await createClient()) as any;

  const { data: card } = await db
    .from('credit_card_accounts')
    .select('id, name, issuer, last_four, association_id, gl_account_id, associations(name), gl_accounts(number, name)')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();
  if (!card) notFound();

  const [{ data: charges, count }, { data: associations }, { data: gls }, { data: vendors }, { data: liabilityGls }] = await Promise.all([
    db.from('credit_card_charges')
      .select('id, charge_date, payee, amount, reference, description, voided_at, void_reason, associations(name), gl_accounts(number, name)', { count: 'exact' })
      .eq('card_id', id)
      .order('charge_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    card.association_id ? { data: [] } : db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('gl_accounts').select('id, number, name, account_type, association_id').eq('active', true).order('number'),
    fetchAllRows<any>(() => db.from('vendors').select('id, name, association_id, is_management_company').is('archived_at', null).order('name').order('id')).then((r) => ({ data: r.rows, error: r.error ? { message: r.error } : null })),
    db.from('gl_accounts').select('id, number, name, association_id').eq('active', true).in('account_type', ['liability', 'accounts_payable']).order('number'),
  ]);
  const glOptions = ((gls ?? []) as any[]).filter((g) =>
    g.id !== card.gl_account_id && !BLOCKED_TYPES.includes(String(g.account_type))
    && (!g.association_id || !card.association_id || g.association_id === card.association_id));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const posted = ((charges ?? []) as any[]).filter((c) => !c.voided_at);
  const today = todayInZone();

  return (
    <DataWorkspace
      title={card.name}
      description={[card.issuer, card.last_four ? `•••• ${card.last_four}` : null, card.associations?.name ?? 'Any association'].filter(Boolean).join(' · ')}
      actions={<Link href="/credit-cards"><Button variant="secondary">All credit cards</Button></Link>}
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not save">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success">Card account saved.</Alert>}
        {sp.charged && <Alert tone="success">Charge recorded and posted to the ledger.</Alert>}
        {sp.voided && <Alert tone="info">Charge voided — a reversing entry was posted.</Alert>}

        <MetricStrip
          metrics={[
            { label: 'Liability account', value: card.gl_accounts ? `${card.gl_accounts.number}` : '—', sublabel: card.gl_accounts?.name },
            { label: 'Posted charges (this page)', value: money(posted.reduce((s, c) => s + Number(c.amount), 0)) },
            { label: 'Charges', value: count ?? 0 },
          ]}
        />

        <Surface>
          <SectionTitle title="Record a charge" description="Posts Dr the expense account / Cr the card's liability account for the association." />
          <form action={recordCreditCardCharge} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input type="hidden" name="card_id" value={card.id} />
            <input type="hidden" name={SUBMISSION_FIELD} value={newSubmissionToken()} />
            <Field label="Date" htmlFor="charge_date"><Input id="charge_date" name="charge_date" type="date" required defaultValue={today} /></Field>
            <Field label="Amount" htmlFor="amount"><Input id="amount" name="amount" type="number" min="0.01" step="0.01" required /></Field>
            {!card.association_id && (
              <Field label="Association" htmlFor="association_id">
                <Select id="association_id" name="association_id" required defaultValue="">
                  <option value="">Choose the association</option>
                  {((associations ?? []) as any[]).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Paid to" htmlFor="payee" hint="Or pick a vendor.">
              <Input id="payee" name="payee" placeholder="e.g. Home Depot" />
            </Field>
            <Field label="Vendor (optional)" htmlFor="vendor_id">
              {/* A card tied to one association fixes it; otherwise follow the association field above. */}
              <VendorSelect id="vendor_id" name="vendor_id" defaultValue="" vendors={(vendors ?? []) as any[]} associationId={card.association_id || undefined} placeholder="None" />
            </Field>
            <Field label="Expense account" htmlFor="gl_account_id">
              <Select id="gl_account_id" name="gl_account_id" required defaultValue="">
                <option value="">Choose an account</option>
                {glOptions.map((g) => <option key={g.id} value={g.id}>{g.number} · {g.name}</option>)}
              </Select>
            </Field>
            <Field label="Reference (optional)" htmlFor="reference"><Input id="reference" name="reference" placeholder="Receipt #" /></Field>
            <Field label="Description (optional)" htmlFor="description" className="sm:col-span-2"><Input id="description" name="description" /></Field>
            <div className="sm:col-span-3"><PendingSubmit pendingLabel="Recording…">Record charge</PendingSubmit></div>
          </form>
        </Surface>

        <Surface padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
            <SectionTitle title="Charges" />
            {totalPages > 1 && (
              <div className="flex items-center gap-3 text-sm">
                {page > 1 ? <Link href={`/credit-cards/${card.id}?page=${page - 1}`} className="underline underline-offset-4">Newer</Link> : <span className="text-gray-300">Newer</span>}
                <span className="text-gray-500">Page {page} of {totalPages}</span>
                {page < totalPages ? <Link href={`/credit-cards/${card.id}?page=${page + 1}`} className="underline underline-offset-4">Older</Link> : <span className="text-gray-300">Older</span>}
              </div>
            )}
          </div>
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Paid to</TH>
                <TH>Account</TH>
                <TH>Association</TH>
                <TH className="text-right">Amount</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <tbody>
              {(charges ?? []).length === 0 ? (
                <TR><TD colSpan={6} className="py-8 text-center text-gray-500">No charges recorded yet.</TD></TR>
              ) : ((charges ?? []) as any[]).map((c) => (
                <TR key={c.id}>
                  <TD className="whitespace-nowrap text-gray-700">{date(c.charge_date)}</TD>
                  <TD>
                    <div className="font-medium text-gray-900">{c.payee}</div>
                    {(c.reference || c.description) && <div className="text-xs text-gray-500">{[c.reference, c.description].filter(Boolean).join(' · ')}</div>}
                  </TD>
                  <TD className="text-sm text-gray-700">{c.gl_accounts ? `${c.gl_accounts.number} ${c.gl_accounts.name}` : '—'}</TD>
                  <TD className="text-sm text-gray-700">{c.associations?.name ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{money(c.amount)}</TD>
                  <TD>
                    {c.voided_at ? (
                      <div><StatusChip tone="neutral">Void</StatusChip>{c.void_reason && <div className="mt-1 text-xs text-gray-500">{c.void_reason}</div>}</div>
                    ) : (
                      <form action={voidCreditCardCharge} className="flex items-center gap-2">
                        <input type="hidden" name="card_id" value={card.id} />
                        <input type="hidden" name="charge_id" value={c.id} />
                        <Input name="reason" required placeholder="Reason to void" className="h-9 w-40" aria-label="Reason to void" />
                        <Button type="submit" variant="secondary" size="sm">Void</Button>
                      </form>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Surface>

        <Surface>
          <SectionTitle title="Card details" description="The liability account and association lock once the card has charges." />
          <form action={saveCreditCardAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input type="hidden" name="card_id" value={card.id} />
            {card.association_id && <input type="hidden" name="association_id" value={card.association_id} />}
            <Field label="Name" htmlFor="name"><Input id="name" name="name" required defaultValue={card.name} /></Field>
            <Field label="Issuer" htmlFor="issuer"><Input id="issuer" name="issuer" defaultValue={card.issuer ?? ''} /></Field>
            <Field label="Last four digits" htmlFor="last_four"><Input id="last_four" name="last_four" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" defaultValue={card.last_four ?? ''} /></Field>
            <Field label="Liability account" htmlFor="card_gl">
              <Select id="card_gl" name="gl_account_id" required defaultValue={card.gl_account_id}>
                {((liabilityGls ?? []) as any[]).map((g) => <option key={g.id} value={g.id}>{g.number} · {g.name}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2"><Button type="submit" variant="secondary">Save card details</Button></div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
