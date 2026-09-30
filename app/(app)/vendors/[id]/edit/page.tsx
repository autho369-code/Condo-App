import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireWorkspaceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { CHECK_CONSOLIDATION, CHECK_STUB, VENDOR_PAYMENT_TYPES, VENDOR_TRADES, VENDOR_TYPES, tradeLabel } from '@/lib/vendors/options';
import { updateVendorRecord } from '../../actions';

export const dynamic = 'force-dynamic';

const SELECT =
  'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const label = (v: string) => v.replace(/_/g, ' ');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-100 pt-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</div>
      {children}
    </section>
  );
}

function Check({ name, defaultChecked, title, hint, disabled }: { name: string; defaultChecked: boolean; title: string; hint: string; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="mt-1" />
      <span>
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </label>
  );
}

export default async function EditVendorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireWorkspaceStaff();
  const { id } = await params;
  const sp = await searchParams;
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) notFound();
  const db = (await createClient()) as any;

  const [{ data: v }, { data: glAccounts }] = await Promise.all([
    db.from('vendors').select('*').eq('id', id).eq('portfolio_id', portfolioId).is('archived_at', null).maybeSingle(),
    db
      .from('gl_accounts')
      .select('id, number, name')
      .eq('portfolio_id', portfolioId)
      .eq('active', true)
      .in('account_type', ['expense', 'cost_of_goods_sold', 'other_expense'])
      .order('number'),
  ]);
  if (!v) notFound();

  const phones: Array<{ type?: string; number?: string }> = Array.isArray(v.phone_numbers) ? v.phone_numbers : [];
  const phone = (t: string) => phones.find((p) => p.type === t)?.number ?? '';
  const emails: string[] = Array.isArray(v.emails) ? v.emails : [];
  const canEditBank = !!(me.is_finance_staff || me.is_company_admin || me.is_platform_operator);
  const acct: string | null = v.bank_account_number ?? null;

  return (
    <DataWorkspace
      title={`Edit ${v.name}`}
      description="Contact, tax, accounting defaults, payment method and compliance dates."
      actions={<Link href={`/vendors/${id}`}><Button variant="secondary">Cancel</Button></Link>}
    >
      {sp.error && <Alert className="mb-6 max-w-5xl" title="Could not save vendor:">{sp.error}</Alert>}

      <form action={updateVendorRecord} className="max-w-5xl space-y-6 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <input type="hidden" name="vendor_id" value={id} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Vendor name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" required defaultValue={v.name} />
          </div>
          <div>
            <Label htmlFor="vendor_type">Vendor type</Label>
            <select id="vendor_type" name="vendor_type" defaultValue={v.vendor_type ?? 'general'} className={SELECT}>
              {VENDOR_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="trade">Trade</Label>
            <select id="trade" name="trade" defaultValue={v.trade ?? 'other'} className={SELECT}>
              {VENDOR_TRADES.map((t) => <option key={t} value={t}>{tradeLabel(t)}</option>)}
            </select>
          </div>
        </div>

        <Section title="Contact">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <Label htmlFor="emails">Emails</Label>
              <Input id="emails" name="emails" defaultValue={emails.join(', ')} placeholder="one@example.com, two@example.com" />
              <p className="mt-1 text-xs text-gray-500">Separate several addresses with commas. The first is used for portal invitations.</p>
            </div>
            <div><Label htmlFor="phone_landline">Phone (landline)</Label><Input id="phone_landline" name="phone_landline" type="tel" defaultValue={phone('landline')} /></div>
            <div><Label htmlFor="phone_mobile">Phone (mobile)</Label><Input id="phone_mobile" name="phone_mobile" type="tel" defaultValue={phone('mobile')} /></div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-4"><Label htmlFor="address_street">Street</Label><Input id="address_street" name="address_street" defaultValue={v.address_street ?? ''} /></div>
            <div className="md:col-span-2"><Label htmlFor="address_city">City</Label><Input id="address_city" name="address_city" defaultValue={v.address_city ?? ''} /></div>
            <div><Label htmlFor="address_state">State</Label><Input id="address_state" name="address_state" maxLength={2} className="uppercase" defaultValue={v.address_state ?? ''} /></div>
            <div><Label htmlFor="address_zip">ZIP</Label><Input id="address_zip" name="address_zip" defaultValue={v.address_zip ?? ''} /></div>
          </div>
        </Section>

        <Section title="Tax and 1099">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><Label htmlFor="taxpayer_name">Taxpayer name</Label><Input id="taxpayer_name" name="taxpayer_name" defaultValue={v.taxpayer_name ?? ''} /></div>
            <div><Label htmlFor="taxpayer_id">Taxpayer ID</Label><Input id="taxpayer_id" name="taxpayer_id" defaultValue={v.taxpayer_id ?? ''} placeholder="EIN or SSN" /></div>
            <div><Label htmlFor="tax_account_number">Tax form account number</Label><Input id="tax_account_number" name="tax_account_number" defaultValue={v.tax_account_number ?? ''} /></div>
            <Check name="send_1099" defaultChecked={!!v.send_1099} title="Send 1099 at year-end" hint="Service vendors paid at or above the filing threshold." />
            <Check name="is_utility" defaultChecked={!!v.is_utility} title="Utility vendor" hint="Tracked separately in reports." />
          </div>
        </Section>

        <Section title="Accounting information">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="check_consolidation">Check consolidation</Label>
              <select id="check_consolidation" name="check_consolidation" defaultValue={v.check_consolidation ?? 'single_check'} className={SELECT}>
                {CHECK_CONSOLIDATION.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="check_stub_breakdown">Check stub breakdown</Label>
              <select id="check_stub_breakdown" name="check_stub_breakdown" defaultValue={v.check_stub_breakdown ?? 'expanded'} className={SELECT}>
                {CHECK_STUB.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div><Label htmlFor="payment_terms">Payment terms</Label><Input id="payment_terms" name="payment_terms" defaultValue={v.payment_terms ?? ''} placeholder="Net 30, due on receipt…" /></div>
            <div><Label htmlFor="default_check_memo">Default check memo</Label><Input id="default_check_memo" name="default_check_memo" defaultValue={v.default_check_memo ?? ''} /></div>
            <div>
              <Label htmlFor="default_gl_account_id">Default GL account</Label>
              <select id="default_gl_account_id" name="default_gl_account_id" defaultValue={v.default_gl_account_id ?? ''} className={SELECT}>
                <option value="">— None —</option>
                {(glAccounts ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.number} · {g.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="work_order_adjustment">Work order adjustment (%)</Label>
              <Input id="work_order_adjustment" name="work_order_adjustment" type="number" step="0.01" min={0} max={100} defaultValue={Number(v.work_order_adjustment ?? 0)} />
              <p className="mt-1 text-xs text-gray-500">Percentage discount applied to this vendor&apos;s work order costs (0–100).</p>
            </div>
            <Check name="hold_payments" defaultChecked={!!v.hold_payments} title="Hold payments" hint="Bills stay unpaid until you clear this." />
            <Check name="email_echeck_receipt" defaultChecked={v.email_echeck_receipt !== false} title="Email eCheck receipt" hint="Send the vendor a receipt when an electronic payment goes out." />
          </div>
        </Section>

        <Section title="Payment method">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="payment_type">Payment type</Label>
              <select id="payment_type" name="payment_type" defaultValue={v.payment_type ?? 'check'} className={SELECT}>
                {VENDOR_PAYMENT_TYPES.map((t) => <option key={t} value={t}>{label(t).toUpperCase()}</option>)}
              </select>
            </div>
            <Check name="savings_account" defaultChecked={!!v.savings_account} disabled={!canEditBank} title="Savings account" hint="The deposit account below is a savings account." />
            <div>
              <Label htmlFor="bank_routing_number">Bank routing number</Label>
              <Input id="bank_routing_number" name="bank_routing_number" inputMode="numeric" defaultValue={v.bank_routing_number ?? ''} readOnly={!canEditBank} />
            </div>
            <div>
              <Label htmlFor="bank_account_number">Bank account number</Label>
              <Input
                id="bank_account_number"
                name="bank_account_number"
                inputMode="numeric"
                autoComplete="off"
                readOnly={!canEditBank}
                placeholder={acct ? `On file — ending ${acct.slice(-4)}. Leave blank to keep.` : 'Vendor deposit account'}
              />
            </div>
          </div>
          {!canEditBank && <p className="mt-2 text-xs text-gray-500">Only accounting staff can change bank details.</p>}
        </Section>

        <Section title="Compliance and insurance">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {([
              ['workers_comp_expiration', "Workers' comp expires"],
              ['general_liability_expiration', 'General liability expires'],
              ['auto_insurance_expiration', 'Auto insurance expires'],
              ['epa_certification_expiration', 'EPA certification expires'],
              ['state_license_expiration', 'State license expires'],
              ['contract_expiration', 'Contract expires'],
            ] as const).map(([k, l]) => (
              <div key={k}><Label htmlFor={k}>{l}</Label><Input id={k} name={k} type="date" defaultValue={v[k] ?? ''} /></div>
            ))}
          </div>
        </Section>

        <Section title="Internal notes">
          <Textarea id="notes" name="notes" rows={4} defaultValue={v.notes ?? ''} placeholder="Scheduler, after-hours number, access instructions…" />
        </Section>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href={`/vendors/${id}`} className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Save vendor</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
