import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createVendor } from '@/lib/rpcs/entities';
import { vendorWorkflowCards } from '@/lib/vendors/workflows';

export const dynamic = 'force-dynamic';

const TRADES = [
  'hvac', 'plumbing', 'electrical', 'landscaping', 'roofing', 'general_contractor', 'handyperson', 'snow_removal',
  'pest_control', 'pool_spa', 'painting', 'keys_locks', 'fireplace_chimney', 'garage_doors', 'gutter_cleaning',
  'inspections', 'parking_driveways', 'preventative_maintenance', 'repairs_exterior', 'repairs_interior', 'septic',
  'trash_recycling', 'utilities', 'turnover', 'other',
];
const VENDOR_TYPES = ['general', 'insurance', 'legal', 'accounting', 'utility', 'other'];
const PAYMENT_TYPES = ['check', 'ach', 'wire', 'credit_card'];

export default async function NewVendorPage() {
  await requireStaff();

  return (
    <DataWorkspace
      title="New Vendor"
      description="Create the vendor record, capture tax/payment defaults, and route follow-up bank or document requests."
      actions={<Link href="/vendors" className="text-sm font-medium text-champagne-700 hover:underline">Back to vendors</Link>}
      rail={
        <div className="space-y-4">
          <div className="rounded border border-ink-100 bg-white p-3 text-sm text-ink-700">
            Add the core vendor first. ACH, W-9, and compliance requests can be staged immediately after the record exists.
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-ink-500">After save</div>
            <div className="mt-2 space-y-2">
              {vendorWorkflowCards.map((card) => (
                <Link key={card.href} href={card.href} className="block rounded border border-ink-100 p-3 text-sm hover:bg-cream-50">{card.title}</Link>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <form action={createVendor as any} className="max-w-5xl space-y-6 rounded border border-ink-100 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Vendor name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" required placeholder="e.g. Acme Plumbing Inc." />
          </div>
          <div>
            <Label htmlFor="vendor_type">Vendor type</Label>
            <select id="vendor_type" name="vendor_type" defaultValue="general" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              {VENDOR_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="trade">Trade</Label>
            <select id="trade" name="trade" defaultValue="other" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              {TRADES.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>

        <section className="border-t border-ink-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">Contact and remit-to address</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-4"><Label htmlFor="address_street">Street</Label><Input id="address_street" name="address_street" /></div>
            <div className="md:col-span-2"><Label htmlFor="address_city">City</Label><Input id="address_city" name="address_city" /></div>
            <div><Label htmlFor="address_state">State</Label><Input id="address_state" name="address_state" maxLength={2} className="uppercase" /></div>
            <div><Label htmlFor="address_zip">ZIP</Label><Input id="address_zip" name="address_zip" /></div>
          </div>
        </section>

        <section className="border-t border-ink-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">Tax and 1099</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label htmlFor="taxpayer_name">Taxpayer name</Label><Input id="taxpayer_name" name="taxpayer_name" placeholder="Name on W-9" /></div>
            <div><Label htmlFor="taxpayer_id">Taxpayer ID</Label><Input id="taxpayer_id" name="taxpayer_id" placeholder="EIN or SSN" /></div>
            <label className="flex items-start gap-3 rounded-md border border-ink-100 bg-cream-50 p-3">
              <input type="checkbox" name="send_1099" className="mt-1" />
              <span><span className="block text-sm font-medium text-ink-900">Send 1099 at year-end</span><span className="block text-xs text-ink-500">Use for service vendors paid at or above the filing threshold.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-ink-100 bg-cream-50 p-3">
              <input type="checkbox" name="is_utility" className="mt-1" />
              <span><span className="block text-sm font-medium text-ink-900">Utility vendor</span><span className="block text-xs text-ink-500">Utility vendors are tracked separately in reports.</span></span>
            </label>
          </div>
        </section>

        <section className="border-t border-ink-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">Payment defaults</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="payment_type">Preferred payment method</Label>
              <select id="payment_type" name="payment_type" defaultValue="check" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                {PAYMENT_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div><Label htmlFor="payment_terms">Payment terms</Label><Input id="payment_terms" name="payment_terms" placeholder="Net 30, due on receipt..." /></div>
          </div>
        </section>

        <section className="border-t border-ink-100 pt-5">
          <Label htmlFor="notes">Internal notes</Label>
          <textarea id="notes" name="notes" rows={3} className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm" placeholder="Scheduler, after-hours number, access instructions..." />
        </section>

        <div className="flex items-center justify-between border-t border-ink-100 pt-5">
          <Link href="/vendors" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
          <Button type="submit" size="lg">Create vendor</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
