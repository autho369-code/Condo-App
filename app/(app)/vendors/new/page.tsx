import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createVendor } from '@/lib/rpcs/entities';
import { createClient } from '@/lib/supabase/server';
import { VENDOR_PAYMENT_TYPES as PAYMENT_TYPES, VENDOR_TRADES as TRADES, VENDOR_TYPES, tradeLabel } from '@/lib/vendors/options';

export const dynamic = 'force-dynamic';


export default async function NewVendorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireStaff();
  const canEditFinancials = !!(me.is_finance_staff || me.is_company_admin || me.is_platform_operator);
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: associations, error: associationsError } = await (supabase as any)
    .from('associations').select('id, name, portfolio_id, portfolios(company_name)').is('archived_at', null).order('name');
  // A platform operator sees every company's associations: name the company so
  // same-named associations of different companies can't be confused.
  const manyCompanies = new Set((associations ?? []).map((a: any) => a.portfolio_id)).size > 1;

  return (
    <DataWorkspace
      title="New Vendor"
      description="Create the vendor record, capture tax/payment defaults, and route follow-up bank or document requests."
      actions={<Link href="/vendors"><Button variant="secondary">Back to vendors</Button></Link>}
    >
      {sp.error && (
        <div className="mb-6 max-w-5xl"><Alert tone="danger" title="Could not create vendor">{sp.error}</Alert></div>
      )}

      {associationsError && (
        <div className="mb-6 max-w-5xl"><Alert tone="danger" title="Could not load associations">{associationsError.message}</Alert></div>
      )}

      <form action={createVendor as any} className="max-w-5xl space-y-6 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="association_id">Association <span className="text-red-500">*</span></Label>
            <Select id="association_id" name="association_id" defaultValue="">
              <option value="">Select association</option>
              {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{manyCompanies ? `${a.name} · ${a.portfolios?.company_name ?? 'Unnamed company'}` : a.name}</option>)}
            </Select>
            <p className="mt-1 text-xs text-gray-500">Each association has its own vendors. A company that works for another association is added there as its own vendor.</p>
          </div>
          {canEditFinancials && (
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3 md:col-span-2">
              <input type="checkbox" name="is_management_company" className="mt-1" />
              <span><span className="block text-sm font-medium text-gray-900">This is the management company</span><span className="block text-xs text-gray-500">The one vendor that belongs to the company instead of an association: management fees are billed to it from every association. Leave the association empty.</span></span>
            </label>
          )}
          <div className="md:col-span-2">
            <Label htmlFor="name">Vendor name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" required placeholder="e.g. Acme Plumbing Inc." />
          </div>
          <div>
            <Label htmlFor="vendor_type">Vendor type</Label>
            <select id="vendor_type" name="vendor_type" defaultValue="general" className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              {VENDOR_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="trade">Trade</Label>
            <select id="trade" name="trade" defaultValue="other" className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              {TRADES.map((type) => <option key={type} value={type}>{tradeLabel(type)}</option>)}
            </select>
          </div>
        </div>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="vendor@example.com" /></div>
            <div><Label htmlFor="phone_landline">Phone (landline)</Label><Input id="phone_landline" name="phone_landline" type="tel" placeholder="312-555-0100" /></div>
            <div><Label htmlFor="phone_mobile">Phone (mobile)</Label><Input id="phone_mobile" name="phone_mobile" type="tel" placeholder="312-555-0200" /></div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Contact and remit-to address</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-4"><Label htmlFor="address_street">Street</Label><Input id="address_street" name="address_street" /></div>
            <div className="md:col-span-2"><Label htmlFor="address_city">City</Label><Input id="address_city" name="address_city" /></div>
            <div><Label htmlFor="address_state">State</Label><Input id="address_state" name="address_state" maxLength={2} className="uppercase" /></div>
            <div><Label htmlFor="address_zip">ZIP</Label><Input id="address_zip" name="address_zip" /></div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Compliance & insurance tracking</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><Label htmlFor="workers_comp_expiration">Workers comp expires</Label><Input id="workers_comp_expiration" name="workers_comp_expiration" type="date" /></div>
            <div><Label htmlFor="general_liability_expiration">General liability expires</Label><Input id="general_liability_expiration" name="general_liability_expiration" type="date" /></div>
            <div><Label htmlFor="auto_insurance_expiration">Auto insurance expires</Label><Input id="auto_insurance_expiration" name="auto_insurance_expiration" type="date" /></div>
            <div><Label htmlFor="epa_certification_expiration">EPA cert expires</Label><Input id="epa_certification_expiration" name="epa_certification_expiration" type="date" /></div>
            <div><Label htmlFor="state_license_expiration">State license expires</Label><Input id="state_license_expiration" name="state_license_expiration" type="date" /></div>
            <div><Label htmlFor="contract_expiration">Contract expires</Label><Input id="contract_expiration" name="contract_expiration" type="date" /></div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Tax and 1099</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label htmlFor="taxpayer_name">Taxpayer name</Label><Input id="taxpayer_name" name="taxpayer_name" placeholder="Name on W-9" /></div>
            {canEditFinancials && <div><Label htmlFor="taxpayer_id">Taxpayer ID</Label><Input id="taxpayer_id" name="taxpayer_id" autoComplete="off" placeholder="EIN or SSN" /></div>}
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <input type="checkbox" name="send_1099" className="mt-1" />
              <span><span className="block text-sm font-medium text-gray-900">Send 1099 at year-end</span><span className="block text-xs text-gray-500">Use for service vendors paid at or above the filing threshold.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
              <input type="checkbox" name="is_utility" className="mt-1" />
              <span><span className="block text-sm font-medium text-gray-900">Utility vendor</span><span className="block text-xs text-gray-500">Utility vendors are tracked separately in reports.</span></span>
            </label>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Payment defaults</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="payment_type">Preferred payment method</Label>
              <select id="payment_type" name="payment_type" defaultValue="check" className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                {PAYMENT_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div><Label htmlFor="payment_terms">Payment terms</Label><Input id="payment_terms" name="payment_terms" placeholder="Net 30, due on receipt..." /></div>
            {canEditFinancials ? (
              <>
                <div>
                  <Label htmlFor="bank_routing_number">Bank routing # (for ACH)</Label>
                  <Input id="bank_routing_number" name="bank_routing_number" inputMode="numeric" placeholder="9 digits — required for ACH payments" />
                </div>
                <div>
                  <Label htmlFor="bank_account_number">Bank account # (for ACH)</Label>
                  <Input id="bank_account_number" name="bank_account_number" inputMode="numeric" autoComplete="off" placeholder="Vendor's deposit account" />
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 md:col-span-2">Accounting staff add the vendor&apos;s taxpayer ID and bank details after the vendor is created.</p>
            )}
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <Label htmlFor="notes">Internal notes</Label>
          <textarea id="notes" name="notes" rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Scheduler, after-hours number, access instructions..." />
        </section>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/vendors" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create vendor</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
