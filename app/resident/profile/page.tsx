import { requireTenant } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Alert, PageHeader, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { date } from '@/lib/utils';
import { isScopedStoragePath } from '@/lib/security/storage-paths';
import { updateResidentProfile } from '@/app/resident/actions';
import { ResidentInsuranceUploadForm } from '@/components/resident/insurance-upload-form';

export const dynamic = 'force-dynamic';

const BUCKET = 'association-documents';

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function ResidentProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; saved_document?: string; error?: string }>;
}) {
  const banner = await searchParams;
  const me = await requireTenant();
  const supabase = await createClient();
  const { data: tenant } = await (supabase as any).from('tenants')
    .select('id, first_name, last_name, email, phone, lease_start, lease_end, lease_document_url, insurance_document_url, insurance_policy_number, insurance_expiration, emergency_contact_name, emergency_contact_phone, units(unit_number, buildings(name, associations(name)))')
    .eq('id', me.tenant_id)
    .maybeSingle();

  const unit = relation<any>(tenant?.units);
  const building = relation<any>(unit?.buildings);
  const association = relation<any>(building?.associations);
  const links = new Map<string, string>();
  const privatePaths = [tenant?.lease_document_url, tenant?.insurance_document_url]
    .filter((path: unknown): path is string => isScopedStoragePath(path, 'tenants', me.tenant_id));
  if (privatePaths.length > 0) {
    const { data: signed } = await (createServiceClient() as any).storage.from(BUCKET).createSignedUrls(privatePaths, 3600);
    for (const item of signed ?? []) if (item?.path && item?.signedUrl) links.set(item.path, item.signedUrl);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" description="Keep management informed with current contact, emergency, and insurance information." />
      {banner.saved ? <Alert tone="success">Your profile was updated.</Alert> : null}
      {banner.saved_document ? <Alert tone="success">Your insurance document was uploaded securely.</Alert> : null}
      {banner.error ? <Alert>{banner.error}</Alert> : null}

      <Surface>
        <h2 className="text-[15px] font-semibold text-gray-950">Resident and unit</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Resident</dt><dd className="mt-1 text-gray-900">{tenant ? `${tenant.first_name} ${tenant.last_name}` : me.profile?.full_name}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</dt><dd className="mt-1 text-gray-900">{tenant?.email ?? me.email}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Community</dt><dd className="mt-1 text-gray-900">{association?.name ?? '—'}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Home</dt><dd className="mt-1 text-gray-900">{building?.name ? `${building.name} · ` : ''}Unit {unit?.unit_number ?? '—'}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Lease term</dt><dd className="mt-1 text-gray-900">{tenant?.lease_start ? date(tenant.lease_start) : 'Not provided'} – {tenant?.lease_end ? date(tenant.lease_end) : 'Open-ended'}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Lease document</dt><dd className="mt-1">{tenant?.lease_document_url && links.get(tenant.lease_document_url) ? <a href={links.get(tenant.lease_document_url)} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-800 hover:underline">View lease →</a> : <span className="text-gray-500">Not on file</span>}</dd></div>
        </dl>
        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-500">Name, email, unit, and lease assignments are managed by your property management team. Contact management to correct them.</p>
      </Surface>

      <Surface>
        <h2 className="text-[15px] font-semibold text-gray-950">Contact and emergency information</h2>
        <form action={updateResidentProfile as any} className="mt-4 space-y-4">
          <input type="hidden" name="tenant_id" value={tenant?.id ?? ''} />
          <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" type="tel" maxLength={50} defaultValue={tenant?.phone ?? ''} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="emergency_contact_name">Emergency contact</Label><Input id="emergency_contact_name" name="emergency_contact_name" maxLength={200} defaultValue={tenant?.emergency_contact_name ?? ''} /></div>
            <div><Label htmlFor="emergency_contact_phone">Emergency phone</Label><Input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" maxLength={50} defaultValue={tenant?.emergency_contact_phone ?? ''} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="insurance_policy_number">Insurance policy number</Label><Input id="insurance_policy_number" name="insurance_policy_number" maxLength={200} defaultValue={tenant?.insurance_policy_number ?? ''} /></div>
            <div><Label htmlFor="insurance_expiration">Insurance expiration</Label><Input id="insurance_expiration" name="insurance_expiration" type="date" defaultValue={tenant?.insurance_expiration ?? ''} /></div>
          </div>
          <Button type="submit" size="lg">Save profile</Button>
        </form>
      </Surface>

      <Surface>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-gray-950">Renter insurance document</h2><p className="mt-1 text-xs leading-5 text-gray-500">Upload proof of current coverage directly to your private association record.</p></div>{tenant?.insurance_document_url && links.get(tenant.insurance_document_url) ? <a href={links.get(tenant.insurance_document_url)} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-gray-700 hover:underline">View current document →</a> : null}</div>
        {tenant?.id ? <ResidentInsuranceUploadForm tenantId={tenant.id} policyNumber={tenant.insurance_policy_number} expirationDate={tenant.insurance_expiration} /> : null}
      </Surface>
    </div>
  );
}
