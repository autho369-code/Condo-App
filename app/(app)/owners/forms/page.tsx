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
  { value: 'portal_activation', label: 'Owner portal activation' },
  { value: 'owner_packet', label: 'Owner onboarding packet' },
  { value: 'ach_authorization', label: 'ACH authorization' },
  { value: 'management_agreement', label: 'Management agreement' },
  { value: 'owner_intake', label: 'Owner intake form' },
];

export default async function OwnerFormsPage({ searchParams }: { searchParams: Promise<{ owner?: string; template?: string; error?: string; sent?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: owners } = await (supabase as any).from('owners').select('id, full_name, email').order('full_name').limit(500);

  async function handleSubmit(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();
    const ownerId = (formData.get('owner_id') as string) || null;
    if (!ownerId) redirect(`/owners/forms?error=${encodeURIComponent('Select an owner to send the form to.')}`);

    const template = (formData.get('template') as string) || 'owner_intake';
    const subject = (formData.get('subject') as string) || 'Owner form';
    const message = (formData.get('message') as string) || null;
    const delivery = (formData.get('delivery_method') as string) || 'email';
    const dueDate = (formData.get('due_date') as string) || null;

    // These owner "forms" are document/form requests sent to a specific owner.
    const { error } = await (supabase as any).from('document_requests').insert({
      portfolio_id: me.portfolio?.id,
      owner_id: ownerId,
      doc_type: template,
      name: subject,
      description: message,
      due_date: dueDate,
      requested_by: me.auth_user_id,
      notes: `Delivery: ${delivery}`,
      status: 'requested',
    });
    if (error) {
      redirect(`/owners/forms?error=${encodeURIComponent(error.message)}`);
    }
    redirect('/owners/forms?sent=1');
  }

  return (
    <DataWorkspace
      title="Send Owner Form"
      description="Stage owner communications with recipient, template, and delivery context."
      actions={<Link href="/owners"><Button variant="secondary">Back to owners</Button></Link>}
    >
      <div className="max-w-4xl space-y-4">
        {sp.error && <Alert tone="danger" title="Could not stage the form:">{sp.error}</Alert>}
        {sp.sent === '1' && <Alert tone="success" title="Form request sent">The document request was created for the owner.</Alert>}
        <Surface>
          <form action={handleSubmit as any} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner" htmlFor="owner_id">
                <Select id="owner_id" name="owner_id" defaultValue={sp.owner ?? ''}>
                  <option value="">Select an owner</option>
                  {(owners ?? []).map((owner: any) => <option key={owner.id} value={owner.id}>{owner.full_name} - {owner.email}</option>)}
                </Select>
              </Field>
              <Field label="Template" htmlFor="template">
                <Select id="template" name="template" defaultValue={sp.template ?? 'owner_intake'}>
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
                  <option value="email">Email</option><option value="portal">Owner portal</option><option value="mail">Mail</option>
                </Select>
              </Field>
              <Field label="Due date (optional)" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Link href="/owners"><Button variant="secondary" type="button">Cancel</Button></Link>
              <Button type="submit">Send form</Button>
            </div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
