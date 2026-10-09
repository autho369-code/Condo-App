'use server';
// Entity CRUD for Associations, Buildings, Units, Owners, Vendors.
// Every insert resolves portfolio_id from me() server-side; never trust client.
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireStaff, requirePortfolioAdmin, requireFinanceOrPortfolioAdmin } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { safeInternalNext } from '@/lib/security/redirects';
import { savePrivateFields } from '@/lib/private-fields';
import { queueOwnerPortalInvitation } from '@/lib/auth/owner-invitation';
import { todayInZone } from '@/lib/time/zoned';
import { scheduleOwnerDues } from '@/lib/billing/dues-subscription';

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
// Boolean from a <select> with "true"/"false" values; null (absent) is
// stripped like every other field so partial forms don't clobber columns.
const boolStr = (f: FormData, k: string) => {
  const v = str(f, k);
  return v == null ? null : v === 'true';
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
  const failTo = (msg: string) => redirect(`/associations/${id}/profile?error=${encodeURIComponent(msg)}`);

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

    // --- Automatic late-fee assessment (daily cron: /api/billing/assess-late-fees) ---
    late_fee_enabled:    boolStr(formData, 'late_fee_enabled'),
    late_fee_amount:     num(formData, 'late_fee_amount'),
    late_fee_is_percent: boolStr(formData, 'late_fee_is_percent'),
    late_fee_grace_days: intn(formData, 'late_fee_grace_days'),

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

  const { data: changed, error } = await (supabase as any).from('associations').update(patch).eq('id', id).select('id');
  if (error) { failTo(error.message); return; }
  if (!changed?.length) { failTo('Association was not saved: it is gone or your account cannot edit it.'); return; }
  revalidatePath(`/associations/${id}`);
  revalidatePath('/associations');
}

export async function archiveAssociation(id: string) {
  await requirePortfolioAdmin();
  const supabase = await createClient();
  const { data: changed, error } = await (supabase as any).from('associations').update({ archived_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) { redirect(`/associations/${id}/profile?error=${encodeURIComponent(error.message)}`); return; }
  if (!changed?.length) { redirect(`/associations/${id}/profile?error=${encodeURIComponent('Association was not archived: it is gone or your account cannot edit it.')}`); return; }
  revalidatePath('/associations');
  redirect('/associations');
}

/** Managers (full-access staff) and platform operators may hide associations. */
function canHideAssociations(me: { is_full_access_staff: boolean; is_platform_operator: boolean }) {
  return me.is_full_access_staff || me.is_platform_operator;
}

/**
 * Form action: hide an association (it drops out of lists and pickers) or
 * show it again. Hidden associations keep all their history.
 */
export async function setAssociationHidden(formData: FormData) {
  const me = await requireStaff();
  const id = String(formData.get('association_id') ?? '');
  const hide = formData.get('hide') === '1';
  const back = `/associations/${id}/profile`;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    redirect('/associations?error=' + encodeURIComponent('Association not found.'));
  }
  if (!canHideAssociations(me)) redirect(`${back}?error=${encodeURIComponent('Only managers can hide or unhide associations.')}`);
  const supabase = await createClient();
  // Scope to the association's own portfolio: a manager only within theirs,
  // a platform operator within whichever portfolio owns it.
  const { data: target } = await (supabase as any).from('associations').select('id, portfolio_id').eq('id', id).maybeSingle();
  if (!target || (!me.is_platform_operator && target.portfolio_id !== me.portfolio?.id)) {
    redirect(`${back}?error=${encodeURIComponent('Association not found or you do not have access to it.')}`);
  }
  const { data, error } = await (supabase as any).from('associations')
    .update({ archived_at: hide ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('portfolio_id', target.portfolio_id)
    .select('id');
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  if (!data || data.length === 0) redirect(`${back}?error=${encodeURIComponent('Association not found or you do not have access to it.')}`);
  revalidatePath('/associations');
  redirect(`${back}?saved=${encodeURIComponent(hide ? 'Association hidden. It no longer appears in lists; turn on "Show hidden" to find it.' : 'Association is visible again.')}`);
}

// ============================================================================
// BANK ACCOUNTS
// ============================================================================

export async function createBankAccount(formData: FormData) {
  const me = await requireFinanceOrPortfolioAdmin();
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

  // The bank carries its cash on this GL account, so it must be an active
  // cash/asset account of the same company and, if association-specific, the
  // bank's own association (same rules as linking one later).
  if (payload.association_id) {
    const { data: assoc } = await (supabase as any).from('associations')
      .select('id').eq('id', payload.association_id).eq('portfolio_id', me.portfolio?.id).maybeSingle();
    if (!assoc) { failTo('Choose an association in this company.'); return; }
  }
  if (payload.gl_account_id) {
    const { data: gl } = await (supabase as any).from('gl_accounts')
      .select('id, portfolio_id, association_id, account_type, active').eq('id', payload.gl_account_id).maybeSingle();
    if (!gl || gl.portfolio_id !== me.portfolio?.id || !gl.active) { failTo('Choose an active GL account in this company.'); return; }
    if (!['cash', 'asset'].includes(String(gl.account_type))) { failTo('Choose a cash or asset GL account.'); return; }
    if (gl.association_id && gl.association_id !== payload.association_id) { failTo('That GL account belongs to a different association.'); return; }
  }

  const { data: bank, error } = await (supabase as any)
    .from('bank_accounts').insert(payload).select('id').single();
  if (error || !bank) { failTo(error?.message ?? 'Failed to create bank account'); return; }

  revalidatePath('/bank-accounts');
  if (payload.association_id) revalidatePath(`/associations/${payload.association_id}`);

  // If the form says "return to association", bounce back there.
  const ret = safeInternalNext(str(formData, 'return_to'));
  if (ret) redirect(ret);
  redirect(`/bank-accounts`);
}

export async function updateBankCheckSettings(formData: FormData) {
  await requireFinanceOrPortfolioAdmin();
  const id = req(formData, 'bank_account_id');
  const signer = req(formData, 'check_signature');
  if (signer.length > 120) {
    redirect(`/bank-accounts/${id}?error=${encodeURIComponent('Authorized signer label must be 120 characters or fewer.')}`);
  }
  const supabase = await createClient();
  const { data: updatedRow, error } = await (supabase as any)
    .from('bank_accounts')
    .update({
      check_signature: signer,
      company_name: str(formData, 'company_name'),
      company_address: str(formData, 'company_address'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  // No row back means RLS blocked the update: say so instead of "saved".
  if (error || !updatedRow) {
    redirect(`/bank-accounts/${id}?error=${encodeURIComponent(error?.message ?? 'You cannot change this bank account.')}`);
  }
  revalidatePath(`/bank-accounts/${id}`);
  revalidatePath('/bills/check-run');
  redirect(`/bank-accounts/${id}?check_settings_saved=1`);
}

/**
 * Link a bank account that has no GL account yet to a cash/asset GL account,
 * so it can carry ledger cash and be reconciled. Changing an existing link is
 * not allowed here: the account's posted history lives on the old GL account.
 */
export async function linkBankGlAccount(formData: FormData) {
  const me = await requireFinanceOrPortfolioAdmin();
  const id = req(formData, 'bank_account_id');
  const glId = req(formData, 'gl_account_id');
  const fail = (msg: string): never => redirect(`/bank-accounts/${id}?error=${encodeURIComponent(msg)}`);
  const supabase = await createClient();
  const db = supabase as any;
  // RLS scopes both reads to the caller's company.
  const { data: bank } = await db.from('bank_accounts')
    .select('id, portfolio_id, association_id, gl_account_id').eq('id', id).is('archived_at', null).maybeSingle();
  if (!bank || bank.portfolio_id !== me.portfolio?.id) fail('Bank account not found.');
  if (bank.gl_account_id) fail('This bank account is already linked to a GL account.');
  const { data: gl } = await db.from('gl_accounts')
    .select('id, portfolio_id, association_id, account_type, active').eq('id', glId).maybeSingle();
  if (!gl || gl.portfolio_id !== bank.portfolio_id || !gl.active) fail('Choose an active GL account in this company.');
  if (!['cash', 'asset'].includes(String(gl.account_type))) fail('Choose a cash or asset GL account.');
  if (gl.association_id && gl.association_id !== bank.association_id) fail('That GL account belongs to a different association.');
  const { data: updated, error } = await db.from('bank_accounts')
    .update({ gl_account_id: glId, updated_at: new Date().toISOString() })
    .eq('id', id).is('gl_account_id', null).select('id').maybeSingle();
  if (error || !updated) fail(error?.message ?? 'The bank account could not be linked.');
  revalidatePath(`/bank-accounts/${id}`);
  revalidatePath('/bank-accounts');
  redirect(`/bank-accounts/${id}?gl_linked=1`);
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

  const associationId = str(formData, 'association_id');
  if (!associationId) redirect(`/associations?error=${encodeURIComponent('Choose the association to add the building to.')}`);
  // /buildings/new bounces to /associations without ?association=, which
  // swallowed every error message.
  const failTo = (msg: string) => {
    redirect(`/buildings/new?association=${encodeURIComponent(associationId)}&error=${encodeURIComponent(msg)}`);
  };
  if (!str(formData, 'name')) { failTo('Enter the building name.'); return; }
  if (!str(formData, 'address')) { failTo('Enter the building address.'); return; }

  // The form offers a property group; it lives on the association and must
  // be the association's company's (the foreign key accepts any company's).
  // Checked before the building is created.
  const propertyGroupId = str(formData, 'property_group_id');
  if (propertyGroupId) {
    const { data: assoc } = await (supabase as any).from('associations').select('portfolio_id').eq('id', associationId).maybeSingle();
    const { data: group } = assoc?.portfolio_id
      ? await (supabase as any).from('property_groups').select('id').eq('id', propertyGroupId).eq('portfolio_id', assoc.portfolio_id).maybeSingle()
      : { data: null };
    if (!group) { failTo('That property group was not found. Choose another group.'); return; }
  }

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

  if (propertyGroupId) {
    const { data: grouped, error: groupErr } = await (supabase as any).from('associations')
      .update({ property_group_id: propertyGroupId }).eq('id', associationId).select('id');
    if (groupErr || !grouped?.length) {
      redirect(`/associations/${associationId}?error=${encodeURIComponent(`Building created, but the property group was not saved: ${groupErr?.message ?? 'your account cannot edit this association'}`)}`);
    }
  }

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
  // There is no /buildings/[id] page — errors land on the Units workspace.
  const failTo = (msg: string) => redirect(`/units?error=${encodeURIComponent(msg)}`);

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
  // A missing required field must come back as a message, not a crash page.
  if (!str(formData, 'building_id')) { failTo('Choose the building this unit is in.'); return; }
  if (!str(formData, 'unit_number')) { failTo('Enter the unit number.'); return; }

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
  const { data: changed, error } = await (supabase as any).from('units').update(patch).eq('id', id).select('id');
  if (error) { failTo(error.message); return; }
  if (!changed?.length) { failTo('Unit was not saved: it is gone or your account cannot edit it.'); return; }
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

  // Portal identities are created only after verified-email invitation.
  const activatePortal = formData.get('activate_portal') === 'on';

  // A homeowner record belongs to exactly one association: the unit's. The
  // unit is resolved through the caller's RLS-scoped session (never trust the
  // submitted association_id), and the association it gives is the record's.
  const unitId = str(formData, 'unit_id');
  if (!unitId) { failTo('Choose the unit this homeowner owns: a homeowner belongs to one association.'); return; }
  const { data: unit, error: unitErr } = await (supabase as any)
    .from('units')
    .select('id, buildings!inner(association_id, associations!inner(id, portfolio_id))')
    .eq('id', unitId)
    .is('archived_at', null)
    .maybeSingle();
  const associationId: string | undefined = unit?.buildings?.association_id;
  const portfolioId: string | undefined = unit?.buildings?.associations?.portfolio_id;
  if (unitErr || !unit || !associationId || !portfolioId) {
    failTo(unitErr ? `Could not check the unit: ${unitErr.message}` : 'That unit was not found or is outside your access.');
    return;
  }
  const submittedAssociationId = str(formData, 'association_id');
  if (submittedAssociationId && submittedAssociationId !== associationId) {
    failTo('That unit is not in the selected association.');
    return;
  }
  if (!me.is_platform_operator) {
    if (portfolioId !== me.portfolio?.id) { failTo('That unit is outside your company.'); return; }
    // can_manage_association also honors association-scoped managers.
    const { data: canManage, error: manageErr } = await (supabase as any)
      .rpc('can_manage_association', { p_association_id: associationId });
    if (manageErr || canManage !== true) { failTo('You are not authorized to manage this unit\'s association.'); return; }
  }

  const payload = {
    association_id: associationId,
    portfolio_id: portfolioId,
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
    portal_activated: false,
    auth_user_id: null,
    notes:          str(formData, 'notes'),
    created_by:     me.auth_user_id,
  };

  const { data: owner, error } = await (supabase as any).from('owners').insert(payload).select('id').single();
  if (error || !owner) { failTo(error?.message ?? 'Failed to create owner'); return; }

  // Owner occupancy on the unit (unit_owners follows via the occupancies trigger).
  {
    const { error: occErr } = await (supabase as any).from('occupancies').insert({
      owner_id: owner.id,
      unit_id: unitId,
      association_id: associationId,
      occupancy_type: 'owner',
      status: 'current',
      move_in_date: str(formData, 'move_in_date') ?? todayInZone(),
      // dues_amount is NOT NULL (default 0).
      dues_amount: str(formData, 'dues_amount') ? Number(str(formData, 'dues_amount')) : 0,
      dues_frequency: 'monthly',
      share_pct: str(formData, 'ownership_pct') ? Number(str(formData, 'ownership_pct')) : 100,
      is_primary: true,
    });
    if (occErr) {
      redirect(`/owners/${owner.id}?error=${encodeURIComponent(`Owner created, but the unit was not linked: ${occErr.message}`)}`);
    }
  }

  let portalInvitationQueued = false;
  if (activatePortal) {
    const invitation = await queueOwnerPortalInvitation(createServiceClient() as any, {
      email,
      fullName,
      portfolioId,
      invitedBy: me.auth_user_id,
    });
    if (invitation.error) {
      redirect(`/owners/${owner.id}?error=${encodeURIComponent(`Owner created, but portal invitation failed: ${invitation.error}`)}`);
    }
    portalInvitationQueued = true;
  }

  revalidatePath('/owners');
  revalidatePath(`/owners/${owner.id}`);
  // Staff see only that the invitation was queued; no password is generated.
  if (portalInvitationQueued) {
    redirect(`/owners/${owner.id}?portal_created=1&email=${encodeURIComponent(email)}`);
  }
  redirect(`/owners/${owner.id}`);
}

export async function updateOwner(id: string, formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const failTo = (msg: string) => {
    redirect(`/owners/${id}?error=${encodeURIComponent(msg)}`);
  };
  const patch: Record<string, unknown> = {};
  // Optional fields the form submits: a blank value clears the field (dropping
  // blanks meant a phone, address or note could never be removed).
  for (const k of ['first_name', 'last_name', 'phone', 'address_street', 'address_city', 'address_state', 'address_zip']) {
    if (formData.has(k)) patch[k] = str(formData, k);
  }
  // Required columns: only written when a value is supplied.
  if (formData.has('email')) {
    const email = str(formData, 'email');
    if (!email) { failTo('Email is required.'); return; }
    patch.email = email;
  }
  const preferredComm = str(formData, 'preferred_comm');
  if (preferredComm) patch.preferred_comm = preferredComm;
  // full_name is what every list, ledger and letter shows; keep it in step
  // with the first/last name fields.
  const explicitFullName = str(formData, 'full_name');
  const composed = [patch.first_name, patch.last_name].filter(Boolean).join(' ').trim();
  if (explicitFullName) patch.full_name = explicitFullName;
  else if (composed) patch.full_name = composed;
  // Both blank (e.g. an LLC owner known only by full_name): keep full_name.

  const { data: updated, error } = await (supabase as any).from('owners').update(patch).eq('id', id).select('id');
  if (error) { failTo(error.message); return; }
  if (!updated || updated.length === 0) { failTo('Owner not found or you do not have access to edit it.'); return; }
  // Staff notes are staff-only (owner_private): written there directly so a
  // blank value clears the stored note.
  if (formData.has('notes')) {
    const notesError = await savePrivateFields(supabase, 'owner_private', 'owner_id', id, { notes: str(formData, 'notes') });
    if (notesError) { failTo(`Profile saved, but the notes were not: ${notesError.message}`); return; }
  }
  revalidatePath(`/owners/${id}`);
  revalidatePath('/owners');
  redirect(`/owners/${id}?saved=profile`);
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

  // A homeowner record belongs to exactly one association: only units of the
  // owner's own association can be linked (the database enforces it too).
  const { data: ownerRow, error: ownerErr } = await (supabase as any)
    .from('owners')
    .select('id, association_id')
    .eq('id', ownerId)
    .maybeSingle();
  if (ownerErr || !ownerRow) { failTo(ownerErr ? `Could not check the homeowner: ${ownerErr.message}` : 'Homeowner not found or outside your access.'); return; }
  if (ownerRow.association_id !== associationId) {
    failTo('That unit is in another association. This homeowner belongs to one association; add them as a new homeowner of the other association instead.');
    return;
  }

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

  const { data: occ, error } = await (supabase as any).from('occupancies').insert(payload).select('id').single();
  if (error) { failTo(error.message); return; }

  // Bill the dues when the field was filled in (an explicit 0 stops the
  // previous owner's dues; blank, e.g. a co-owner, leaves them alone).
  // The function ignores tenant and past occupancies.
  if (occ?.id && str(formData, 'dues_amount') !== null) {
    const duesErr = await scheduleOwnerDues(supabase, occ.id, payload.move_in_date);
    if (duesErr) { failTo(`Unit linked, but ${duesErr}`); return; }
  }

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
  // Scoped to this owner's still-current occupancy; zero rows means nothing
  // was ended (wrong owner, already ended, or outside the caller's access).
  const { data: ended, error } = await (supabase as any).from('occupancies').update({
    status:        'past',
    move_out_date: todayInZone(),
  }).eq('id', occupancyId).eq('owner_id', ownerId).neq('status', 'past').select('id');
  if (error) { failTo(error.message); return; }
  if (!ended || ended.length === 0) { failTo('That occupancy was not found, has already ended, or you do not have access to it.'); return; }
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

  const vendorName = str(formData, 'name');
  if (!vendorName) { failTo('Enter the vendor name.'); return; }

  // A vendor record belongs to one association (the same company working for
  // another association is a separate record). The management company is the
  // one company-level vendor (management fees are billed to every association).
  const isManagementCompany = formData.get('is_management_company') === 'on';
  const associationId = isManagementCompany ? null : str(formData, 'association_id');
  if (isManagementCompany) {
    if (!(me.is_company_admin || me.is_platform_operator || me.is_finance_staff)) {
      failTo('Only accounting staff or a company admin can add the management company.'); return;
    }
    const { data: scoped, error: scopedErr } = await (supabase as any).rpc('manager_is_scoped');
    if (scopedErr) { failTo(scopedErr.message); return; }
    if (scoped === true && !me.is_company_admin) {
      failTo('Only company-wide staff can add the management company.'); return;
    }
    // The management company has no association to take its company from:
    // it belongs to the signed-in user's company.
    if (!me.portfolio?.id) {
      failTo('Open a company before adding its management company.'); return;
    }
  } else {
    if (!associationId) { failTo('Choose the association this vendor works for.'); return; }
    // can_manage_association also honors association-scoped managers.
    const { data: canManage, error: accessErr } = await (supabase as any)
      .rpc('can_manage_association', { p_association_id: associationId });
    if (accessErr || canManage !== true) { failTo('You are not authorized to manage the selected association.'); return; }
  }

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
    association_id: associationId,
    is_management_company: isManagementCompany,
    name:           vendorName,
    vendor_type:    str(formData, 'vendor_type') ?? 'general',
    trade:          str(formData, 'trade') ?? 'other',
    phone_numbers:  phones,
    emails:         emails,
    address_street: str(formData, 'address_street'),
    address_city:   str(formData, 'address_city'),
    address_state:  str(formData, 'address_state'),
    address_zip:    str(formData, 'address_zip'),
    taxpayer_name:  str(formData, 'taxpayer_name'),
    send_1099:      formData.get('send_1099') === 'on',
    payment_type:   str(formData, 'payment_type') ?? 'check',
    payment_terms:  str(formData, 'payment_terms'),
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

  // Tax IDs and bank numbers live in vendor_financial_details (finance staff only).
  const fin = {
    taxpayer_id:         str(formData, 'taxpayer_id'),
    bank_routing_number: str(formData, 'bank_routing_number')?.replace(/\D/g, '') || null,
    bank_account_number: str(formData, 'bank_account_number')?.replace(/\D/g, '') || null,
  };
  const hasFin = Object.values(fin).some(Boolean);
  const canEditFinancials = !!(me.is_finance_staff || me.is_company_admin || me.is_platform_operator);
  if (hasFin && !canEditFinancials) { failTo("Only accounting staff can add a vendor's tax or bank details."); return; }
  if (fin.bank_routing_number && !/^\d{9}$/.test(fin.bank_routing_number)) { failTo('Bank routing number must be 9 digits.'); return; }
  if (fin.bank_account_number && !/^\d{4,17}$/.test(fin.bank_account_number)) { failTo('Bank account number must be 4–17 digits.'); return; }

  const { data: v, error } = await (supabase as any).from('vendors').insert(payload).select('id, portfolio_id').single();
  if (error || !v) { failTo(error?.message ?? 'Failed to create vendor'); return; }

  if (hasFin) {
    const { error: finError } = await (supabase as any).from('vendor_financial_details').insert({
      // The vendor's company (taken from its association), not the signer's.
      vendor_id: v.id, portfolio_id: v.portfolio_id, ...fin, updated_by: me.auth_user_id,
    });
    if (finError) redirect(`/vendors/${v.id}/edit?error=${encodeURIComponent('Vendor created, but the tax and bank details could not be saved: ' + finError.message)}`);
  }

  revalidatePath('/vendors');
  redirect('/vendors');
}

// ============================================================================
// VENDOR ACH AUTHORIZATION
// ============================================================================

export async function verifyVendorAch(formData: FormData): Promise<void> {
  'use server';
  const me = await requireFinanceOrPortfolioAdmin();
  const supabase = await createClient();
  const vendorId = req(formData, 'vendor_id');

  const { data: updated, error } = await (supabase as any)
    .from('vendors')
    .update({
      ach_status: 'verified',
      ach_verified_at: new Date().toISOString(),
      ach_verified_by: me.auth_user_id,
    })
    .eq('id', vendorId)
    .select('id');

  if (error) { redirect(`/vendors/ach?error=${encodeURIComponent(error.message)}`); }
  if (!updated || updated.length === 0) { redirect(`/vendors/ach?error=${encodeURIComponent('Vendor not found or you do not have access to it.')}`); }
  revalidatePath('/vendors/ach');
  revalidatePath('/vendors');
}

export async function activateVendorAch(formData: FormData): Promise<void> {
  'use server';
  const me = await requireFinanceOrPortfolioAdmin();
  const supabase = await createClient();
  const vendorId = req(formData, 'vendor_id');

  const { data: updated, error } = await (supabase as any)
    .from('vendors')
    .update({
      ach_status: 'active',
      ach_activated_at: new Date().toISOString(),
      ach_activated_by: me.auth_user_id,
      is_auto_pay: true,
      auto_pay_setup_at: new Date().toISOString(),
    })
    .eq('id', vendorId)
    .select('id');

  if (error) { redirect(`/vendors/ach?error=${encodeURIComponent(error.message)}`); }
  if (!updated || updated.length === 0) { redirect(`/vendors/ach?error=${encodeURIComponent('Vendor not found or you do not have access to it.')}`); }
  revalidatePath('/vendors/ach');
  revalidatePath('/vendors');
}

export async function revokeVendorAch(formData: FormData): Promise<void> {
  'use server';
  const me = await requireFinanceOrPortfolioAdmin();
  const supabase = await createClient();
  const vendorId = req(formData, 'vendor_id');

  const { data: updated, error } = await (supabase as any)
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
    .eq('id', vendorId)
    .select('id');

  if (error) { redirect(`/vendors/ach?error=${encodeURIComponent(error.message)}`); }
  if (!updated || updated.length === 0) { redirect(`/vendors/ach?error=${encodeURIComponent('Vendor not found or you do not have access to it.')}`); }
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
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();
  // Platform operators pass requirePortfolioAdmin and can_access_portfolio()
  // is true for every company, so RLS alone would let one submit rewrite all
  // tenants' associations. Always pin the update to the caller's portfolio.
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) redirect(`/bulk-statement-settings/new?error=${encodeURIComponent('No company selected for your account.')}`);

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

  let query = (supabase as any).from('associations').update(patch).eq('portfolio_id', portfolioId).is('archived_at', null);
  if (associationIds.length > 0) query = query.in('id', associationIds);

  const { error, count } = await (query as any).select('id', { count: 'exact' });
  if (error) { failTo(error.message); return; }

  revalidatePath('/associations');
  const n = count ?? 0;
  redirect(`/associations?statements_updated=${n}`);
}
