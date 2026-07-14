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
    insurance_expiration: (formData.get('insurance_expiration') as string) || null,
    insurance_policy_number: (formData.get('insurance_policy_number') as string)?.trim() || null,
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

// ── Vehicles (person-level, independent of parking-space assignment) ──
export async function addVehicle(ownerId: string, formData: FormData) {
  const me = await requireStaff();
  const make = (formData.get('make') as string)?.trim();
  const plate = (formData.get('license_plate') as string)?.trim();
  if (!make && !plate) fail(ownerId, 'Enter at least a make or a license plate.');

  const supabase = await createClient();
  const yearRaw = (formData.get('year') as string)?.trim();
  const { error } = await (supabase as any).from('owner_vehicles').insert({
    portfolio_id: me.portfolio?.id,
    owner_id: ownerId,
    make: make || null,
    model: (formData.get('model') as string)?.trim() || null,
    color: (formData.get('color') as string)?.trim() || null,
    year: yearRaw ? parseInt(yearRaw, 10) || null : null,
    license_plate: plate || null,
    plate_state: (formData.get('plate_state') as string)?.trim() || null,
  });
  if (error) fail(ownerId, `Could not add vehicle: ${error.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

export async function removeVehicle(vehicleId: string, ownerId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('owner_vehicles')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', vehicleId);
  if (error) fail(ownerId, `Could not remove vehicle: ${error.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

// ── Owner portal access controls (audit: reset password / enable-disable) ──
const SITE_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portier369.com';

export async function sendOwnerPasswordReset(ownerId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: owner } = await (supabase as any).from('owners').select('email, full_name, portfolio_id').eq('id', ownerId).maybeSingle();
  if (!owner?.email) fail(ownerId, 'This owner has no email on file.');

  const svc = createServiceClient() as any;
  const { data: linkData, error } = await svc.auth.admin.generateLink({
    type: 'recovery',
    email: owner.email,
    options: { redirectTo: `${SITE_URL}/api/auth/callback?next=/reset-password` },
  });
  if (error || !linkData?.properties?.action_link) fail(ownerId, `Could not generate a reset link: ${error?.message ?? 'no portal account exists for this email yet'}`);

  // White-label: the owner sees their management company as the sender.
  const companyName = me.portfolio?.company_name ?? 'Your management company';
  const { error: qErr } = await svc.from('email_queue').insert({
    to_email: owner.email,
    to_name: owner.full_name,
    subject: 'Reset your owner portal password',
    body: `<p>Hello${owner.full_name ? ` ${owner.full_name}` : ''},</p><p>${companyName} sent you a link to reset your owner-portal password:</p><p><a href="${linkData.properties.action_link}">Reset your password</a></p><p>This link expires after a short time. If you did not expect this email, contact your management office.</p>`,
    status: 'pending',
    from_address: 'hello@portier369.com',
    from_name: me.portfolio?.company_name ?? 'Portier369',
    reply_to: me.portfolio?.support_email ?? null,
    portfolio_id: owner.portfolio_id,
  });
  if (qErr) fail(ownerId, `Reset link created but the email could not be queued: ${qErr.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=reset_sent`);
}

export async function setOwnerPortalAccess(ownerId: string, enable: boolean) {
  await requireStaff();
  const supabase = await createClient();
  const { data: owner } = await (supabase as any).from('owners').select('auth_user_id').eq('id', ownerId).maybeSingle();
  if (!owner) fail(ownerId, 'Owner not found.');

  if (owner.auth_user_id) {
    const svc = createServiceClient() as any;
    // ban_duration 'none' lifts the ban; ~100 years effectively disables.
    const { error: banErr } = await svc.auth.admin.updateUserById(owner.auth_user_id, {
      ban_duration: enable ? 'none' : '876000h',
    });
    if (banErr) fail(ownerId, `Could not ${enable ? 'enable' : 'disable'} sign-in: ${banErr.message}`);
  }
  const { error } = await (supabase as any).from('owners').update({ portal_activated: enable }).eq('id', ownerId);
  if (error) fail(ownerId, error.message);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=${enable ? 'portal_enabled' : 'portal_disabled'}`);
}
