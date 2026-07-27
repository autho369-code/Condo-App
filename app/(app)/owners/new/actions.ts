'use server';

// Create an owner with full unit context in one submit: owner profile + portal,
// owner occupancy, a recurring-fee schedule (parking, storage/locker, internet,
// custom...), and optional tenant/lease if the unit is rented.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { resolveAuthorizedOwnerUnit } from '@/lib/security/tenant-boundaries';
import { queueOwnerPortalInvitation } from '@/lib/auth/owner-invitation';

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

export async function createOwnerWithDetails(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const firstName = s(formData, 'first_name');
  const lastName = s(formData, 'last_name');
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const email = s(formData, 'email');
  if (!firstName || !lastName) redirect('/owners/new?error=' + encodeURIComponent('First and last name are required.'));
  if (!email) redirect('/owners/new?error=' + encodeURIComponent('Email is required.'));

  const unitId = s(formData, 'unit_id');
  const associationId = s(formData, 'association_id');
  if (!unitId || !associationId) {
    redirect('/owners/new?error=' + encodeURIComponent('Association and unit are required.'));
  }

  // Never trust the paired hidden/select values. Resolve the unit, association,
  // and portfolio through the caller's RLS-scoped session before creating an
  // auth user or making any service-role write.
  const { data: unitScope, error: unitScopeErr } = await db
    .from('units')
    .select('id, buildings!inner(association_id, associations!inner(id, portfolio_id))')
    .eq('id', unitId)
    .eq('buildings.association_id', associationId)
    .is('archived_at', null)
    .maybeSingle();
  const assignment = resolveAuthorizedOwnerUnit({
    submittedUnitId: unitId,
    submittedAssociationId: associationId,
    callerPortfolioId: me.portfolio?.id,
    isPlatformOperator: me.is_platform_operator,
    unit: unitScope,
  });
  if (unitScopeErr || !assignment) {
    redirect('/owners/new?error=' + encodeURIComponent('That unit is not in the selected association or is outside your authorized portfolio.'));
  }
  if (!me.is_platform_operator) {
    const { data: canAccessAssociation, error: associationAccessErr } = await db
      .rpc('can_access_association', { a_id: assignment.associationId });
    if (associationAccessErr || canAccessAssociation !== true) {
      redirect('/owners/new?error=' + encodeURIComponent('You are not authorized to manage the selected association.'));
    }
  }

  const warnings: string[] = [];
  const activatePortal = formData.get('activate_portal') === 'on';
  const addBoardSeat = formData.get('board_member') === 'on';
  // Service access is created only after the session-scoped tenant proof above.
  const svc = activatePortal || addBoardSeat ? createServiceClient() as any : null;

  // 1) Owner record. Portal access stays inactive until the owner follows the
  // verified-email invitation and chooses their own password.
  const { data: owner, error: ownerErr } = await db.from('owners').insert({
    portfolio_id: assignment.portfolioId,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email,
    phone: s(formData, 'phone'),
    address_street: s(formData, 'address_street'),
    address_city: s(formData, 'address_city'),
    address_state: s(formData, 'address_state'),
    address_zip: s(formData, 'address_zip'),
    preferred_comm: s(formData, 'preferred_comm') ?? 'email',
    portal_activated: false,
    auth_user_id: null,
    emergency_contact_name: s(formData, 'emergency_contact_name'),
    emergency_contact_phone: s(formData, 'emergency_contact_phone'),
    notes: s(formData, 'notes'),
    created_by: me.auth_user_id,
  }).select('id').single();
  if (ownerErr || !owner) {
    redirect('/owners/new?error=' + encodeURIComponent(ownerErr?.message ?? 'Failed to create owner.'));
  }

  const ownerId = owner.id;
  const moveIn = s(formData, 'move_in_date') ?? new Date().toISOString().slice(0, 10);

  // 3) Owner occupancy + regular monthly assessment
  {
    const { error: occupancyErr } = await db.from('occupancies').insert({
      owner_id: ownerId,
      unit_id: assignment.unitId,
      association_id: assignment.associationId,
      occupancy_type: 'owner',
      status: 'current',
      move_in_date: moveIn,
      dues_amount: s(formData, 'dues_amount') ? Number(s(formData, 'dues_amount')) : null,
      dues_frequency: 'monthly',
      share_pct: s(formData, 'ownership_pct') ? Number(s(formData, 'ownership_pct')) : 100,
      is_primary: true,
    });
    if (occupancyErr) warnings.push(`occupancy: ${occupancyErr.message}`);
  }

  // 4) Recurring fee schedule (parallel arrays from the fee builder)
  {
    const cats = formData.getAll('fee_category_id') as string[];
    const amounts = formData.getAll('fee_amount') as string[];
    const freqs = formData.getAll('fee_frequency') as string[];
    const idents = formData.getAll('fee_identifier') as string[];
    const memos = formData.getAll('fee_memo') as string[];

    for (let i = 0; i < cats.length; i++) {
      const categoryId = (cats[i] ?? '').trim();
      const amount = parseFloat(amounts[i] ?? '');
      if (!categoryId || !Number.isFinite(amount)) continue;
      const { error: feeErr } = await db.rpc('subscribe_unit_to_charge', {
        p_unit_id: assignment.unitId,
        p_charge_category_id: categoryId,
        p_amount: amount,
        p_frequency: (freqs[i] ?? 'monthly') || 'monthly',
        p_start_date: moveIn,
        p_memo: (memos[i] ?? '').trim() || null,
        p_identifier: (idents[i] ?? '').trim() || null,
      });
      if (feeErr) warnings.push(`fee ${i + 1}: ${feeErr.message}`);
    }
  }

  // 5) Optional tenant / lease when the unit is rented
  if (formData.get('is_rented') === 'on') {
    const tFirst = s(formData, 'tenant_first_name');
    const tLast = s(formData, 'tenant_last_name');
    if (tFirst && tLast) {
      const { error: tErr } = await db.from('tenants').insert({
        portfolio_id: assignment.portfolioId,
        association_id: assignment.associationId,
        unit_id: assignment.unitId,
        owner_id: ownerId,
        first_name: tFirst,
        last_name: tLast,
        email: s(formData, 'tenant_email'),
        phone: s(formData, 'tenant_phone'),
        lease_start: s(formData, 'tenant_lease_start'),
        lease_end: s(formData, 'tenant_lease_end'),
        insurance_expiration: s(formData, 'tenant_insurance_expiration'),
        insurance_policy_number: s(formData, 'tenant_insurance_policy_number'),
        emergency_contact_name: s(formData, 'tenant_emergency_contact_name'),
        emergency_contact_phone: s(formData, 'tenant_emergency_contact_phone'),
      });
      if (tErr) warnings.push(`tenant: ${tErr.message}`);
    } else {
      warnings.push('tenant: first and last name were required and were skipped');
    }
  }

  // 6) Optional: mark this owner as a board member (board of directors seat +
  //    board portal access). A board seat requires an association.
  if (addBoardSeat) {
    const allowedRoles = ['president', 'vice_president', 'secretary', 'treasurer', 'director'];
    const roleRaw = s(formData, 'board_role') ?? 'director';
    const role = allowedRoles.includes(roleRaw) ? roleRaw : 'director';
    const { error: bmErr } = await svc.from('board_members').insert({
      // This value is derived from the RLS-visible unit, never from the form.
      association_id: assignment.associationId,
      owner_id: ownerId,
      full_name: fullName,
      email,
      phone: s(formData, 'phone'),
      role,
      active: true,
      term_start: new Date().toISOString().slice(0, 10),
      auth_user_id: null,
    });
    if (bmErr) {
      warnings.push(`board member: ${bmErr.message}`);
    }
  }

  let portalInvitationQueued = false;
  if (activatePortal && svc) {
    const invitation = await queueOwnerPortalInvitation(svc, {
      email,
      fullName,
      portfolioId: assignment.portfolioId,
      invitedBy: me.auth_user_id,
    });
    if (invitation.error) warnings.push(`portal invitation: ${invitation.error}`);
    else portalInvitationQueued = true;
  }

  revalidatePath('/owners');
  revalidatePath(`/owners/${ownerId}`);

  const params = new URLSearchParams();
  if (portalInvitationQueued) { params.set('portal_created', '1'); params.set('email', email); }
  if (warnings.length) params.set('warning', warnings.join('; '));
  const qs = params.toString();
  redirect(`/owners/${ownerId}${qs ? `?${qs}` : ''}`);
}
