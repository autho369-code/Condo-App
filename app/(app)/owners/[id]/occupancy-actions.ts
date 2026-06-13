'use server';

// Tenancy, pets, and emergency-contact actions for the owner detail page.
// Condo units are owner-managed; tenants are tracked (not managed) so the
// association knows who occupies each unit and holds lease/insurance records.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

const BUCKET = 'association-documents';

function fail(ownerId: string, message: string): never {
  redirect(`/owners/${ownerId}?error=${encodeURIComponent(message)}`);
}

async function uploadDoc(svc: any, tenantKey: string, kind: string, file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `tenants/${tenantKey}/${kind}-${Date.now()}-${safeName}`;
  const { error } = await svc.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`${kind} upload failed: ${error.message}`);
  return path;
}

export async function saveOwnerEmergencyContact(ownerId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('owners')
    .update({
      emergency_contact_name: (formData.get('emergency_contact_name') as string)?.trim() || null,
      emergency_contact_phone: (formData.get('emergency_contact_phone') as string)?.trim() || null,
    })
    .eq('id', ownerId);
  if (error) fail(ownerId, `Could not save emergency contact: ${error.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

export async function addTenant(ownerId: string, formData: FormData) {
  const me = await requireStaff();
  const unitId = formData.get('unit_id') as string;
  const firstName = (formData.get('first_name') as string)?.trim();
  const lastName = (formData.get('last_name') as string)?.trim();
  if (!unitId || !firstName || !lastName) fail(ownerId, 'Unit, tenant first name, and last name are required.');

  const supabase = await createClient();
  const db = supabase as any;

  // Resolve association from the owner's occupancy of this unit
  const { data: occ } = await db
    .from('occupancies')
    .select('association_id')
    .eq('owner_id', ownerId)
    .eq('unit_id', unitId)
    .eq('status', 'current')
    .limit(1)
    .maybeSingle();

  const svc = createServiceClient() as any;
  const tenantKey = crypto.randomUUID();

  let leasePath: string | null = null;
  let insurancePath: string | null = null;
  try {
    leasePath = await uploadDoc(svc, tenantKey, 'lease', formData.get('lease_file') as File | null);
    insurancePath = await uploadDoc(svc, tenantKey, 'insurance', formData.get('insurance_file') as File | null);
  } catch (err) {
    fail(ownerId, (err as Error).message);
  }

  const { error } = await db.from('tenants').insert({
    id: tenantKey,
    portfolio_id: me.portfolio?.id,
    association_id: occ?.association_id ?? null,
    unit_id: unitId,
    owner_id: ownerId,
    first_name: firstName,
    last_name: lastName,
    email: (formData.get('email') as string)?.trim() || null,
    phone: (formData.get('phone') as string)?.trim() || null,
    lease_start: (formData.get('lease_start') as string) || null,
    lease_end: (formData.get('lease_end') as string) || null,
    lease_document_url: leasePath,
    insurance_document_url: insurancePath,
    emergency_contact_name: (formData.get('emergency_contact_name') as string)?.trim() || null,
    emergency_contact_phone: (formData.get('emergency_contact_phone') as string)?.trim() || null,
    notes: (formData.get('notes') as string)?.trim() || null,
  });
  if (error) fail(ownerId, `Could not add tenant: ${error.message}`);

  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?tenant_added=1`);
}

export async function endTenancy(tenantId: string, ownerId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('tenants')
    .update({ status: 'ended', updated_at: new Date().toISOString() })
    .eq('id', tenantId);
  if (error) fail(ownerId, `Could not end tenancy: ${error.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

export async function addPet(ownerId: string, formData: FormData) {
  const me = await requireStaff();
  const unitId = formData.get('unit_id') as string;
  const petType = (formData.get('pet_type') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  if (!unitId || !petType || !name) fail(ownerId, 'Unit, pet type, and pet name are required.');

  const supabase = await createClient();
  const { error } = await (supabase as any).from('unit_pets').insert({
    portfolio_id: me.portfolio?.id,
    unit_id: unitId,
    owner_id: ownerId,
    tenant_id: (formData.get('tenant_id') as string) || null,
    pet_type: petType,
    name,
    breed: (formData.get('breed') as string)?.trim() || null,
    notes: (formData.get('notes') as string)?.trim() || null,
  });
  if (error) fail(ownerId, `Could not add pet: ${error.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

export async function removePet(petId: string, ownerId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('unit_pets')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', petId);
  if (error) fail(ownerId, `Could not remove pet: ${error.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}
