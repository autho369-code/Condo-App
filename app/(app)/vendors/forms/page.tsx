import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  { value: 'vendor_intake', label: 'Vendor intake form' },
  { value: 'vendor_bank_account', label: 'Vendor bank account information' },
  { value: 'w9_request', label: 'W-9 request' },
  { value: 'document_request', label: 'Insurance / license document request' },
];

export default async function VendorFormsPage({ searchParams }: { searchParams: Promise<{ vendor?: string; template?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: vendors } = await (supabase as any).from('vendors').select('id, name, trade').order('name').limit(500);

  async function handleSubmit(formData: FormData) {
    'use server';
    const supabase = await createClient();
    await (supabase as any).from('notices').insert({
      vendor_id: formData.get('vendor_id') || null,
      template: formData.get('template') || 'vendor_intake',
      subject: formData.get('subject') || '',
      message: formData.get('message') || '',
      delivery_method: formData.get('delivery_method') || 'email',
      status: 'pending',
    });
    redirect('/vendors');
  }

  return (
    <DataWorkspace title="Send Vendor Form" description="Stage vendor onboarding, bank, W-9, and compliance document requests."
      actions={<Link href="/vendors" className="text-sm font-medium text-blue-700 hover:underline">Back to vendors</Link>}>
      <form action={handleSubmit as any} className="max-w-4xl space-y-5 rounded border border-gray-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label htmlFor="vendor_id">Vendor</Label>
            <select id="vendor_id" name="vendor_id" defaultValue={sp.vendor ?? ''} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select a vendor</option>
              {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name} - {v.trade}</option>)}
            </select>
          </div>
          <div><Label htmlFor="template">Template</Label>
            <select id="template" name="template" defaultValue={sp.template ?? 'vendor_intake'} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div><Label htmlFor="subject">Subject</Label>
          <input id="subject" name="subject" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" defaultValue="Action requested" />
        </div>
        <div><Label htmlFor="message">Message</Label>
          <textarea id="message" name="message" rows={4} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Enter message..." />
        </div>
        <div><Label htmlFor="delivery_method">Delivery</Label>
          <select id="delivery_method" name="delivery_method" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
            <option value="email">Email</option><option value="portal">Portal</option><option value="mail">Mail</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Link href="/vendors" className="inline-flex items-center h-10 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <Button type="submit">Send form</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
