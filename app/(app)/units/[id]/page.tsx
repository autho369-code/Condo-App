import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody, Stat } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import {
  subscribeUnitToCharge, unsubscribeUnit,
  postAdHocCharge, recordReceipt, unapplyPayment,
} from '@/lib/rpcs/charges';
import { money, date } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function UnitDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id: unitId } = await params;
  const supabase = await createClient();

  const [
    { data: unit }, { data: summary }, { data: schedule },
    { data: balances }, { data: payments }, { data: categories },
  ] = await Promise.all([
    (supabase as any).from('units')
      .select('id, unit_number, bedrooms, bathrooms, sqft, buildings(name, association_id, associations(name))')
      .eq('id', unitId).maybeSingle(),
    (supabase as any).from('v_unit_account_summary').select('*').eq('unit_id', unitId).maybeSingle(),
    (supabase as any).from('v_unit_charge_schedule').select('*').eq('unit_id', unitId).eq('active', true).order('category_name'),
    (supabase as any).from('v_charge_balances').select('*').eq('unit_id', unitId).order('due_date', { ascending: false }).limit(50),
    (supabase as any).from('payments').select('id, amount, payment_date, method, reference, notes').eq('unit_id', unitId).order('payment_date', { ascending: false }).limit(30),
    (supabase as any).from('charge_categories').select('id, name, default_amount, default_frequency, charge_type').eq('portfolio_id', me.portfolio?.id).eq('active', true).order('sort_order'),
  ]);

  if (!unit) notFound();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-gray-200 bg-white px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Link href="/units" className="transition-colors hover:text-gray-700">Units</Link>
              {' Ã‚Â· '}
              <span className="text-gray-400">{(unit.buildings as any)?.associations?.name}</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">Unit {unit.unit_number}</h1>
            <div className="mt-1 text-sm text-gray-500">
              {unit.bedrooms ? `${unit.bedrooms} bd` : ''}{unit.bathrooms ? ` Ã‚Â· ${unit.bathrooms} ba` : ''}{unit.sqft ? ` Ã‚Â· ${unit.sqft} sqft` : ''}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto bg-gray-50 px-8 py-6">

      {/* ======== ACCOUNT SUMMARY ======== */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total charged" value={money(summary?.total_charged ?? 0)} />
        <Stat label="Total paid" value={money(summary?.total_paid ?? 0)} />
        <Stat label="Outstanding"
          value={<span className={Number(summary?.outstanding_balance) > 0 ? 'text-red-600' : 'text-green-600'}>
            {money(summary?.outstanding_balance ?? 0)}
          </span>} />
        <Stat label="Credit on file"
          value={<span className="text-green-600">{money(summary?.unapplied_credit ?? 0)}</span>} />
      </div>

      {/* ======== RECURRING CHARGES (SUBSCRIPTIONS) ======== */}
      <Card>
        <CardHeader><CardTitle>Recurring charges</CardTitle></CardHeader>
        <CardBody>
          {schedule && schedule.length > 0 ? (
            <Table>
              <THead><TR>
                <TH>Category</TH><TH>Space / locker #</TH><TH className="text-right">Amount</TH><TH>Frequency</TH>
                <TH>Next post</TH><TH>Memo</TH><TH></TH>
              </TR></THead>
              <tbody>
                {schedule.map((s: any) => (
                  <TR key={s.recurring_charge_id}>
                    <TD className="font-medium">{s.category_name}</TD>
                    <TD className="text-sm text-gray-700">{s.identifier ?? '—'}</TD>
                    <TD className="text-right">{money(s.amount)}</TD>
                    <TD className="capitalize">{s.frequency}</TD>
                    <TD>{date(s.next_post_date)}</TD>
                    <TD className="text-gray-600 text-sm">{s.memo ?? 'Ã¢â‚¬â€'}</TD>
                    <TD className="text-right">
                      <form action={unsubscribeUnit.bind(null, s.recurring_charge_id, unitId) as any}>
                        <button type="submit" className="text-xs text-red-600 hover:underline">End</button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-gray-500">No active recurring charges.</p>
          )}

          {/* Subscribe form */}
          <form action={subscribeUnitToCharge as any} className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 md:grid-cols-5">
            <input type="hidden" name="unit_id" value={unitId} />
            <div className="md:col-span-2">
              <Label htmlFor="charge_category_id">Add subscription</Label>
              <select id="charge_category_id" name="charge_category_id" required
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="">Choose a categoryÃ¢â‚¬Â¦</option>
                {(categories ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({money(c.default_amount)} / {c.default_frequency})</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0" placeholder="Uses default if blank" />
            </div>
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <select id="frequency" name="frequency" className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="">default</option><option>monthly</option><option>quarterly</option><option>annually</option>
              </select>
            </div>
            <div className="flex items-end"><Button type="submit" className="w-full">Add</Button></div>
            <div className="md:col-span-2">
              <Input name="identifier" placeholder="Space / locker # (e.g. 14)" />
            </div>
            <div className="md:col-span-3">
              <Input name="memo" placeholder="Optional memo" />
            </div>
          </form>
        </CardBody>
      </Card>

      {/* ======== OPEN CHARGES + HISTORY ======== */}
      <Card>
        <CardHeader><CardTitle>Charges</CardTitle></CardHeader>
        <CardBody className="p-0">
          <Table>
            <THead><TR>
              <TH>Date</TH><TH>Description</TH>
              <TH className="text-right">Amount</TH><TH className="text-right">Paid</TH>
              <TH className="text-right">Balance</TH><TH>Status</TH>
            </TR></THead>
            <tbody>
              {(balances ?? []).map((c: any) => (
                <TR key={c.charge_id}>
                  <TD>{date(c.due_date)}</TD>
                  <TD>{c.description}</TD>
                  <TD className="text-right">{money(c.charged_amount)}</TD>
                  <TD className="text-right text-green-600">{money(c.applied_amount)}</TD>
                  <TD className={`text-right ${Number(c.balance_due) > 0 ? 'text-red-600 font-medium' : ''}`}>{money(c.balance_due)}</TD>
                  <TD><span className={`rounded px-2 py-0.5 text-xs ${
                    c.payment_status === 'paid' ? 'bg-green-100 text-green-700'
                    : c.payment_status === 'partial' ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                  }`}>{c.payment_status}</span></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      {/* ======== POST AD-HOC CHARGE ======== */}
      <Card>
        <CardHeader><CardTitle>Post a one-off charge</CardTitle></CardHeader>
        <CardBody>
          <form action={postAdHocCharge as any} className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <input type="hidden" name="unit_id" value={unitId} />
            <div>
              <Label htmlFor="adhoc_cat">Category</Label>
              <select id="adhoc_cat" name="charge_category_id" required
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="">ChooseÃ¢â‚¬Â¦</option>
                {(categories ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="adhoc_amount">Amount</Label>
              <Input id="adhoc_amount" name="amount" type="number" step="0.01" min="0" required />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="adhoc_desc">Description</Label>
              <Input id="adhoc_desc" name="description" required />
            </div>
            <div>
              <Label htmlFor="adhoc_due">Due date</Label>
              <Input id="adhoc_due" name="due_date" type="date" />
            </div>
            <div className="md:col-span-5 flex justify-end"><Button type="submit">Post charge</Button></div>
          </form>
        </CardBody>
      </Card>

      {/* ======== PAYMENTS HISTORY + MANUAL RECEIPT ======== */}
      <Card>
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        <CardBody>
          <Table>
            <THead><TR><TH>Date</TH><TH>Method</TH><TH>Reference</TH><TH className="text-right">Amount</TH><TH></TH></TR></THead>
            <tbody>
              {(payments ?? []).map((p: any) => (
                <TR key={p.id}>
                  <TD>{date(p.payment_date)}</TD>
                  <TD className="uppercase">{p.method}</TD>
                  <TD className="text-gray-600">{p.reference ?? p.notes ?? 'Ã¢â‚¬â€'}</TD>
                  <TD className="text-right text-green-600">{money(p.amount)}</TD>
                  <TD className="text-right">
                    <form action={unapplyPayment.bind(null, p.id, unitId) as any}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">Unapply</button>
                    </form>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          <form action={recordReceipt as any} className="mt-6 grid grid-cols-1 gap-3 border-t border-gray-100 pt-6 md:grid-cols-5">
            <input type="hidden" name="unit_id" value={unitId} />
            <div>
              <Label htmlFor="pay_date">Date</Label>
              <Input id="pay_date" name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required />
            </div>
            <div>
              <Label htmlFor="pay_amount">Amount</Label>
              <Input id="pay_amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div>
              <Label htmlFor="pay_method">Method</Label>
              <select id="pay_method" name="method" className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required>
                <option value="check">check</option><option value="ach">ach</option>
                <option value="card">card</option><option value="manual">manual</option><option value="other">other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pay_ref">Reference</Label>
              <Input id="pay_ref" name="reference" placeholder="Check #, ACH ID, etc." />
            </div>
            <div className="flex items-end"><Button type="submit" className="w-full">Record receipt</Button></div>
            <div className="md:col-span-5">
              <Label htmlFor="pay_notes">Notes</Label>
              <Input id="pay_notes" name="notes" placeholder="Optional" />
              <p className="mt-1 text-xs text-gray-500">Auto-applies to outstanding charges (late fees first, then oldest). Unapply above to redirect.</p>
            </div>
          </form>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}
