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
import { archiveUnitRenter, upsertUnitRenter } from '@/lib/rpcs/entities';
import { occupancyLabel, splitRenterName } from '@/lib/units/renter';
import { normalizeTextPhone } from '@/lib/communications/text-messages';
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
    { data: occupancies }, { data: tenancies },
  ] = await Promise.all([
    (supabase as any).from('units')
      .select('id, unit_number, bedrooms, bathrooms, sqft, buildings(name, association_id, associations(name))')
      .eq('id', unitId).maybeSingle(),
    (supabase as any).from('v_unit_account_summary').select('*').eq('unit_id', unitId).maybeSingle(),
    (supabase as any).from('v_unit_charge_schedule').select('*').eq('unit_id', unitId).eq('active', true).order('category_name'),
    (supabase as any).from('v_charge_balances').select('*').eq('unit_id', unitId).order('due_date', { ascending: false }).limit(50),
    (supabase as any).from('payments').select('id, amount, payment_date, method, reference, notes').eq('unit_id', unitId).order('payment_date', { ascending: false }).limit(30),
    (supabase as any).from('charge_categories').select('id, name, default_amount, default_frequency, charge_type').eq('portfolio_id', me.portfolio?.id).eq('active', true).order('sort_order'),
    (supabase as any).from('occupancies')
      .select('id, occupancy_type, status, is_primary, share_pct, owners(id, full_name, email, phone)')
      .eq('unit_id', unitId)
      .eq('occupancy_type', 'owner')
      .eq('status', 'current')
      .order('is_primary', { ascending: false }),
    (supabase as any).from('tenancies')
      .select('id, tenant_name, tenant_phone, tenant_email, created_at')
      .eq('unit_id', unitId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  if (!unit) notFound();
  const ownerOccupancies = (occupancies ?? []) as any[];
  const owners = ownerOccupancies
    .map((occupancy) => ({
      id: occupancy.owners?.id,
      name: occupancy.owners?.full_name,
      email: occupancy.owners?.email,
      phone: occupancy.owners?.phone,
      share: occupancy.share_pct,
      primary: occupancy.is_primary,
    }))
    .filter((owner) => owner.id || owner.name);
  const activeRenter = (tenancies ?? [])[0] as any | undefined;
  const renterName = splitRenterName(activeRenter?.tenant_name);
  const isRenterOccupied = Boolean(activeRenter);
  const communicationEmails = uniqueEmails([
    ...owners.map((owner) => owner.email),
    activeRenter?.tenant_email,
  ]);
  const communicationPhones = uniquePhones([
    ...owners.map((owner) => owner.phone),
    activeRenter?.tenant_phone,
  ]);
  const [{ data: emailMessages }, { data: phoneMessages }] = await Promise.all([
    communicationEmails.length
      ? (supabase as any)
        .from('communication_messages')
        .select('id, created_at, channel, recipient_name, recipient_email, recipient_phone, subject, body, status')
        .in('recipient_email', communicationEmails)
        .order('created_at', { ascending: false })
        .limit(20)
      : Promise.resolve({ data: [] }),
    communicationPhones.length
      ? (supabase as any)
        .from('communication_messages')
        .select('id, created_at, channel, recipient_name, recipient_email, recipient_phone, subject, body, status')
        .in('recipient_phone', communicationPhones)
        .order('created_at', { ascending: false })
        .limit(20)
      : Promise.resolve({ data: [] }),
  ]);
  const communicationMessages = dedupeMessages([...(emailMessages ?? []), ...(phoneMessages ?? [])]).slice(0, 12);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-ink-100 bg-white px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              <Link href="/units" className="hover:text-brand-600">Units</Link>
              {' Ã‚Â· '}
              <span className="text-ink-400">{(unit.buildings as any)?.associations?.name}</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-ink-900">Unit {unit.unit_number}</h1>
            <div className="mt-1 text-sm text-ink-500">
              {unit.bedrooms ? `${unit.bedrooms} bd` : ''}{unit.bathrooms ? ` Ã‚Â· ${unit.bathrooms} ba` : ''}{unit.sqft ? ` Ã‚Â· ${unit.sqft} sqft` : ''}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto bg-cream-50 px-8 py-6">

      {/* ======== ACCOUNT SUMMARY ======== */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total charged" value={money(summary?.total_charged ?? 0)} />
        <Stat label="Total paid" value={money(summary?.total_paid ?? 0)} />
        <Stat label="Outstanding"
          value={<span className={Number(summary?.outstanding_balance) > 0 ? 'text-bordeaux-600' : 'text-green-600'}>
            {money(summary?.outstanding_balance ?? 0)}
          </span>} />
        <Stat label="Credit on file"
          value={<span className="text-green-600">{money(summary?.unapplied_credit ?? 0)}</span>} />
      </div>

      {/* ======== OCCUPANCY ======== */}
      <Card>
        <CardHeader><CardTitle>Occupancy</CardTitle></CardHeader>
        <CardBody className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Current status</div>
              <div className={`mt-2 inline-flex rounded px-2.5 py-1 text-sm font-semibold ${isRenterOccupied ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>
                {occupancyLabel(isRenterOccupied)}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Owner</div>
              {owners.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {owners.map((owner) => (
                    <div key={owner.id ?? owner.name} className="rounded border border-ink-100 bg-cream-50 px-3 py-2">
                      <div className="font-medium text-ink-900">{owner.name}</div>
                      <div className="mt-1 text-xs text-ink-500">
                        {owner.primary ? 'Primary owner' : 'Owner'}{owner.share != null ? ` / ${Number(owner.share).toFixed(2)}%` : ''}
                      </div>
                      {(owner.email || owner.phone) && (
                        <div className="mt-1 text-xs text-ink-500">{[owner.email, owner.phone].filter(Boolean).join(' / ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-500">No owner is linked to this unit yet.</p>
              )}
            </div>
          </section>

          <section className="rounded border border-ink-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">Renter information</h2>
                <p className="mt-1 text-xs leading-5 text-ink-500">Only use this when the unit is renter occupied. Owner records remain separate.</p>
              </div>
              {activeRenter?.id && (
                <form action={archiveUnitRenter.bind(null, activeRenter.id, unitId) as any}>
                  <button type="submit" className="text-xs font-semibold text-bordeaux-600 hover:underline">Mark owner occupied</button>
                </form>
              )}
            </div>
            <form action={upsertUnitRenter.bind(null, unitId) as any} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="renter_first_name">First name</Label>
                <Input id="renter_first_name" name="renter_first_name" defaultValue={renterName.firstName} required />
              </div>
              <div>
                <Label htmlFor="renter_last_name">Last name</Label>
                <Input id="renter_last_name" name="renter_last_name" defaultValue={renterName.lastName} required />
              </div>
              <div>
                <Label htmlFor="renter_phone">Phone number</Label>
                <Input id="renter_phone" name="renter_phone" defaultValue={activeRenter?.tenant_phone ?? ''} />
              </div>
              <div>
                <Label htmlFor="renter_email">Email</Label>
                <Input id="renter_email" name="renter_email" type="email" defaultValue={activeRenter?.tenant_email ?? ''} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">{activeRenter ? 'Update renter' : 'Save renter'}</Button>
              </div>
            </form>
          </section>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Communication history</CardTitle></CardHeader>
        <CardBody className="p-0">
          {communicationMessages.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Channel</TH>
                  <TH>Recipient</TH>
                  <TH>Subject / Message</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {communicationMessages.map((message: any) => (
                  <TR key={message.id}>
                    <TD className="whitespace-nowrap text-xs text-ink-500">{date(message.created_at)}</TD>
                    <TD className="text-xs font-semibold uppercase text-ink-600">{message.channel}</TD>
                    <TD>
                      <div className="text-sm text-ink-900">{message.recipient_name ?? '-'}</div>
                      <div className="font-mono text-xs text-ink-500">{message.recipient_email ?? message.recipient_phone ?? '-'}</div>
                    </TD>
                    <TD className="max-w-lg truncate">{message.subject ?? message.body}</TD>
                    <TD className="text-xs capitalize text-ink-500">{message.status}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="px-5 py-6 text-center text-sm text-ink-500">No communication history for this unit yet.</p>
          )}
        </CardBody>
      </Card>

      {/* ======== RECURRING CHARGES (SUBSCRIPTIONS) ======== */}
      <Card>
        <CardHeader><CardTitle>Recurring charges</CardTitle></CardHeader>
        <CardBody>
          {schedule && schedule.length > 0 ? (
            <Table>
              <THead><TR>
                <TH>Category</TH><TH className="text-right">Amount</TH><TH>Frequency</TH>
                <TH>Next post</TH><TH>Memo</TH><TH></TH>
              </TR></THead>
              <tbody>
                {schedule.map((s: any) => (
                  <TR key={s.recurring_charge_id}>
                    <TD className="font-medium">{s.category_name}</TD>
                    <TD className="text-right">{money(s.amount)}</TD>
                    <TD className="capitalize">{s.frequency}</TD>
                    <TD>{date(s.next_post_date)}</TD>
                    <TD className="text-ink-600 text-sm">{s.memo ?? 'Ã¢â‚¬â€'}</TD>
                    <TD className="text-right">
                      <form action={unsubscribeUnit.bind(null, s.recurring_charge_id, unitId) as any}>
                        <button type="submit" className="text-xs text-bordeaux-600 hover:underline">End</button>
                      </form>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-sm text-ink-500">No active recurring charges.</p>
          )}

          {/* Subscribe form */}
          <form action={subscribeUnitToCharge as any} className="mt-4 grid grid-cols-1 gap-3 border-t border-ink-100 pt-4 md:grid-cols-5">
            <input type="hidden" name="unit_id" value={unitId} />
            <div className="md:col-span-2">
              <Label htmlFor="charge_category_id">Add subscription</Label>
              <select id="charge_category_id" name="charge_category_id" required
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
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
              <select id="frequency" name="frequency" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">default</option><option>monthly</option><option>quarterly</option><option>annually</option>
              </select>
            </div>
            <div className="flex items-end"><Button type="submit" className="w-full">Add</Button></div>
            <div className="md:col-span-5">
              <Input name="memo" placeholder="Optional memo (e.g. 'Parking Spot 14')" />
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
                  <TD className={`text-right ${Number(c.balance_due) > 0 ? 'text-bordeaux-600 font-medium' : ''}`}>{money(c.balance_due)}</TD>
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
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
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
                  <TD className="text-ink-600">{p.reference ?? p.notes ?? 'Ã¢â‚¬â€'}</TD>
                  <TD className="text-right text-green-600">{money(p.amount)}</TD>
                  <TD className="text-right">
                    <form action={unapplyPayment.bind(null, p.id, unitId) as any}>
                      <button type="submit" className="text-xs text-bordeaux-600 hover:underline">Unapply</button>
                    </form>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>

          <form action={recordReceipt as any} className="mt-6 grid grid-cols-1 gap-3 border-t border-ink-100 pt-6 md:grid-cols-5">
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
              <select id="pay_method" name="method" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm" required>
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
              <p className="mt-1 text-xs text-ink-500">Auto-applies to outstanding charges (late fees first, then oldest). Unapply above to redirect.</p>
            </div>
          </form>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}

function uniqueEmails(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const value of values) {
    const email = value?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

function uniquePhones(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const value of values) {
    const phone = normalizeTextPhone(value);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    phones.push(phone);
  }
  return phones;
}

function dedupeMessages(messages: any[]) {
  const seen = new Set<string>();
  return messages
    .filter((message) => {
      if (!message?.id || seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    })
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
}
