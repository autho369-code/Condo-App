import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { applyVendorCredit, enterVendorCredit } from '@/lib/rpcs/vendor-credits';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BLOCKED = ['cash', 'accounts_receivable', 'accounts_payable'];

export default async function VendorCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; entered?: string; applied?: string }>;
}) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const today = new Date().toISOString().slice(0, 10);

  const cols = 'id, credit_date, amount, applied_amount, reference, memo, vendor_id, association_id, vendors(name), associations(name), gl_accounts(number, name)';
  const [{ data: openCredits }, { data: history }, { data: associations }, { data: vendors }, { data: gls }] = await Promise.all([
    // Every credit with a balance left, so recent history can never crowd one out.
    db.from('vendor_credits').select(cols).gt('remaining_amount', 0).order('credit_date', { ascending: false }),
    db.from('vendor_credits').select(cols).eq('remaining_amount', 0).order('credit_date', { ascending: false }).limit(300),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('vendors').select('id, name').is('archived_at', null).order('name').limit(1000),
    db.from('gl_accounts').select('id, number, name, account_type').eq('active', true).order('number'),
  ]);
  const open = (openCredits ?? []) as any[];
  const rows = [...open, ...((history ?? []) as any[])];

  // Approved, unpaid bills for the vendors/associations that have open credits.
  const vendorIds = [...new Set(open.map((c) => c.vendor_id))];
  const { data: bills } = vendorIds.length
    ? await db.from('payable_bills')
        .select('id, vendor_id, association_id, bill_number, due_date, amount, credit_applied')
        .eq('status', 'approved').is('paid_at', null).is('archived_at', null).in('vendor_id', vendorIds)
        .order('due_date')
    : { data: [] };
  const billsFor = (c: any) => ((bills ?? []) as any[]).filter((b) => b.vendor_id === c.vendor_id && b.association_id === c.association_id
    && Number(b.amount) - Number(b.credit_applied ?? 0) > 0.005);

  return (
    <DataWorkspace
      title="Vendor credits"
      description="Credits from vendors (refunds, overcharges). Apply them to the vendor's unpaid bills — the check run pays only what's left."
      actions={<Link href="/bills"><Button variant="secondary">Back to bills</Button></Link>}
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not save">{sp.error}</Alert>}
        {sp.entered && <Alert tone="success">Vendor credit entered and posted (Dr Accounts Payable).</Alert>}
        {sp.applied && <Alert tone="success">Credit applied. A bill fully covered by credits is marked paid.</Alert>}

        <Surface>
          <SectionTitle title="Enter a credit" description="Posts Dr Accounts Payable / Cr the account the credit reduces — usually the original expense." />
          <form action={enterVendorCredit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Vendor" htmlFor="vendor_id">
              <Select id="vendor_id" name="vendor_id" required defaultValue="">
                <option value="">Choose a vendor</option>
                {((vendors ?? []) as any[]).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </Field>
            <Field label="Association" htmlFor="association_id">
              <Select id="association_id" name="association_id" required defaultValue="">
                <option value="">Choose an association</option>
                {((associations ?? []) as any[]).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Date" htmlFor="credit_date"><Input id="credit_date" name="credit_date" type="date" required defaultValue={today} /></Field>
            <Field label="Amount" htmlFor="amount"><Input id="amount" name="amount" type="number" min="0.01" step="0.01" required /></Field>
            <Field label="Account it reduces" htmlFor="gl_account_id">
              <Select id="gl_account_id" name="gl_account_id" required defaultValue="">
                <option value="">Choose an account</option>
                {((gls ?? []) as any[]).filter((g) => !BLOCKED.includes(String(g.account_type))).map((g) => <option key={g.id} value={g.id}>{g.number} · {g.name}</option>)}
              </Select>
            </Field>
            <Field label="Reference (optional)" htmlFor="reference"><Input id="reference" name="reference" placeholder="Credit memo #" /></Field>
            <Field label="Memo (optional)" htmlFor="memo" className="sm:col-span-3"><Input id="memo" name="memo" /></Field>
            <div className="sm:col-span-3"><Button type="submit">Enter credit</Button></div>
          </form>
        </Surface>

        <Surface padded={false}>
          <div className="px-5 pt-5"><SectionTitle title="Credits" /></div>
          <Table>
            <THead>
              <tr>
                <TH>Date</TH><TH>Vendor</TH><TH>Association</TH><TH>Account</TH>
                <TH className="text-right">Credit</TH><TH className="text-right">Left</TH><TH>Apply to a bill</TH>
              </tr>
            </THead>
            <tbody>
              {rows.length === 0 ? (
                <TR><TD colSpan={7} className="py-8 text-center text-gray-500">No vendor credits yet.</TD></TR>
              ) : rows.map((c) => {
                const left = Number(c.amount) - Number(c.applied_amount);
                const candidates = left > 0.005 ? billsFor(c) : [];
                return (
                  <TR key={c.id}>
                    <TD className="whitespace-nowrap text-gray-700">{date(c.credit_date)}</TD>
                    <TD>
                      <div className="font-medium text-gray-900">{c.vendors?.name ?? '—'}</div>
                      {(c.reference || c.memo) && <div className="text-xs text-gray-500">{[c.reference, c.memo].filter(Boolean).join(' · ')}</div>}
                    </TD>
                    <TD className="text-sm text-gray-700">{c.associations?.name ?? '—'}</TD>
                    <TD className="text-sm text-gray-700">{c.gl_accounts ? `${c.gl_accounts.number} ${c.gl_accounts.name}` : '—'}</TD>
                    <TD className="text-right tabular-nums">{money(c.amount)}</TD>
                    <TD className="text-right tabular-nums">{money(left)}</TD>
                    <TD>
                      {left <= 0.005 ? (
                        <span className="text-xs text-gray-500">Fully applied</span>
                      ) : candidates.length === 0 ? (
                        <span className="text-xs text-gray-500">No approved unpaid bills from this vendor for this association</span>
                      ) : (
                        <form action={applyVendorCredit} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="credit_id" value={c.id} />
                          <Select name="bill_id" required defaultValue="" aria-label="Bill" className="h-9 w-48">
                            <option value="">Choose a bill</option>
                            {candidates.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.bill_number ?? 'Bill'} · due {date(b.due_date)} · owes {money(Number(b.amount) - Number(b.credit_applied ?? 0))}
                              </option>
                            ))}
                          </Select>
                          <Input name="amount" type="number" min="0.01" step="0.01" required defaultValue={left.toFixed(2)} aria-label="Amount to apply" className="h-9 w-28" />
                          <Button type="submit" variant="secondary" size="sm">Apply</Button>
                        </form>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
