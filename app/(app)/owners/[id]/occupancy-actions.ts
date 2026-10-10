'use server';

// Tenancy, pets, and emergency-contact actions for the owner detail page.
// Condo units are owner-managed; tenants are tracked (not managed) so the
// association knows who occupies each unit and holds lease/insurance records.
import { verifiedAuthLink } from '@/lib/auth/email-links';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { queueEmails } from '@/lib/email/queue';
import { tenantWorkspaceUrl } from '@/lib/tenant/host';
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/resolve';
import { hasVisibleText } from '@/lib/company-admin/settings';
import { escapeLike } from '@/lib/db/escape-like';

const BUCKET = 'association-documents';

function fail(ownerId: string, message: string): never {
  redirect(`/owners/${ownerId}?error=${encodeURIComponent(message)}`);
}

/**
 * The recipient's company (the owner's or resident's portfolio), not the
 * caller's: a platform operator acting on another company's owner must send
 * that company's name, reply-to and sign-in address.
 */
async function recipientCompany(svc: any, portfolioId: string | null | undefined, ownerId: string) {
  const { data, error } = portfolioId
    ? await svc.from('portfolios').select('slug, company_name, support_email').eq('id', portfolioId).maybeSingle()
    : { data: null, error: null };
  // Without the company's address the link would point at the platform.
  if (error || !data?.slug) fail(ownerId, 'Could not load the company for this record. Nothing was sent.');
  return {
    slug: (data?.slug as string | null) ?? null,
    name: hasVisibleText(data?.company_name) ? String(data.company_name).trim() : null,
    supportEmail: (data?.support_email as string | null) || null,
  };
}

/**
 * The owner's current home at this unit (read with the caller's session, so
 * RLS applies) and the company it belongs to. New residents and pets take
 * that company, not the caller's: a platform operator works across companies.
 */
async function currentHome(db: any, ownerId: string, unitId: string) {
  const { data: occ, error } = await db
    .from('occupancies')
    .select('association_id, associations(portfolio_id)')
    .eq('owner_id', ownerId)
    .eq('unit_id', unitId)
    .eq('status', 'current')
    .limit(1)
    .maybeSingle();
  const portfolioId = occ?.associations?.portfolio_id as string | undefined;
  if (error || !occ?.association_id || !portfolioId) return null;
  return { associationId: occ.association_id as string, portfolioId };
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
  const { data: saved, error } = await (supabase as any)
    .from('owners')
    .update({
      emergency_contact_name: (formData.get('emergency_contact_name') as string)?.trim() || null,
      emergency_contact_phone: (formData.get('emergency_contact_phone') as string)?.trim() || null,
    })
    .eq('id', ownerId)
    .select('id');
  if (error) fail(ownerId, `Could not save emergency contact: ${error.message}`);
  if (!saved?.length) fail(ownerId, 'Could not save emergency contact: the homeowner was not found or you do not have access to it.');
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

export async function addTenant(ownerId: string, formData: FormData) {
  await requireStaff();
  const unitId = formData.get('unit_id') as string;
  const firstName = (formData.get('first_name') as string)?.trim();
  const lastName = (formData.get('last_name') as string)?.trim();
  if (!unitId || !firstName || !lastName) fail(ownerId, 'Unit, tenant first name, and last name are required.');

  const supabase = await createClient();
  const db = supabase as any;

  // Resolve association and company from the owner's occupancy of this unit
  const home = await currentHome(db, ownerId, unitId);
  if (!home) fail(ownerId, 'The selected unit is not a current home for this owner.');

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
    portfolio_id: home.portfolioId,
    association_id: home.associationId,
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
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: tenant, error } = await (supabase as any)
    .from('tenants')
    .update({ status: 'ended', portal_activated: false, auth_user_id: null, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .select('email, portfolio_id')
    .maybeSingle();
  if (error) fail(ownerId, `Could not end tenancy: ${error.message}`);
  // Zero rows means the tenant is not this owner's (or not visible to this
  // manager) — never report success for a tenancy that was not ended.
  if (!tenant) fail(ownerId, 'That tenant was not found on this owner.');
  if (tenant.email) {
    const svc = createServiceClient() as any;
    const { error: revokeError } = await svc.from('user_invitations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('portfolio_id', tenant.portfolio_id)
      .eq('hoa_role', 'tenant')
      .eq('status', 'pending')
      .ilike('email', escapeLike(tenant.email));
    if (revokeError) fail(ownerId, `Tenancy ended, but the pending portal invitation could not be revoked: ${revokeError.message}`);
    await svc.from('audit_logs').insert({
      entity_type: 'tenant',
      entity_id: tenantId,
      action: 'resident_portal_disabled_tenancy_ended',
      actor_id: me.auth_user_id,
      actor_email: me.email ?? null,
    });
  }
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

export async function addPet(ownerId: string, formData: FormData) {
  await requireStaff();
  const unitId = formData.get('unit_id') as string;
  const petType = (formData.get('pet_type') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  if (!unitId || !petType || !name) fail(ownerId, 'Unit, pet type, and pet name are required.');

  const supabase = await createClient();
  const db = supabase as any;
  // The unit must be this owner's current home (the ids come from the form),
  // and a named resident must live there for this owner.
  const home = await currentHome(db, ownerId, unitId);
  if (!home) fail(ownerId, 'The selected unit is not a current home for this owner.');
  const tenantId = (formData.get('tenant_id') as string) || null;
  if (tenantId) {
    const { data: resident } = await db.from('tenants').select('id')
      .eq('id', tenantId).eq('owner_id', ownerId).eq('unit_id', unitId).eq('status', 'active').is('archived_at', null).maybeSingle();
    if (!resident) fail(ownerId, 'That resident does not currently live in the selected unit.');
  }
  const { error } = await db.from('unit_pets').insert({
    portfolio_id: home.portfolioId,
    unit_id: unitId,
    owner_id: ownerId,
    tenant_id: tenantId,
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
  const { data: removed, error } = await (supabase as any)
    .from('unit_pets')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', petId)
    .is('archived_at', null)
    .select('id');
  if (error) fail(ownerId, `Could not remove pet: ${error.message}`);
  if (!removed?.length) fail(ownerId, 'Could not remove pet: it was not found, was already removed, or you do not have access to it.');
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

// ── Vehicles (person-level, independent of parking-space assignment) ──
export async function addVehicle(ownerId: string, formData: FormData) {
  await requireStaff();
  const make = (formData.get('make') as string)?.trim();
  const plate = (formData.get('license_plate') as string)?.trim();
  if (!make && !plate) fail(ownerId, 'Enter at least a make or a license plate.');

  const supabase = await createClient();
  // The vehicle belongs to the owner's company (read with the caller's
  // session: an owner the caller can't see can't be given a vehicle).
  const { data: owner } = await (supabase as any).from('owners').select('portfolio_id').eq('id', ownerId).maybeSingle();
  if (!owner?.portfolio_id) fail(ownerId, 'Owner not found or unavailable.');
  const yearRaw = (formData.get('year') as string)?.trim();
  const { error } = await (supabase as any).from('owner_vehicles').insert({
    portfolio_id: owner.portfolio_id,
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
  const { data: removed, error } = await (supabase as any)
    .from('owner_vehicles')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', vehicleId)
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .select('id');
  if (error) fail(ownerId, `Could not remove vehicle: ${error.message}`);
  if (!removed?.length) fail(ownerId, 'Could not remove vehicle: it was not found, was already removed, or you do not have access to it.');
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}`);
}

// ── Owner portal access controls (audit: reset password / enable-disable) ──

// The portal sign-in of an owner record: its first-record link
// (owners.auth_user_id) or, for a record added to a login through its own
// invitation, the active owner_portal_logins row (staff RLS read).
async function ownerSignInId(supabase: any, owner: { id: string; auth_user_id: string | null }): Promise<string | null> {
  if (owner.auth_user_id) return owner.auth_user_id;
  const { data, error } = await supabase
    .from('owner_portal_logins')
    .select('auth_user_id')
    .eq('owner_id', owner.id)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) fail(owner.id, `Could not check the owner's portal sign-in: ${error.message}`);
  return data?.auth_user_id ?? null;
}

export async function sendOwnerPasswordReset(ownerId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: owner } = await (supabase as any)
    .from('owners')
    .select('id, auth_user_id, email, full_name, portfolio_id')
    .eq('id', ownerId)
    .maybeSingle();
  if (!owner?.email) fail(ownerId, 'This owner does not have a linked portal account and email.');
  const signInId = await ownerSignInId(supabase, owner);
  if (!signInId) fail(ownerId, 'This owner does not have a linked portal account and email.');

  const svc = createServiceClient() as any;
  const verifiedEmail = String(owner.email).trim().toLowerCase();
  const { data: authData, error: authLookupError } = await svc.auth.admin.getUserById(signInId);
  const authUser = authData?.user;
  if (
    authLookupError
    || !authUser
    || authUser.id !== signInId
    || String(authUser.email ?? '').trim().toLowerCase() !== verifiedEmail
    || !authUser.email_confirmed_at
  ) {
    fail(ownerId, 'The owner record must match a verified portal sign-in email before a reset link can be sent.');
  }

  const company = await recipientCompany(svc, owner.portfolio_id, ownerId);
  const { data: linkData, error } = await svc.auth.admin.generateLink({
    type: 'recovery',
    email: verifiedEmail,
    options: { redirectTo: tenantWorkspaceUrl(company.slug, '/api/auth/callback?next=/reset-password') },
  });
  if (
    error
    || !linkData?.properties?.action_link
    || linkData.user?.id !== signInId
    || String(linkData.user?.email ?? '').trim().toLowerCase() !== verifiedEmail
  ) {
    fail(ownerId, `Could not generate a reset link: ${error?.message ?? 'the linked portal identity did not match'}`);
  }

  // White-label: the owner sees their management company as the sender.
  const companyName = company.name ?? NEUTRAL_COMPANY_NAME;
  const queued = await queueEmails(svc, [{
    to: verifiedEmail,
    toName: owner.full_name,
    subject: 'Reset your owner portal password',
    text: [
      `Hello${owner.full_name ? ` ${owner.full_name}` : ''},`,
      '',
      `${companyName} sent you a link to reset your owner-portal password:`,
      verifiedAuthLink(linkData, tenantWorkspaceUrl(company.slug, '/api/auth/callback?next=/reset-password'), 'recovery'),
      '',
      'This link expires after a short time. If you did not expect this email, contact your management office.',
    ].join('\n'),
    fromName: company.name,
    replyTo: company.supportEmail,
    portfolioId: owner.portfolio_id,
    sentBy: me.auth_user_id,
  }]);
  if (queued.error || queued.count !== 1) fail(ownerId, `Reset link created but the email could not be queued: ${queued.error ?? 'unknown queue error'}`);

  const { error: auditError } = await svc.from('audit_logs').insert({
    entity_type: 'owner',
    entity_id: owner.id,
    action: 'password_reset_sent',
    actor_id: me.auth_user_id,
    actor_email: me.email ?? null,
    changes: { target_email: verifiedEmail, method: 'verified_email_recovery_link', delivery: 'email_queue' },
  });
  if (auditError) fail(ownerId, 'The recovery email was queued, but the required audit event could not be recorded.');
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=reset_sent`);
}

export async function setOwnerPortalAccess(ownerId: string, enable: boolean) {
  await requireStaff();
  const supabase = await createClient();
  const { data: owner, error: ownerError } = await (supabase as any)
    .from('owners')
    .select('id, auth_user_id')
    .eq('id', ownerId)
    .maybeSingle();
  if (ownerError || !owner) fail(ownerId, ownerError?.message ?? 'Owner not found.');
  if (enable && !(await ownerSignInId(supabase, owner))) {
    fail(ownerId, 'Create or invite the owner portal account before enabling portal access.');
  }

  // This switch is deliberately tenant-local. Never ban/unban the shared auth
  // identity: the same person may retain a board, vendor, or other portfolio
  // role. requireOwner() enforces this flag on every owner-portal request.
  const { data: updated, error } = await (supabase as any)
    .from('owners')
    .update({ portal_activated: enable })
    .eq('id', ownerId)
    .select('id')
    .maybeSingle();
  if (error || !updated) fail(ownerId, error?.message ?? 'Owner portal access was not updated in this portfolio.');
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=${enable ? 'portal_enabled' : 'portal_disabled'}`);
}

/**
 * Cuts off every login of this owner record: its own sign-in and any sign-in
 * it was added to. The database re-checks that the caller manages the owner's
 * association, revokes the links and logs it (unlink_owner_logins). The
 * person's other records and roles are untouched; the owner can be invited
 * again.
 */
export async function unlinkOwnerLogins(ownerId: string) {
  await requireStaff();
  const supabase = await createClient();
  const { data: unlinked, error } = await (supabase as any).rpc('unlink_owner_logins', { p_owner_id: ownerId });
  if (error) fail(ownerId, `Login not unlinked: ${error.message}`);
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=${Number(unlinked) > 0 ? 'logins_unlinked' : 'no_logins'}`);
}

export async function sendTenantPortalInvitation(tenantId: string, ownerId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: tenant, error } = await (supabase as any)
    .from('tenants')
    .select('id, portfolio_id, association_id, unit_id, auth_user_id, first_name, last_name, email, status, archived_at')
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !tenant) fail(ownerId, error?.message ?? 'Resident not found.');
  if (tenant.status !== 'active' || tenant.archived_at) fail(ownerId, 'Only an active resident can be invited.');
  if (!tenant.email) fail(ownerId, 'Add an email address before inviting this resident.');
  if (tenant.auth_user_id) fail(ownerId, 'This resident already has a linked account. Use password reset or enable access.');

  const email = String(tenant.email).trim().toLowerCase();
  const fullName = `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() || 'Resident';
  const svc = createServiceClient() as any;
  // Load the company first: if it fails, the resident's current invitation stays untouched.
  const company = await recipientCompany(svc, tenant.portfolio_id, ownerId);
  const { error: revokeError } = await svc.from('user_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('portfolio_id', tenant.portfolio_id)
    .eq('hoa_role', 'tenant')
    .eq('status', 'pending')
    .ilike('email', escapeLike(email));
  if (revokeError) fail(ownerId, `Could not replace the earlier invitation: ${revokeError.message}`);

  const { data: invitation, error: inviteError } = await svc.from('user_invitations').insert({
    email,
    full_name: fullName,
    portfolio_id: tenant.portfolio_id,
    association_id: tenant.association_id,
    unit_id: tenant.unit_id,
    hoa_role: 'tenant',
    invited_by: me.auth_user_id,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    message: 'Activate your resident portal account.',
    // The app queues its own invite email below; tell queue_invitation_email
    // not to send a second one.
    metadata: { tenant_id: tenant.id, owner_id: ownerId, access: 'resident_nonfinancial', email_delivery: 'application' },
  }).select('id, token').single();
  if (inviteError || !invitation?.token) fail(ownerId, inviteError?.message ?? 'Could not create the resident invitation.');

  const inviteUrl = tenantWorkspaceUrl(company.slug, `/invite?token=${encodeURIComponent(invitation.token)}`);
  const queued = await queueEmails(svc, [{
    to: email,
    toName: fullName,
    subject: 'Activate your resident portal',
    text: [
      `Hello ${fullName},`,
      '',
      `${company.name ?? NEUTRAL_COMPANY_NAME} invited you to its resident portal.`,
      'Use this private link to verify your email and choose your own password:',
      inviteUrl,
      '',
      'Resident access includes community documents, announcements, calendar events, and maintenance requests. It does not include owner financial records.',
      '',
      'This link expires in 30 days. If you did not expect it, contact your management office.',
    ].join('\n'),
    fromName: company.name,
    replyTo: company.supportEmail,
    portfolioId: tenant.portfolio_id,
    sentBy: me.auth_user_id,
  }]);
  if (queued.error || queued.count !== 1) {
    await svc.from('user_invitations').update({ status: 'revoked' }).eq('id', invitation.id);
    fail(ownerId, queued.error ?? 'The invitation could not be queued.');
  }

  await svc.from('audit_logs').insert({
    entity_type: 'tenant',
    entity_id: tenant.id,
    action: 'resident_portal_invited',
    actor_id: me.auth_user_id,
    actor_email: me.email ?? null,
    changes: { target_email: email, invitation_id: invitation.id, access: 'resident_nonfinancial' },
  });
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=resident_invited`);
}

export async function sendTenantPasswordReset(tenantId: string, ownerId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: tenant, error } = await (supabase as any)
    .from('tenants')
    .select('id, portfolio_id, auth_user_id, first_name, last_name, email, status, portal_activated, archived_at')
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !tenant) fail(ownerId, error?.message ?? 'Resident not found.');
  if (!tenant.email || !tenant.auth_user_id || tenant.status !== 'active' || tenant.archived_at) {
    fail(ownerId, 'This resident does not have an active linked portal account and email.');
  }

  const email = String(tenant.email).trim().toLowerCase();
  const fullName = `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() || 'Resident';
  const svc = createServiceClient() as any;
  const { data: authData, error: authError } = await svc.auth.admin.getUserById(tenant.auth_user_id);
  if (
    authError
    || !authData?.user
    || authData.user.id !== tenant.auth_user_id
    || String(authData.user.email ?? '').trim().toLowerCase() !== email
    || !authData.user.email_confirmed_at
  ) {
    fail(ownerId, 'The resident record must match a verified sign-in email before a reset link can be sent.');
  }

  const company = await recipientCompany(svc, tenant.portfolio_id, ownerId);
  const { data: linkData, error: linkError } = await svc.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: tenantWorkspaceUrl(company.slug, '/api/auth/callback?next=/reset-password') },
  });
  if (linkError || !linkData?.properties?.action_link || linkData.user?.id !== tenant.auth_user_id) {
    fail(ownerId, linkError?.message ?? 'Could not generate a verified resident reset link.');
  }

  const queued = await queueEmails(svc, [{
    to: email,
    toName: fullName,
    subject: 'Reset your resident portal password',
    text: [
      `Hello ${fullName},`,
      '',
      `${company.name ?? NEUTRAL_COMPANY_NAME} sent you a secure password reset link:`,
      verifiedAuthLink(linkData, tenantWorkspaceUrl(company.slug, '/api/auth/callback?next=/reset-password'), 'recovery'),
      '',
      'This link expires after a short time. If you did not expect this email, contact your management office.',
    ].join('\n'),
    fromName: company.name,
    replyTo: company.supportEmail,
    portfolioId: tenant.portfolio_id,
    sentBy: me.auth_user_id,
  }]);
  if (queued.error || queued.count !== 1) fail(ownerId, queued.error ?? 'The reset email could not be queued.');

  await svc.from('audit_logs').insert({
    entity_type: 'tenant',
    entity_id: tenant.id,
    action: 'password_reset_sent',
    actor_id: me.auth_user_id,
    actor_email: me.email ?? null,
    changes: { target_email: email, method: 'verified_email_recovery_link', delivery: 'email_queue' },
  });
  revalidatePath(`/owners/${ownerId}`);
  redirect(`/owners/${ownerId}?saved=resident_reset_sent`);
}

export async function setTenantPortalAccess(tenantId: string, ownerId: string, enable: boolean) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: tenant, error: tenantError } = await (supabase as any)
    .from('tenants')
    .select('id, portfolio_id, auth_user_id, status, archived_at')
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (tenantError || !tenant) fail(ownerId, tenantError?.message ?? 'Resident not found.');
  if (enable && (!tenant.auth_user_id || tenant.status !== 'active' || tenant.archived_at)) {
    fail(ownerId, 'Invite and verify an active resident account before enabling portal access.');
  }

  const { data: updated, error } = await (supabase as any).from('tenants')
    .update({ portal_activated: enable, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
    .eq('owner_id', ownerId)
    .select('id')
    .maybeSingle();
  if (error || !updated) fail(ownerId, error?.message ?? 'Resident portal access was not updated.');

  const { error: auditError } = await (createServiceClient() as any).from('audit_logs').insert({
    portfolio_id: tenant.portfolio_id,
    entity_type: 'tenant',
    entity_id: tenantId,
    action: enable ? 'resident_portal_enabled' : 'resident_portal_disabled',
    actor_id: me.auth_user_id,
    actor_email: me.email ?? null,
    changes: { portal_activated: enable },
  });
  revalidatePath(`/owners/${ownerId}`);
  if (auditError) fail(ownerId, `Resident portal access was ${enable ? 'enabled' : 'disabled'}, but the audit log entry failed: ${auditError.message}`);
  redirect(`/owners/${ownerId}?saved=${enable ? 'resident_portal_enabled' : 'resident_portal_disabled'}`);
}
