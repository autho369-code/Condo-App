'use server';
// Entity CRUD for Associations, Buildings, Units, Owners, Vendors.
// Every insert resolves portfolio_id from me() server-side; never trust client.
import { createClient } from '@/lib/supabase/server';
import { requireStaff, requirePortfolioAdmin } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// ---------- Helpers ----------
const str  = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const req  = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) throw new Error(`${k} is required`);
  return v;
};
const num  = (f: FormData, k: string) => {
  const v = str(f, k);
  return v == null ? null : Number(v);
};
const intn = (f: FormData, k: string, fallback: number | null = null) => {
  const v = str(f, k);
  return v == null ? fallback : parseInt(v, 10);
};

// ============================================================================
// ASSOCIATIONS
// ============================================================================

/**
 * Create a new association. Also handles (1) seed first building, (2) link
 * bank accounts with cash-GL mapping, and (3) optional recurring-charge setting.
 */
/**
 * Create a new Association — the legal / financial entity (HOA / Condo corporation).
 *
 * This action only accepts legal and financial fields. Physical-asset data
 * (address, year built, site manager, maintenance info, amenities) lives on
 * the Building, not the Association. See PROJECT_HANDOFF.md §0 for the full
 * Association vs. Building distinction.
 *
 * After creating the Association, the user is taken to /buildings/new so they
 * can add the physical property under this legal entity.
 */
export async function createAssociation(formData: FormData) {
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();

  // Resolve the target portfolio. Order of precedence:
  //   1. explicit portfolio_id from the form (platform operators pick this)
  //   2. me.portfolio.id (regular portfolio admins)
  //   3. the only portfolio visible via RLS — auto-select if exactly one
  let portfolioId: string | null = str(formData, 'portfolio_id') ?? me.portfolio?.id ?? null;
  if (!portfolioId) {
    const { data: visible } = await (supabase as any).from('portfolios').select('id').limit(2);
    if ((visible ?? []).length === 1) portfolioId = visible![0].id;
  }
  if (!portfolioId) {
    return { error: 'No portfolio is associated with your account. Ask a platform operator to assign one, or pick a target portfolio.' };
  }

  const payload = {
    portfolio_id: portfolioId,
    status: 'active',
    created_by: me.auth_user_id,

    // --- Identity (legal entity) ---
    name:        req(formData, 'name'),
    legal_name:  str(formData, 'legal_name'),
    tax_id:      str(formData, 'tax_id'),

    // --- Financial / reporting ---
    fiscal_year_start:   intn(formData, 'fiscal_year_start', 1),
    reserve_funds:       num(formData, 'reserve_funds'),
    vendor_1099_payer:   str(formData, 'vendor_1099_payer') ?? 'use_management_company',
    owner_payout_basis:  str(formData, 'owner_payout_basis') ?? 'cash',

    // --- Fee policy ---
    nsf_fee_amount_override:      num(formData, 'nsf_fee_amount_override'),
    late_fee_type:                str(formData, 'late_fee_type') ?? 'flat',
    late_fee_amount_override:     num(formData, 'late_fee_amount_override'),
    late_fee_grace_days_override: intn(formData, 'late_fee_grace_days_override'),
    late_fee_eligible_charges:    str(formData, 'late_fee_eligible_charges') ?? 'all_charges',

    // --- Budget variance policy ---
    budget_variance_threshold_amount: num(formData, 'budget_variance_threshold_amount'),
    budget_variance_threshold_op:     str(formData, 'budget_variance_threshold_op') ?? 'or',
    budget_variance_threshold_pct:    num(formData, 'budget_variance_threshold_pct'),
  };

  // Strip nulls so column defaults can take effect
  const clean: Record<string, unknown> = { ...payload };
  for (const k of Object.keys(clean)) {
    if (clean[k] === null) delete clean[k];
  }

  const { data: assoc, error } = await (supabase as any).from('associations').insert(clean).select('id').single();
  if (error || !assoc) return { error: error?.message ?? 'Failed to create association' };

  revalidatePath('/associations');
  // Next step: let the user add the physical property under this legal entity.
  redirect(`/buildings/new?association=${assoc.id}`);
}

/**
 * Update an Association — legal / financial fields only. Physical-asset fields
 * (address, year built, maintenance, amenities) must go through updateBuilding.
 * See PROJECT_HANDOFF.md §0.
 *
 * Note: maintenance_contact_name/email/phone are legitimately per-association
 * (it's the association's maintenance coordinator contact, not a building-level
 * site manager). Those stay here.
 */
export async function updateAssociation(id: string, formData: FormData) {
  await requirePortfolioAdmin();
  const supabase = await createClient();
  const failTo = (msg: string) => redirect(`/associations/${id}?error=${encodeURIComponent(msg)}`);

  const patch: Record<string, unknown> = {
    name:        str(formData, 'name'),
    legal_name:  str(formData, 'legal_name'),
    tax_id:      str(formData, 'tax_id'),

    fiscal_year_start:    intn(formData, 'fiscal_year_start'),
    reserve_funds:        num(formData, 'reserve_funds'),
    vendor_1099_payer:    str(formData, 'vendor_1099_payer'),
    owner_payout_basis:   str(formData, 'owner_payout_basis'),

    nsf_fee_amount_override:      num(formData, 'nsf_fee_amount_override'),
    late_fee_type:                str(formData, 'late_fee_type'),
    late_fee_amount_override:     num(formData, 'late_fee_amount_override'),
    late_fee_grace_days_override: intn(formData, 'late_fee_grace_days_override'),
    late_fee_eligible_charges:    str(formData, 'late_fee_eligible_charges'),

    budget_variance_threshold_amount: num(formData, 'budget_variance_threshold_amount'),
    budget_variance_threshold_op:     str(formData, 'budget_variance_threshold_op'),
    budget_variance_threshold_pct:    num(formData, 'budget_variance_threshold_pct'),

    // Association-level maintenance coordinator contact (not the on-site
    // manager — that belongs on the Building).
    maintenance_contact_name:   str(formData, 'maintenance_contact_name'),
    maintenance_contact_email:  str(formData, 'maintenance_contact_email'),
    maintenance_contact_phone:  str(formData, 'maintenance_contact_phone'),
  };
  Object.keys(patch).forEach((k) => patch[k] === null && delete patch[k]);

  const { error } = await (supabase as any).from('associations').update(patch).eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath(`/associations/${id}`);
  revalidatePath('/associations');
}

export async function archiveAssociation(id: string) {
  await requirePortfolioAdmin();
  const supabase = await createClient();
  const { error } = await (supabase as any).from('associations').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) { redirect(`/associations/${id}?error=${encodeURIComponent(error.message)}`); return; }
  revalidatePath('/associations');
  redirect('/associations');
}

// ============================================================================
// BANK ACCOUNTS
// ============================================================================

export async function createBankAccount(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const failTo = (msg: string) => {
    redirect(`/bank-accounts/new?error=${encodeURIComponent(msg)}`);
  };

  const payload = {
    portfolio_id:    me.portfolio?.id,
    association_id:  str(formData, 'association_id'),   // nullable
    name:            req(formData, 'name'),
    bank_name:       req(formData, 'bank_name'),
    description:     str(formData, 'description'),
    routing_number:  str(formData, 'routing_number'),
    account_number:  str(formData, 'account_number'),
    account_type:    str(formData, 'account_type') ?? 'checking',
    gl_account_id:   str(formData, 'gl_account_id'),
    entity_name:     str(formData, 'entity_name'),
    entity_address:  str(formData, 'entity_address'),
    company_name:    str(formData, 'company_name'),
    company_address: str(formData, 'company_address'),
    check_signature: str(formData, 'check_signature'),
    payments_enabled: formData.get('payments_enabled') === 'on',
    auto_reconciliation: formData.get('auto_reconciliation') === 'on',
    use_printable_deposit_slip: formData.get('use_printable_deposit_slip') === 'on',
    next_check_number: intn(formData, 'next_check_number'),
  };

  const { data: bank, error } = await (supabase as any)
    .from('bank_accounts').insert(payload).select('id').single();
  if (error || !bank) { failTo(error?.message ?? 'Failed to create bank account'); return; }

  revalidatePath('/bank-accounts');
  if (payload.association_id) revalidatePath(`/associations/${payload.association_id}`);

  // If the form says "return to association", bounce back there.
  const ret = str(formData, 'return_to');
  if (ret && ret.startsWith('/')) redirect(ret);
  redirect(`/bank-accounts`);
}

// ============================================================================
// BUILDINGS
// ============================================================================

/**
 * Create a Building — the physical asset under an Association.
 *
 * This holds all the physical / operational fields: address, year built, site
 * manager, amenities, maintenance limits, insurance expiration, home warranty,
 * maintenance notes. See PROJECT_HANDOFF.md §0.
 *
 * If the parent Association has no primary building yet, this one becomes
 * primary automatically.
 */
export async function createBuilding(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();

  const failTo = (msg: string) => {
    redirect(`/buildings/new?error=${encodeURIComponent(msg)}`);
  };

  const associationId = req(formData, 'association_id');

  // Parse amenities as comma-separated → jsonb array
  const amenitiesCsv = str(formData, 'amenities');
  const amenities = amenitiesCsv
    ? amenitiesCsv.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Is there already a primary building for this association?
  const { data: existingPrimary } = await (supabase as any)
    .from('buildings')
    .select('id')
    .eq('association_id', associationId)
    .eq('is_primary', true)
    .is('archived_at', null)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    association_id: associationId,
    is_primary: !existingPrimary,   // first building for this association → primary

    // --- Identity / address ---
    name:           req(formData, 'name'),
    address:        req(formData, 'address'),
    address_line_2: str(formData, 'address_line_2'),
    city:           str(formData, 'city'),
    state:          str(formData, 'state'),
    zip:            str(formData, 'zip'),
    county:         str(formData, 'county'),
    property_type:  str(formData, 'property_type') ?? 'hoa',

    // --- Physical facts ---
    year_built:             intn(formData, 'year_built'),
    description:            str(formData, 'description'),
    site_manager:           str(formData, 'site_manager'),
    site_manager_phone:     str(formData, 'site_manager_phone'),
    management_start_date:  str(formData, 'management_start_date'),
    amenities,
    lockbox_id:             str(formData, 'lockbox_id'),

    // --- Maintenance / insurance ---
    maintenance_limit:                      num(formData, 'maintenance_limit'),
    insurance_expiration:                   str(formData, 'insurance_expiration'),
    home_warranty_covered:                  formData.get('home_warranty_covered') === 'on',
    disable_online_maintenance_requests:    formData.get('disable_online_maintenance_requests') === 'on',
    unit_entry_pre_authorized:              formData.get('unit_entry_pre_authorized') === 'on',
    maintenance_notes:                      str(formData, 'maintenance_notes'),
    online_maintenance_request_instructions: str(formData, 'online_maintenance_request_instructions'),
  };

  // Strip nulls so column defaults can apply
  for (const k of Object.keys(payload)) {
    if (payload[k] === null) delete payload[k];
  }

  const { data: b, error } = await (supabase as any).from('buildings').insert(payload).select('id').single();
  if (error || !b) { failTo(error?.message ?? 'Failed to create building'); return; }

  revalidatePath(`/associations/${associationId}`);
  revalidatePath('/buildings');
  redirect(`/associations/${associationId}`);
}

/**
 * Update a Building — the physical asset fields.
 */
export async function updateBuilding(id: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const failTo = (msg: string) => redirect(`/buildings/${id}?error=${encodeURIComponent(msg)}`);

  const amenitiesCsv = str(formData, 'amenities');
  const amenities = amenitiesCsv != null
    ? amenitiesCsv.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  const patch: Record<string, unknown> = {
    name:           str(formData, 'name'),
    address:        str(formData, 'address'),
    address_line_2: str(formData, 'address_line_2'),
    city:           str(formData, 'city'),
    state:          str(formData, 'state'),
    zip:            str(formData, 'zip'),
    county:         str(formData, 'county'),
    property_type:  str(formData, 'property_type'),

    year_built:             intn(formData, 'year_built'),
    description:            str(formData, 'description'),
    site_manager:           str(formData, 'site_manager'),
    site_manager_phone:     str(formData, 'site_manager_phone'),
    management_start_date:  str(formData, 'management_start_date'),
    lockbox_id:             str(formData, 'lockbox_id'),

    maintenance_limit:                      num(formData, 'maintenance_limit'),
    insurance_expiration:                   str(formData, 'insurance_expiration'),
    maintenance_notes:                      str(formData, 'maintenance_notes'),
    online_maintenance_request_instructions: str(formData, 'online_maintenance_request_instructions'),
  };

  // Booleans: only include if the form field was submitted
  if (formData.has('home_warranty_covered'))                patch.home_warranty_covered = formData.get('home_warranty_covered') === 'on';
  if (formData.has('disable_online_maintenance_requests'))  patch.disable_online_maintenance_requests = formData.get('disable_online_maintenance_requests') === 'on';
  if (formData.has('unit_entry_pre_authorized'))            patch.unit_entry_pre_authorized = formData.get('unit_entry_pre_authorized') === 'on';

  if (amenities !== undefined) patch.amenities = amenities;

  Object.keys(patch).forEach((k) => patch[k] === null && delete patch[k]);

  const { data: b, error } = await (supabase as any)
    .from('buildings')
    .update(patch)
    .eq('id', id)
    .select('association_id')
    .single();
  if (error) { failTo(error.message); return; }

  if (b?.association_id) revalidatePath(`/associations/${b.association_id}`);
  revalidatePath('/buildings');
  revalidatePath(`/buildings/${id}`);
}

// ============================================================================
// UNITS
// ============================================================================

export async function createUnit(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();

  const failTo = (msg: string) => {
    redirect(`/units/new?error=${encodeURIComponent(msg)}`);
  };

  const payload = {
    building_id:  req(formData, 'building_id'),
    unit_number:  req(formData, 'unit_number'),
    name:         str(formData, 'name'),
    bedrooms:     intn(formData, 'bedrooms'),
    bathrooms:    num(formData, 'bathrooms'),
    sqft:         intn(formData, 'sqft'),
    ownership_pct: num(formData, 'ownership_pct') ?? 0,
    parking_spaces: str(formData, 'parking_spaces'),
    storage_number: str(formData, 'storage_number'),
    notes:        str(formData, 'notes'),
  };

  const { data: unit, error } = await (supabase as any).from('units').insert(payload).select('id, building_id, buildings(association_id)').single();
  if (error || !unit) { failTo(error?.message ?? 'Failed to create unit'); return; }

  const assocId = (unit.buildings as any)?.association_id;
  if (assocId) revalidatePath(`/associations/${assocId}`);
  revalidatePath('/units');
  redirect(`/units/${unit.id}`);
}

export async function updateUnit(id: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const failTo = (msg: string) => redirect(`/units/${id}?error=${encodeURIComponent(msg)}`);
  const patch: Record<string, unknown> = {
    unit_number:    str(formData, 'unit_number'),
    name:           str(formData, 'name'),
    bedrooms:       intn(formData, 'bedrooms'),
    bathrooms:      num(formData, 'bathrooms'),
    sqft:           intn(formData, 'sqft'),
    ownership_pct:  num(formData, 'ownership_pct'),
    parking_spaces: str(formData, 'parking_spaces'),
    storage_number: str(formData, 'storage_number'),
    notes:          str(formData, 'notes'),
  };
  Object.keys(patch).forEach((k) => patch[k] === null && delete patch[k]);
  const { error } = await (supabase as any).from('units').update(patch).eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath(`/units/${id}`);
  revalidatePath('/units');
}

// ============================================================================
// OWNERS (HOMEOWNERS)
// ============================================================================

export async function createOwner(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const failTo = (msg: string) => redirect(`/owners/new?error=${encodeURIComponent(msg)}`);

  const firstName = str(formData, 'first_name');
  const lastName  = str(formData, 'last_name');
  const fullName  = str(formData, 'full_name') ?? [firstName, lastName].filter(Boolean).join(' ');
  if (!fullName) failTo('Name is required');
  const email = req(formData, 'email');

  // Create Supabase auth user if portal activated
  let authUserId: string | null = null;
  const activatePortal = formData.get('activate_portal') === 'on';
  if (activatePortal) {
    const password = str(formData, 'portal_password') ?? generatePassword();
    const { data: authUser, error: authErr } = await (supabase as any).auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'owner' },
    });
    if (authErr) {
      console.error('Auth user creation failed:', authErr.message);
      // Continue anyway — owner record still gets created
    } else {
      authUserId = authUser?.user?.id ?? null;
    }
  }

  const payload = {
    portfolio_id: me.portfolio?.id,
    first_name: firstName,
    last_name:  lastName,
    full_name:  fullName,
    email,
    phone:      str(formData, 'phone'),
    address_street: str(formData, 'address_street'),
    address_city:   str(formData, 'address_city'),
    address_state:  str(formData, 'address_state'),
    address_zip:    str(formData, 'address_zip'),
    preferred_comm: str(formData, 'preferred_comm') ?? 'email',
    portal_activated: activatePortal,
    auth_user_id: authUserId,
    notes:          str(formData, 'notes'),
    created_by:     me.auth_user_id,
  };

  const { data: owner, error } = await (supabase as any).from('owners').insert(payload).select('id').single();
  if (error || !owner) { failTo(error?.message ?? 'Failed to create owner'); return; }

  // Create occupancy link if unit is specified
  const unitId = str(formData, 'unit_id');
  const associationId = str(formData, 'association_id');
  if (unitId && associationId) {
    await (supabase as any).from('occupancies').insert({
      owner_id: owner.id,
      unit_id: unitId,
      association_id: associationId,
      occupancy_type: 'owner',
      status: 'current',
      move_in_date: str(formData, 'move_in_date') ?? new Date().toISOString().slice(0, 10),
      dues_amount: str(formData, 'dues_amount') ? Number(str(formData, 'dues_amount')) : null,
      dues_frequency: 'monthly',
      share_pct: str(formData, 'ownership_pct') ? Number(str(formData, 'ownership_pct')) : 100,
      is_primary: true,
    });
  }

  revalidatePath('/owners');
  revalidatePath(`/owners/${owner.id}`);
  // Pass the generated password so the manager can share it with the owner
  if (activatePortal && authUserId) {
    const pw = str(formData, 'portal_password') ?? 'auto-generated';
    redirect(`/owners/${owner.id}?portal_created=1&email=${encodeURIComponent(email)}`);
  }
  redirect(`/owners/${owner.id}`);
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export async function updateOwner(id: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const failTo = (msg: string) => {
    redirect(`/owners/${id}?error=${encodeURIComponent(msg)}`);
  };
  const patch: Record<string, unknown> = {
    first_name:    str(formData, 'first_name'),
    last_name:     str(formData, 'last_name'),
    full_name:     str(formData, 'full_name'),
    email:         str(formData, 'email'),
    phone:         str(formData, 'phone'),
    address_street: str(formData, 'address_street'),
    address_city:   str(formData, 'address_city'),
    address_state:  str(formData, 'address_state'),
    address_zip:    str(formData, 'address_zip'),
    preferred_comm: str(formData, 'preferred_comm'),
    notes:          str(formData, 'notes'),
  };
  Object.keys(patch).forEach((k) => patch[k] === null && delete patch[k]);
  const { error } = await (supabase as any).from('owners').update(patch).eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath(`/owners/${id}`);
  revalidatePath('/owners');
}

// ============================================================================
// OCCUPANCIES — Owner ↔ Unit linking
// ============================================================================

/** Link a owner to a unit via the occupancies table. */
export async function linkOccupancy(ownerId: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();

  const failTo = (msg: string) => {
    redirect(`/owners/${ownerId}?error=${encodeURIComponent(msg)}`);
  };

  const unitId = req(formData, 'unit_id');

  // Resolve association_id from the unit (never trust the client)
  const { data: unit, error: unitErr } = await (supabase as any)
    .from('units')
    .select('id, buildings!inner(association_id)')
    .eq('id', unitId)
    .maybeSingle();
  if (unitErr || !unit) { failTo('Unit not found'); return; }
  const associationId = (unit.buildings as any).association_id;

  const payload = {
    owner_id:        ownerId,
    unit_id:         unitId,
    association_id:  associationId,
    occupancy_type:  str(formData, 'occupancy_type') ?? 'owner',
    status:          str(formData, 'status') ?? 'current',
    move_in_date:    str(formData, 'move_in_date'),
    move_out_date:   str(formData, 'move_out_date'),
    dues_amount:     num(formData, 'dues_amount'),
    dues_frequency:  str(formData, 'dues_frequency') ?? 'monthly',
    is_primary:      formData.get('is_primary') === 'on',
    share_pct:       num(formData, 'share_pct') ?? 100,
  };

  const { error } = await (supabase as any).from('occupancies').insert(payload);
  if (error) { failTo(error.message); return; }

  revalidatePath(`/owners/${ownerId}`);
  revalidatePath('/owners');
  revalidatePath(`/units/${unitId}`);
}

/** End an occupancy (move-out). */
export async function endOccupancy(occupancyId: string, ownerId: string) {
  await requireStaff();
  const supabase = await createClient();
  const failTo = (msg: string) => {
    redirect(`/owners/${ownerId}?error=${encodeURIComponent(msg)}`);
  };
  const { error } = await (supabase as any).from('occupancies').update({
    status:        'past',
    move_out_date: new Date().toISOString().slice(0, 10),
  }).eq('id', occupancyId);
  if (error) { failTo(error.message); return; }
  revalidatePath(`/owners/${ownerId}`);
}

// ============================================================================
// VENDORS
// ============================================================================

export async function createVendor(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();

  const failTo = (msg: string) => {
    redirect(`/vendors/new?error=${encodeURIComponent(msg)}`);
  };

  // Build phone_numbers array from landline/mobile fields
  const phones: Array<{type: string; number: string}> = [];
  const landline = str(formData, 'phone_landline');
  const mobile = str(formData, 'phone_mobile');
  if (landline) phones.push({ type: 'landline', number: landline });
  if (mobile) phones.push({ type: 'mobile', number: mobile });

  // Build emails array
  const emailVal = str(formData, 'email');
  const emails: string[] = emailVal ? [emailVal] : [];

  const payload = {
    portfolio_id:   me.portfolio?.id,
    name:           req(formData, 'name'),
    vendor_type:    str(formData, 'vendor_type') ?? 'general',
    trade:          str(formData, 'trade') ?? 'other',
    phone_numbers:  phones,
    emails:         emails,
    address_street: str(formData, 'address_street'),
    address_city:   str(formData, 'address_city'),
    address_state:  str(formData, 'address_state'),
    address_zip:    str(formData, 'address_zip'),
    taxpayer_name:  str(formData, 'taxpayer_name'),
    taxpayer_id:    str(formData, 'taxpayer_id'),
    send_1099:      formData.get('send_1099') === 'on',
    payment_type:   str(formData, 'payment_type') ?? 'check',
    payment_terms:  str(formData, 'payment_terms'),
    bank_routing_number: str(formData, 'bank_routing_number'),
    bank_account_number: str(formData, 'bank_account_number'),
    is_utility:     formData.get('is_utility') === 'on',
    notes:          str(formData, 'notes'),
    workers_comp_expiration:       str(formData, 'workers_comp_expiration'),
    general_liability_expiration:  str(formData, 'general_liability_expiration'),
    epa_certification_expiration:  str(formData, 'epa_certification_expiration'),
    auto_insurance_expiration:     str(formData, 'auto_insurance_expiration'),
    state_license_expiration:      str(formData, 'state_license_expiration'),
    contract_expiration:           str(formData, 'contract_expiration'),
    created_by:     me.auth_user_id,
  };

  const { data: v, error } = await (supabase as any).from('vendors').insert(payload).select('id').single();
  if (error || !v) { failTo(error?.message ?? 'Failed to create vendor'); return; }

  revalidatePath('/vendors');
  redirect('/vendors');
}

export async function updateVendor(id: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const failTo = (msg: string) => redirect(`/vendors/${id}?error=${encodeURIComponent(msg)}`);

  const phones: Array<{type: string; number: string}> = [];
  const landline = str(formData, 'phone_landline');
  const mobile = str(formData, 'phone_mobile');
  if (landline) phones.push({ type: 'landline', number: landline });
  if (mobile) phones.push({ type: 'mobile', number: mobile });

  const emailVal = str(formData, 'email');
  const emails: string[] = emailVal ? [emailVal] : [];

  const patch: Record<string, unknown> = {
    name:         str(formData, 'name'),
    vendor_type:  str(formData, 'vendor_type'),
    trade:        str(formData, 'trade'),
    phone_numbers: phones,
    emails:        emails,
    address_street: str(formData, 'address_street'),
    address_city:   str(formData, 'address_city'),
    address_state:  str(formData, 'address_state'),
    address_zip:    str(formData, 'address_zip'),
    taxpayer_name: str(formData, 'taxpayer_name'),
    taxpayer_id:   str(formData, 'taxpayer_id'),
    send_1099:     formData.get('send_1099') === 'on',
    payment_type:  str(formData, 'payment_type'),
    payment_terms: str(formData, 'payment_terms'),
    bank_routing_number: str(formData, 'bank_routing_number'),
    bank_account_number: str(formData, 'bank_account_number'),
    is_utility:    formData.get('is_utility') === 'on',
    notes:         str(formData, 'notes'),
    workers_comp_expiration:       str(formData, 'workers_comp_expiration'),
    general_liability_expiration:  str(formData, 'general_liability_expiration'),
    epa_certification_expiration:  str(formData, 'epa_certification_expiration'),
    auto_insurance_expiration:     str(formData, 'auto_insurance_expiration'),
    state_license_expiration:      str(formData, 'state_license_expiration'),
    contract_expiration:           str(formData, 'contract_expiration'),
  };
  Object.keys(patch).forEach((k) => patch[k] === null && delete patch[k]);
  const { error } = await (supabase as any).from('vendors').update(patch).eq('id', id);
  if (error) { failTo(error.message); return; }
  revalidatePath(`/vendors/${id}`);
  revalidatePath('/vendors');
}

// ============================================================================
// VENDOR ACH AUTHORIZATION
// ============================================================================

export async function verifyVendorAch(formData: FormData): Promise<void> {
  'use server';
  const me = await requireStaff();
  const supabase = await createClient();
  const vendorId = req(formData, 'vendor_id');

  const { error } = await (supabase as any)
    .from('vendors')
    .update({
      ach_status: 'verified',
      ach_verified_at: new Date().toISOString(),
      ach_verified_by: me.auth_user_id,
    })
    .eq('id', vendorId);

  if (error) { redirect(`/vendors/ach?error=${encodeURIComponent(error.message)}`); }
  revalidatePath('/vendors/ach');
  revalidatePath('/vendors');
}

export async function activateVendorAch(formData: FormData): Promise<void> {
  'use server';
  const me = await requireStaff();
  const supabase = await createClient();
  const vendorId = req(formData, 'vendor_id');

  const { error } = await (supabase as any)
    .from('vendors')
    .update({
      ach_status: 'active',
      ach_activated_at: new Date().toISOString(),
      ach_activated_by: me.auth_user_id,
      is_auto_pay: true,
      auto_pay_setup_at: new Date().toISOString(),
    })
    .eq('id', vendorId);

  if (error) { redirect(`/vendors/ach?error=${encodeURIComponent(error.message)}`); }
  revalidatePath('/vendors/ach');
  revalidatePath('/vendors');
}

export async function revokeVendorAch(formData: FormData): Promise<void> {
  'use server';
  const me = await requireStaff();
  const supabase = await createClient();
  const vendorId = req(formData, 'vendor_id');

  const { error } = await (supabase as any)
    .from('vendors')
    .update({
      ach_status: 'pending',
      ach_verified_at: null,
      ach_verified_by: null,
      ach_activated_at: null,
      ach_activated_by: null,
      is_auto_pay: false,
      auto_pay_setup_at: null,
    })
    .eq('id', vendorId);

  if (error) { redirect(`/vendors/ach?error=${encodeURIComponent(error.message)}`); }
  revalidatePath('/vendors/ach');
  revalidatePath('/vendors');
}

// ============================================================================
// BULK STATEMENT SETTINGS — mirrors AppFolio's /bulk_statement_settings/new
// ============================================================================

/**
 * Apply a set of statement settings across many associations at once.
 * If `association_ids` is empty, updates *every* association in the portfolio
 * (RLS still scopes this to the caller's portfolio).
 *
 * Fields match the AppFolio form exactly.
 */
export async function updateBulkStatementSettings(formData: FormData) {
  await requirePortfolioAdmin();
  const supabase = await createClient();

  const failTo = (msg: string) => {
    redirect(`/bulk-statement-settings/new?error=${encodeURIComponent(msg)}`);
  };

  // Multi-select arrives as repeated `association_ids` form entries
  const associationIds = formData.getAll('association_ids')
    .filter((v) => typeof v === 'string' && v.length > 0) as string[];

  // Charge History Includes — enum: all_past_due_charges | current_month_only | past_three_months
  const chargeHistory = str(formData, 'charge_history_includes') ?? 'all_past_due_charges';

  const patch = {
    use_enhanced_statement:                       formData.get('use_enhanced_statement') === 'on',
    include_current_and_upcoming_charges:         formData.get('include_current_and_upcoming_charges') === 'on',
    include_current_message_on_statement:         formData.get('include_custom_message') === 'on',
    include_logo_on_statement:                    formData.get('include_logo_on_statement') === 'on',
    include_payments_due_date:                    formData.get('include_payments_due_date') === 'on',
    charge_history_includes:                      chargeHistory,
    include_payments_history_and_balance_forward: formData.get('include_payments_history_and_balance_forward') === 'on',
    show_remaining_amount_for_past_due_charges:   formData.get('show_remaining_amount_for_past_due_charges') === 'on',
    include_payment_coupon_on_statement:          formData.get('include_payment_coupon_on_statement') === 'on',
  };

  let query = (supabase as any).from('associations').update(patch).is('archived_at', null);
  if (associationIds.length > 0) query = query.in('id', associationIds);

  const { error, count } = await (query as any).select('id', { count: 'exact' });
  if (error) { failTo(error.message); return; }

  revalidatePath('/associations');
  const n = count ?? 0;
  redirect(`/associations?statements_updated=${n}`);
}
