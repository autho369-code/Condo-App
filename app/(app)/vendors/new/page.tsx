import Link from 'next/link';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createVendor } from '@/lib/rpcs/entities';

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
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={<Link href="/vendors" className="hover:text-brand-600">Vendors</Link>}
          title="New vendor"
          subtitle="Any contractor, utility, or service provider you&apos;ll pay."
        />
      }
      rail={
        <>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">About 1099s</div>
          <p className="text-xs text-gray-700">
            Flag <strong>Send 1099</strong> on any vendor you&apos;ll pay $600+ in a year for services. Our 1099 reports pull from this flag.
          </p>
          <p className="mt-2 text-xs text-gray-700">
            Utilities and corporations are usually exempt — don&apos;t flag them.
          </p>

          <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Good to know</div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="rounded border border-gray-200 p-3">
              <div className="font-medium">Default GL account</div>
              <div className="mt-0.5 text-xs text-gray-500">Set on the vendor detail page. Auto-fills on new bills.</div>
            </li>
            <li className="rounded border border-gray-200 p-3">
              <div className="font-medium">ACH setup</div>
              <div className="mt-0.5 text-xs text-gray-500">Collect bank info later — the detail form lets you enter it securely.</div>
            </li>
          </ul>
        </>
      }
    >
      <Section title="Vendor details">
        <form action={createVendor as any} className="space-y-6 px-5 py-5">
          {/* --- Basic --- */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="name">Vendor name <span className="text-red-500">*</span></Label>
              <Input id="name" name="name" required placeholder="e.g. Acme Plumbing Inc." />
            </div>
            <div>
              <Label htmlFor="vendor_type">Vendor type</Label>
              <select id="vendor_type" name="vendor_type" defaultValue="general"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                {VENDOR_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="trade">Trade</Label>
              <select id="trade" name="trade" defaultValue="other"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                {TRADES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* --- Address --- */}
          <div className="border-t border-gray-100 pt-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Remit-to address (prints on checks)</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-4">
                <Label htmlFor="address_street">Street</Label>
                <Input id="address_street" name="address_street" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address_city">City</Label>
                <Input id="address_city" name="address_city" />
              </div>
              <div>
                <Label htmlFor="address_state">State</Label>
                <Input id="address_state" name="address_state" maxLength={2} className="uppercase" />
              </div>
              <div>
                <Label htmlFor="address_zip">ZIP</Label>
                <Input id="address_zip" name="address_zip" />
              </div>
            </div>
          </div>

          {/* --- Tax --- */}
          <div className="border-t border-gray-100 pt-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Tax & 1099</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="taxpayer_name">Taxpayer name</Label>
                <Input id="taxpayer_name" name="taxpayer_name" placeholder="Name on W-9 (may differ from business name)" />
              </div>
              <div>
                <Label htmlFor="taxpayer_id">Taxpayer ID (EIN or SSN)</Label>
                <Input id="taxpayer_id" name="taxpayer_id" placeholder="XX-XXXXXXX" />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 cursor-pointer">
                  <input type="checkbox" name="send_1099" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Send 1099 at year-end</div>
                    <div className="text-xs text-gray-500">Required for any vendor paid $600+/year for services (not goods, not utilities).</div>
                  </div>
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 cursor-pointer">
                  <input type="checkbox" name="is_utility" className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Is a utility</div>
                    <div className="text-xs text-gray-500">Utilities are exempt from 1099 and show up in utility-specific reports.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* --- Payment --- */}
          <div className="border-t border-gray-100 pt-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Payment</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="payment_type">Preferred payment method</Label>
                <select id="payment_type" name="payment_type" defaultValue="check"
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                  {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="payment_terms">Payment terms</Label>
                <Input id="payment_terms" name="payment_terms" placeholder="e.g. Net 30, Due on receipt" />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              For ACH, you can add bank details on the vendor detail page once the record is created.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <Label htmlFor="notes">Internal notes</Label>
            <textarea id="notes" name="notes" rows={2}
              placeholder="e.g. After-hours number, preferred scheduler, key pickup instructions…"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-5">
            <Link href="/vendors" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
            <Button type="submit" size="lg">Create vendor</Button>
          </div>
        </form>
      </Section>
    </Workspace>
  );
}
