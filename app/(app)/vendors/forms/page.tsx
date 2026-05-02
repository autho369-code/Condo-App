import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { vendorWorkflowCards } from '@/lib/vendors/workflows';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  { value: 'vendor_intake', label: 'Vendor intake form' },
  { value: 'vendor_bank_account', label: 'Vendor bank account information' },
  { value: 'w9_request', label: 'W-9 request' },
  { value: 'document_request', label: 'Insurance / license document request' },
];

export default async function VendorFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; template?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: vendors } = await (supabase as any)
    .from('vendors')
    .select('id, name, trade, archived_at')
    .is('archived_at', null)
    .order('name')
    .limit(500);

  return (
    <DataWorkspace
      title="Send Vendor Form"
      description="Stage vendor onboarding, bank, W-9, and compliance document requests for confirmation."
      actions={<Link href="/vendors" className="text-sm font-medium text-blue-700 hover:underline">Back to vendors</Link>}
      rail={
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-gray-500">Related workflows</div>
          {vendorWorkflowCards.map((card) => (
            <Link key={card.href} href={card.href} className="block rounded border border-gray-200 p-3 text-sm hover:bg-gray-50">{card.title}</Link>
          ))}
        </div>
      }
    >
      <form className="max-w-4xl space-y-5 rounded border border-gray-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="vendor_id">Vendor</Label>
            <select id="vendor_id" name="vendor_id" defaultValue={sp.vendor ?? ''} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select a vendor</option>
              {(vendors ?? []).map((vendor: any) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name} - {vendor.trade?.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="template">Template</Label>
            <select id="template" name="template" defaultValue={sp.template ?? 'vendor_intake'} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              {TEMPLATES.map((template) => <option key={template.value} value={template.value}>{template.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <input id="subject" name="subject" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" defaultValue="Vendor information request from Stellar Property Management" />
        </div>
        <div>
          <Label htmlFor="message">Message</Label>
          <textarea id="message" name="message" rows={6} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" defaultValue="Please review the requested vendor information and upload any required documents. This helps us keep payments and compliance records current." />
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Vendor requests are staged for review. Final delivery should require explicit confirmation and audit logging.
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary">Preview</Button>
          <Button type="button">Stage for confirmation</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
