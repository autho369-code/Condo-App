import { OwnerSelect } from '@/components/owners/owner-select';
import Link from 'next/link';
import { checkLinkedRecords, managesAssociation } from '@/lib/security/association-scope';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewManagementAgreementPage({ searchParams }: { searchParams: Promise<{ error?: string; owner?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: owners }, { data: associations }] = await Promise.all([
    (supabase as any).from('owners').select('id, full_name, association_id').is('archived_at', null).order('full_name').limit(1000),
    (supabase as any).from('associations').select('id, name').is('archived_at', null).order('name').limit(500),
  ]);

  async function handleSubmit(formData: FormData) {
    'use server';
    const me = await requireStaff();
    const supabase = await createClient();

    const associationId = (formData.get('association_id') as string) || null;
    const startDate = (formData.get('management_start_date') as string) || null;
    if (!startDate) redirect(`/owners/management-agreements/new?error=${encodeURIComponent('Management start date is required.')}`);

    const associationName = associationId
      ? (associations ?? []).find((a: any) => a.id === associationId)?.name
      : null;
    // RLS on management_agreements only checks portfolio_id: verify the
    // association and owner ids from the form belong to the caller.
    if (associationId && !(await managesAssociation(supabase, associationId))) {
      redirect(`/owners/management-agreements/new?error=${encodeURIComponent('That association is unavailable or outside your access.')}`);
    }
    const ownerError = await checkLinkedRecords(supabase, {
      associationId,
      ownerId: (formData.get('owner_id') as string) || null,
    });
    if (ownerError) redirect(`/owners/management-agreements/new?error=${encodeURIComponent(ownerError)}`);

    // start_date, name, terms (jsonb) and portfolio_id are NOT NULL on the table;
    // fee / signature-due / delivery have no columns, so they live in terms jsonb.
    const { data: created, error } = await (supabase as any).from('management_agreements').insert({
      portfolio_id: me.portfolio?.id,
      owner_id: (formData.get('owner_id') as string) || null,
      association_id: associationId,
      name: associationName ? `${associationName} management agreement` : 'Management agreement',
      status: 'draft',
      start_date: startDate,
      auto_renew: false,
      terms: {
        notes: (formData.get('terms') as string) || '',
        management_fee: formData.get('management_fee') ? parseFloat(formData.get('management_fee') as string) : null,
        signature_due_date: (formData.get('agreement_signature_due_date') as string) || null,
        delivery_method: (formData.get('delivery_method') as string) || 'email',
      },
      created_by: me.auth_user_id,
    }).select('id').single();
    if (error) redirect(`/owners/management-agreements/new?error=${encodeURIComponent(error.message)}`);
    redirect(`/owners/management-agreements/${created.id}?saved=${encodeURIComponent('Agreement created. Add terms and record signatures when executed.')}`);
  }

  return (
    <DataWorkspace
      title="New Management Agreement"
      description="Create an owner and association management agreement with fee schedule and delivery method."
      actions={<Link href="/owners"><Button variant="secondary">Back to owners</Button></Link>}
    >
      <form action={handleSubmit} className="max-w-4xl space-y-5 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create agreement">{sp.error}</Alert>}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="owner_id">Owner</Label>
            <OwnerSelect id="owner_id" name="owner_id" defaultValue={sp.owner ?? ''} owners={owners ?? []}
              associationNames={Object.fromEntries((associations ?? []).map((a: any) => [a.id, a.name]))} />
          </div>
          <div>
            <Label htmlFor="association_id">Association</Label>
            <select id="association_id" name="association_id" defaultValue={(owners ?? []).find((o: any) => o.id === sp.owner)?.association_id ?? ''} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="">Select association</option>
              {(associations ?? []).map((association: any) => <option key={association.id} value={association.id}>{association.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="management_start_date">Management start date <span className="text-red-500">*</span></Label>
            <Input id="management_start_date" name="management_start_date" type="date" required />
          </div>
          <div>
            <Label htmlFor="agreement_signature_due_date">Signature due date</Label>
            <Input id="agreement_signature_due_date" name="agreement_signature_due_date" type="date" />
          </div>
          <div>
            <Label htmlFor="management_fee">Management fee</Label>
            <Input id="management_fee" name="management_fee" type="number" step="0.01" min="0" placeholder="$0.00" />
          </div>
          <div>
            <Label htmlFor="delivery_method">Delivery method</Label>
            <select id="delivery_method" name="delivery_method" className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="email">Email signature request</option>
              <option value="portal">Owner portal</option>
              <option value="mail">Mail packet</option>
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="terms">Agreement notes</Label>
          <textarea id="terms" name="terms" rows={5} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Scope, owner obligations, reserve policy, termination notes..." />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-5">
          <Link href="/owners" className="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</Link>
          <Button type="submit">Create agreement</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
