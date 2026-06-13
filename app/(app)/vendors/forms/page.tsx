import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert, Surface } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  { value: 'vendor_intake', label: 'Vendor intake form' },
  { value: 'vendor_bank_account', label: 'Vendor bank account information' },
  { value: 'w9_request', label: 'W-9 request' },
  { value: 'document_request', label: 'Insurance / license document request' },
];

export default async function VendorFormsPage({ searchParams }: { searchParams: Promise<{ vendor?: string; template?: string; error?: string; sent?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: vendors } = await (supabase as any).from('vendors').select('id, name, trade').order('name').limit(500);

  async function handleSubmit(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const vendorId = (formData.get('vendor_id') as string) || null;
    if (!vendorId) redirect(`/vendors/forms?error=${encodeURIComponent('Select a vendor to send the form to.')}`);

    const template = (formData.get('template') as string) || 'vendor_intake';
    const subject = (formData.get('subject') as string) || 'Vendor form';
    const message = (formData.get('message') as string) || null;
    const delivery = (formData.get('delivery_method') as string) || 'email';
    const dueDate = (formData.get('due_date') as string) || null;

    // Vendor "forms" are document/compliance requests sent to a specific vendor.
    const { error } = await (supabase as any).from('document_requests').insert({
      portfolio_id: me.portfolio?.id,
      vendor_id: vendorId,
      doc_type: template,
      name: subject,
      description: message,
      due_date: dueDate,
      requested_by: me.auth_user_id,
      notes: `Delivery: ${delivery}`,
      status: 'requested',
    });
    if (error) {
      redirect(`/vendors/forms?error=${encodeURIComponent(error.message)}`);
    }
    redirect('/vendors/forms?sent=1');
  }

  return (
    <DataWorkspace
      title="Send Vendor Form"
      description="Stage vendor onboarding, bank, W-9, and compliance document requests."
      actions={<Link href="/vendors"><Button variant="secondary">Back to vendors</Button></Link>}
    >
      <div className="max-w-4xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not stage the form:">{sp.error}</Alert>}
        {sp.sent === '1' && <Alert tone="success" title="Form request sent">The document request was created for the vendor.</Alert>}
        <Surface>
          <form action={handleSubmit as any} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vendor" htmlFor="vendor_id">
                <Select id="vendor_id" name="vendor_id" defaultValue={sp.vendor ?? ''}>
                  <option value="">Select a vendor</option>
                  {(vendors ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name} - {v.trade}</option>)}
                </Select>
              </Field>
              <Field label="Template" htmlFor="template">
                <Select id="template" name="template" defaultValue={sp.template ?? 'vendor_intake'}>
                  {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Subject" htmlFor="subject">
              <Input id="subject" name="subject" defaultValue="Action requested" />
            </Field>
            <Field label="Message" htmlFor="message">
              <Textarea id="message" name="message" rows={4} placeholder="Enter message..." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Delivery" htmlFor="delivery_method">
                <Select id="delivery_method" name="delivery_method">
                  <option value="email">Email</option><option value="portal">Portal</option><option value="mail">Mail</option>
                </Select>
              </Field>
              <Field label="Due date (optional)" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Link href="/vendors"><Button variant="secondary" type="button">Cancel</Button></Link>
              <Button type="submit">Send form</Button>
            </div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
