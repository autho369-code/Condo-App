import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { saveManagementAgreement } from '@/lib/people/owner-workflow-actions';
import { redirect } from 'next/navigation';

async function handleSaveAgreement(formData: FormData) {
  'use server';
  const result = await saveManagementAgreement(formData);
  if (result.ok) redirect('/owners/management-agreements/new?ok=Agreement+saved');
  redirect('/owners/management-agreements/new?error=' + encodeURIComponent(result.error));
}

export const dynamic = 'force-dynamic';

export default async function NewManagementAgreementPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: owners }, { data: agreements }] = await Promise.all([
    db.from('owners').select('id, full_name, email, archived_at').is('archived_at', null).order('full_name').limit(500),
    db.from('management_agreements').select('id, owner_id, status, created_at').order('created_at', { ascending: false }).limit(100),
  ]);

  const statusByOwner = new Map();
  for (const a of (agreements ?? [])) { if (!statusByOwner.has(a.owner_id)) statusByOwner.set(a.owner_id, a); }

  return (
    <DataWorkspace
      title="Management Agreement"
      description="Create an in-app management agreement. Admin fills the terms, owner signs electronically through the portal. No fake text, no PDFs by default."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to homeowners</Link>}
      rail={
        <div className="space-y-2 text-sm">
          {sp.ok && <div className="rounded border border-green-200 bg-green-50 p-3 text-xs text-green-800">{sp.ok}</div>}
          {sp.error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">{sp.error}</div>}
          <div className="rounded border border-gray-200 bg-white p-3 text-gray-700">
            <p className="font-semibold mb-2">Existing Agreements</p>
            {(agreements ?? []).slice(0, 10).map((a: any) => (
              <div key={a.id} className="flex justify-between text-xs py-1 border-b border-gray-100">
                <span>{statusByOwner.get(a.owner_id) ? owners?.find((o: any) => o.id === a.owner_id)?.full_name : a.id.slice(0, 8)}</span>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <form action={handleSaveAgreement} className="max-w-4xl space-y-5 rounded border border-gray-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="owner_id">Owner *</Label>
            <select id="owner_id" name="owner_id" required className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
              <option value="">Select owner</option>
              {(owners ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.full_name} — {o.email}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="term_months">Term (months)</Label>
            <Input id="term_months" name="term_months" type="number" defaultValue={12} />
          </div>
          <div>
            <Label htmlFor="management_fee">Management fee (%)</Label>
            <Input id="management_fee" name="management_fee" placeholder="e.g. 8%" />
          </div>
          <div>
            <Label htmlFor="lease_fee">Lease fee (%)</Label>
            <Input id="lease_fee" name="lease_fee" placeholder="e.g. 50%" />
          </div>
          <div>
            <Label htmlFor="renewal_fee">Renewal fee (%)</Label>
            <Input id="renewal_fee" name="renewal_fee" placeholder="e.g. 25%" />
          </div>
          <div>
            <Label htmlFor="unit_id">Unit (optional)</Label>
            <Input id="unit_id" name="unit_id" placeholder="Unit ID" />
          </div>
        </div>
        <div>
          <Label htmlFor="services">Services included</Label>
          <textarea id="services" name="services" rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Rent collection, maintenance coordination, financial reporting, lease enforcement..." />
        </div>
        <div>
          <Label htmlFor="special_terms">Special terms</Label>
          <textarea id="special_terms" name="special_terms" rows={2} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Any non-standard provisions..." />
        </div>
        <div className="flex justify-end border-t border-gray-100 pt-5">
          <Button type="submit">Save agreement</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    signed_by_owner: 'bg-amber-100 text-amber-700',
    signed_by_manager: 'bg-amber-100 text-amber-700',
    active: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-600',
    cancelled: 'bg-red-100 text-red-600',
  };
  return <span className={`rounded px-2 py-0.5 text-xs capitalize ${colors[status] || 'bg-gray-100'}`}>{status.replace(/_/g, ' ')}</span>;
}
