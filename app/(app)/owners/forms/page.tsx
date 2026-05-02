import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { ownerWorkflowCards } from '@/lib/people/owner-workflows';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  { value: 'portal_activation', label: 'Owner portal activation' },
  { value: 'owner_packet', label: 'Owner onboarding packet' },
  { value: 'ach_authorization', label: 'ACH authorization' },
  { value: 'management_agreement', label: 'Management agreement' },
  { value: 'owner_intake', label: 'Owner intake form' },
];

export default async function OwnerFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; template?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: owners } = await (supabase as any)
    .from('owners')
    .select('id, full_name, email, archived_at')
    .is('archived_at', null)
    .order('full_name')
    .limit(500);

  return (
    <DataWorkspace
      title="Send Owner Form"
      description="Stage owner communications and form packages with recipient, template, and delivery context before confirmation."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to homeowners</Link>}
      rail={
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-gray-500">Related workflows</div>
          {ownerWorkflowCards.map((card) => (
            <Link key={card.href} href={card.href} className="block rounded border border-gray-200 p-3 text-sm hover:bg-gray-50">{card.title}</Link>
          ))}
        </div>
      }
    >
      <form className="max-w-4xl space-y-5 rounded border border-gray-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="owner_id">Owner</Label>
            <select id="owner_id" name="owner_id" defaultValue={sp.owner ?? ''} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select an owner</option>
              {(owners ?? []).map((owner: any) => (
                <option key={owner.id} value={owner.id}>{owner.full_name} - {owner.email}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="template">Template</Label>
            <select id="template" name="template" defaultValue={sp.template ?? 'owner_intake'} className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              {TEMPLATES.map((template) => <option key={template.value} value={template.value}>{template.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <input id="subject" name="subject" className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" defaultValue="Action requested from Stellar Property Management" />
        </div>
        <div>
          <Label htmlFor="message">Message</Label>
          <textarea id="message" name="message" rows={6} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" defaultValue="Please review the attached owner form and complete any required fields. Contact our team if any information looks incorrect." />
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This composer is staged for review. Final delivery should require explicit confirmation and audit logging.
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary">Preview</Button>
          <Button type="button">Stage for confirmation</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
