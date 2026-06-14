'use server';

// Create an owner with full unit context in one submit: owner profile + portal,
// owner occupancy, a recurring-fee schedule (parking, storage/locker, internet,
// custom...), and optional tenant/lease if the unit is rented.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 14; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
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

  // 1) Optional portal auth user
  let authUserId: string | null = null;
  const activatePortal = formData.get('activate_portal') === 'on';
  if (activatePortal) {
    const password = s(formData, 'portal_password') ?? genPassword();
    const { data: authUser, error: authErr } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, role: 'owner' },
    });
    if (!authErr) authUserId = authUser?.user?.id ?? null;
  }

  // 2) Owner record
  const { data: owner, error: ownerErr } = await db.from('owners').insert({
    portfolio_id: me.portfolio?.id,
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
    portal_activated: activatePortal,
    auth_user_id: authUserId,
    emergency_contact_name: s(formData, 'emergency_contact_name'),
    emergency_contact_phone: s(formData, 'emergency_contact_phone'),
    notes: s(formData, 'notes'),
    created_by: me.auth_user_id,
  }).select('id').single();
  if (ownerErr || !owner) redirect('/owners/new?error=' + encodeURIComponent(ownerErr?.message ?? 'Failed to create owner.'));

  const ownerId = owner.id;
  const moveIn = s(formData, 'move_in_date') ?? new Date().toISOString().slice(0, 10);

  // 3) Owner occupancy + regular monthly assessment
  if (unitId && associationId) {
    await db.from('occupancies').insert({
      owner_id: ownerId,
      unit_id: unitId,
      association_id: associationId,
      occupancy_type: 'owner',
      status: 'current',
      move_in_date: moveIn,
      dues_amount: s(formData, 'dues_amount') ? Number(s(formData, 'dues_amount')) : null,
      dues_frequency: 'monthly',
      share_pct: s(formData, 'ownership_pct') ? Number(s(formData, 'ownership_pct')) : 100,
      is_primary: true,
    });
  }

  const warnings: string[] = [];

  // 4) Recurring fee schedule (parallel arrays from the fee builder)
  if (unitId && associationId) {
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
        p_unit_id: unitId,
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
  if (unitId && formData.get('is_rented') === 'on') {
    const tFirst = s(formData, 'tenant_first_name');
    const tLast = s(formData, 'tenant_last_name');
    if (tFirst && tLast) {
      const { error: tErr } = await db.from('tenants').insert({
        portfolio_id: me.portfolio?.id,
        association_id: associationId,
        unit_id: unitId,
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

  revalidatePath('/owners');
  revalidatePath(`/owners/${ownerId}`);

  const params = new URLSearchParams();
  if (activatePortal && authUserId) { params.set('portal_created', '1'); params.set('email', email); }
  if (warnings.length) params.set('warning', warnings.join('; '));
  const qs = params.toString();
  redirect(`/owners/${ownerId}${qs ? `?${qs}` : ''}`);
}
