import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Badge, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { RECEIPT_METHODS } from '@/lib/payments/methods';
import { recordHomeownerReceipt } from '@/lib/rpcs/receipts';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewHomeownerReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; error?: string; posted?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const unitId = UUID.test(sp.unit ?? '') ? sp.unit! : '';
  const db = (await createClient()) as any;

  // Step 1 list: every unit with its current homeowner and balance, so the
  // receipt is matched to a person, not just a unit number.
  const [{ data: units }, { data: summaries }, { data: occupants }] = await Promise.all([
    db.from('units').select('id, unit_number, buildings!inner(association_id, associations(name))').is('archived_at', null).limit(5000),
    db.from('v_unit_account_summary').select('unit_id, outstanding_balance, unapplied_credit').limit(5000),
    db.from('occupancies').select('unit_id, is_primary, owners(full_name)').eq('status', 'current').limit(10000),
  ]);
  const balanceByUnit = new Map<string, any>((summaries ?? []).map((s: any) => [s.unit_id, s]));
  const ownerByUnit = new Map<string, string>();
  for (const o of (occupants ?? []).sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary))) {
    if (!ownerByUnit.has(o.unit_id) && o.owners?.full_name) ownerByUnit.set(o.unit_id, o.owners.full_name);
  }
  const unitOptions = (units ?? [])
    .map((u: any) => ({
      id: u.id,
      association: u.buildings?.associations?.name ?? 'Association',
      associationId: u.buildings?.association_id,
      unit: u.unit_number,
      owner: ownerByUnit.get(u.id) ?? 'No current homeowner',
      balance: Number(balanceByUnit.get(u.id)?.outstanding_balance ?? 0),
    }))
    .sort((a: any, b: any) => a.association.localeCompare(b.association) || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const grouped = new Map<string, typeof unitOptions>();
  for (const u of unitOptions) grouped.set(u.association, [...(grouped.get(u.association) ?? []), u]);

  const selected = unitOptions.find((u: any) => u.id === unitId);
  const [{ data: openCharges }, { data: banks }, { data: recent }] = selected
    ? await Promise.all([
        db.from('v_charge_balances').select('charge_id, description, due_date, charged_amount, balance_due, is_past_due')
          .eq('unit_id', unitId).gt('balance_due', 0).order('due_date').limit(100),
        db.from('bank_accounts').select('id, name, fund_type, gl_account_id')
          .eq('association_id', selected.associationId).is('archived_at', null).order('name'),
        db.from('payments').select('id, amount, payment_date, method, reference')
          .eq('unit_id', unitId).order('payment_date', { ascending: false }).limit(5),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const depositable = (banks ?? []).filter((b: any) => b.gl_account_id);
  const defaultBank = depositable.find((b: any) => b.fund_type === 'operating')?.id ?? depositable[0]?.id ?? '';
  const summary = selected ? balanceByUnit.get(unitId) : null;
  const pastDue = (openCharges ?? []).filter((c: any) => c.is_past_due).reduce((s: number, c: any) => s + Number(c.balance_due), 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <DataWorkspace
      title="Homeowner receipt"
      description="Record a payment received from a homeowner. It is applied to the oldest open charges first and posted to the ledger immediately."
      actions={<Link href="/receipts"><Button variant="secondary">Back to receipts</Button></Link>}
    >
      <div className="max-w-4xl space-y-5">
        {sp.error && <Alert tone="danger" title="Receipt not recorded">{sp.error}</Alert>}
        {sp.posted && UUID.test(sp.posted) && (
          <Alert tone="success" title="Receipt recorded">
            Ready for the next one. <Link href={`/payments/${sp.posted}/receipt`} className="font-medium underline">Print the last receipt</Link>
          </Alert>
        )}

        <Surface>
          <SectionTitle title="1. Who paid?" description="Search by association, unit, or homeowner name." />
          {unitOptions.length === 0 ? (
            <Alert tone="warning" title="No units yet">
              Add units first — <Link href="/owners/import" className="font-medium underline">import homeowners &amp; units</Link>.
            </Alert>
          ) : (
            <form action="/receipts/new" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Homeowner / unit" className="flex-1">
                <Select name="unit" defaultValue={unitId} required>
                  <option value="">Select a homeowner…</option>
                  {[...grouped.entries()].map(([association, list]) => (
                    <optgroup key={association} label={association}>
                      {list.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          Unit {u.unit} — {u.owner}{u.balance > 0 ? ` (owes ${money(u.balance)})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="secondary">{selected ? 'Change' : 'Continue'}</Button>
            </form>
          )}
        </Surface>

        {selected && (
          <>
            <Surface>
              <SectionTitle
                title={`${selected.owner} · ${selected.association} · Unit ${selected.unit}`}
                description="Open charges this receipt will pay, oldest first."
                actions={<Link href={`/units/${selected.id}`} className="text-[13px] font-medium text-gray-600 hover:text-gray-950 hover:underline">Open unit ledger</Link>}
              />
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div><div className="text-xs text-gray-500">Balance due</div><div className="text-lg font-semibold tabular-nums text-gray-950">{money(summary?.outstanding_balance ?? 0)}</div></div>
                <div><div className="text-xs text-gray-500">Past due</div><div className="text-lg font-semibold tabular-nums text-gray-950">{money(pastDue)}</div></div>
                <div><div className="text-xs text-gray-500">Unapplied credit</div><div className="text-lg font-semibold tabular-nums text-gray-950">{money(summary?.unapplied_credit ?? 0)}</div></div>
              </div>
              {(openCharges ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">No open charges — this receipt will be held as a prepayment credit.</p>
              ) : (
                <Table>
                  <THead>
                    <tr><TH>Due</TH><TH>Charge</TH><TH className="text-right">Charged</TH><TH className="text-right">Open</TH></tr>
                  </THead>
                  <tbody>
                    {(openCharges ?? []).map((c: any) => (
                      <TR key={c.charge_id}>
                        <TD className="whitespace-nowrap">{date(c.due_date)} {c.is_past_due && <Badge tone="danger">Past due</Badge>}</TD>
                        <TD>{c.description ?? 'Charge'}</TD>
                        <TD className="text-right tabular-nums">{money(c.charged_amount)}</TD>
                        <TD className="text-right tabular-nums">{money(c.balance_due)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </Surface>

            <form action={recordHomeownerReceipt}>
              <input type="hidden" name="unit_id" value={selected.id} />
              <Surface>
                <SectionTitle title="2. Payment details" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Amount received" required>
                    <Input name="amount" type="number" step="0.01" min="0.01" required
                      defaultValue={Number(summary?.outstanding_balance ?? 0) > 0 ? Number(summary.outstanding_balance).toFixed(2) : undefined} />
                  </Field>
                  <Field label="Date received" required>
                    <Input name="payment_date" type="date" defaultValue={today} required />
                  </Field>
                  <Field label="Payment method" required>
                    <Select name="method" defaultValue="check" required>
                      {RECEIPT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Check / reference number">
                    <Input name="reference" maxLength={100} placeholder="Check #, ACH trace, money order #" />
                  </Field>
                  <Field label="Deposit to" hint={depositable.length === 0 ? 'No bank account with a GL link — posts to the association operating account.' : undefined}>
                    <Select name="bank_account_id" defaultValue={defaultBank}>
                      {depositable.length === 0 && <option value="">Association operating account</option>}
                      {depositable.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Memo" className="mt-4">
                  <Textarea name="notes" rows={2} maxLength={1000} />
                </Field>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button type="submit" name="next" value="done">Save receipt</Button>
                  <Button type="submit" name="next" value="another" variant="secondary">Save &amp; enter another</Button>
                </div>
              </Surface>
            </form>

            {(recent ?? []).length > 0 && (
              <Surface>
                <SectionTitle title="Recent receipts for this unit" description="Check you aren't entering a duplicate." />
                <ul className="divide-y divide-gray-100 text-sm">
                  {(recent ?? []).map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <span>{date(p.payment_date)} · {p.reference ?? p.method}</span>
                      <Link href={`/payments/${p.id}/receipt`} className="tabular-nums text-gray-950 hover:underline">{money(p.amount)}</Link>
                    </li>
                  ))}
                </ul>
              </Surface>
            )}
          </>
        )}
      </div>
    </DataWorkspace>
  );
}
