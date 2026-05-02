import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function NewManagementAgreementPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: owners }, { data: associations }] = await Promise.all([
    supabase.from('owners').select('id, full_name, email, archived_at').is('archived_at', null).order('full_name').limit(500),
    supabase.from('associations').select('id, name, archived_at').is('archived_at', null).order('name').limit(500),
  ]);

  return (
    <DataWorkspace
      title="New Management Agreement"
      description="Draft the owner and association agreement package, then route it through review and signature."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to homeowners</Link>}
      rail={<div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">Agreement drafts should capture owner, association, fee schedule, management dates, and signature delivery method before any outbound send.</div>}
    >
      <form className="max-w-4xl space-y-5 rounded border border-gray-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="owner_id">Owner</Label>
            <select id="owner_id" name="owner_id" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select owner</option>
              {(owners ?? []).map((owner: any) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="association_id">Association</Label>
            <select id="association_id" name="association_id" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select association</option>
              {(associations ?? []).map((association: any) => <option key={association.id} value={association.id}>{association.name}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="management_start_date">Management start date</Label>
            <Input id="management_start_date" name="management_start_date" type="date" />
          </div>
          <div>
            <Label htmlFor="agreement_signature_due_date">Signature due date</Label>
            <Input id="agreement_signature_due_date" name="agreement_signature_due_date" type="date" />
          </div>
          <div>
            <Label htmlFor="management_fee">Management fee</Label>
            <Input id="management_fee" name="management_fee" placeholder="$0.00" />
          </div>
          <div>
            <Label htmlFor="delivery_method">Delivery method</Label>
            <select id="delivery_method" name="delivery_method" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="email">Email signature request</option>
              <option value="portal">Owner portal</option>
              <option value="mail">Mail packet</option>
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="terms">Agreement notes</Label>
          <textarea id="terms" name="terms" rows={5} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Scope, owner obligations, reserve policy, termination notes..." />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-5">
          <Button type="button" variant="secondary">Preview agreement</Button>
          <Button type="button">Stage agreement</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
