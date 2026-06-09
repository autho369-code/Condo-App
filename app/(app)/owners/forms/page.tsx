import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  { value: 'portal_activation', label: 'Owner portal activation' },
  { value: 'owner_packet', label: 'Owner onboarding packet' },
  { value: 'ach_authorization', label: 'ACH authorization' },
  { value: 'management_agreement', label: 'Management agreement' },
  { value: 'owner_intake', label: 'Owner intake form' },
];

export default async function OwnerFormsPage({ searchParams }: { searchParams: Promise<{ owner?: string; template?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: owners } = await (supabase as any).from('owners').select('id, full_name, email').order('full_name').limit(500);

  async function handleSubmit(formData: FormData) {
    'use server';
    const supabase = await createClient();
    await (supabase as any).from('notices').insert({
      owner_id: formData.get('owner_id') || null,
      template: formData.get('template') || 'owner_intake',
      subject: formData.get('subject') || '',
      message: formData.get('message') || '',
      delivery_method: formData.get('delivery_method') || 'email',
      status: 'pending',
    });
    redirect('/owners');
  }

  return (
    <DataWorkspace title="Send Owner Form" description="Stage owner communications with recipient, template, and delivery context."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to owners</Link>}>
      <form action={handleSubmit as any} className="max-w-4xl space-y-5 rounded border border-gray-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div><Label htmlFor="owner_id">Owner</Label>
            <select id="owner_id" name="owner_id" defaultValue={sp.owner ?? ''} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select an owner</option>
              {(owners ?? []).map((owner: any) => <option key={owner.id} value={owner.id}>{owner.full_name} - {owner.email}</option>)}
            </select>
          </div>
          <div><Label htmlFor="template">Template</Label>
            <select id="template" name="template" defaultValue={sp.template ?? 'owner_intake'} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
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
            <option value="email">Email</option><option value="portal">Owner portal</option><option value="mail">Mail</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Link href="/owners" className="inline-flex items-center h-10 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Cancel</Link>
          <Button type="submit">Send form</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
