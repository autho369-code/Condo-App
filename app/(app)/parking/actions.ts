'use server';

// Parking spaces are association-owned assets that turn over and carry deposits.
// A space holds at most one active assignment; assignments keep the full history
// of who used it, the deposit held/returned, and the vehicle on file.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { todayInZone } from '@/lib/time/zoned';

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}
function num(fd: FormData, k: string): number | null {
  const v = s(fd, k);
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
}
function fail(message: string): never {
  redirect(`/parking?error=${encodeURIComponent(message)}`);
}

export async function createParkingSpace(formData: FormData) {
  const me = await requireStaff();
  const associationId = s(formData, 'association_id');
  const label = s(formData, 'label');
  if (!associationId) fail('Select an association.');
  if (!label) fail('Enter a space number / label.');

  const supabase = await createClient();
  const { error } = await (supabase as any).from('parking_spaces').insert({
    portfolio_id: me.portfolio?.id,
    association_id: associationId,
    label,
    space_type: s(formData, 'space_type') ?? 'standard',
    monthly_fee: num(formData, 'monthly_fee') ?? 0,
    deposit_amount: num(formData, 'deposit_amount') ?? 0,
    notes: s(formData, 'notes'),
    created_by: me.auth_user_id,
  });
  if (error) fail(`Could not add space: ${error.message}`);
  revalidatePath('/parking');
  redirect('/parking?space_added=1');
}

export async function assignParkingSpace(formData: FormData) {
  const me = await requireStaff();
  const spaceId = s(formData, 'parking_space_id');
  if (!spaceId) fail('No space specified.');

  const supabase = await createClient();
  const db = supabase as any;

  const { data: space } = await db.from('parking_spaces').select('id, label, monthly_fee, deposit_amount, association_id').eq('id', spaceId).maybeSingle();
  if (!space) fail('Space not found.');

  const unitId = s(formData, 'unit_id');
  const tenantId = s(formData, 'tenant_id');
  // The unit (and tenant) must belong to the space's association — the
  // assignment can auto-bill the unit, so never trust these form ids.
  if (unitId) {
    const { data: unit } = await db.from('units').select('id, buildings!inner(association_id)').eq('id', unitId).maybeSingle();
    if (!unit || (space.association_id && unit.buildings?.association_id !== space.association_id)) {
      fail('That unit is not in the same association as this parking space.');
    }
  }
  if (tenantId) {
    const { data: tenant } = await db.from('tenants').select('id, association_id, unit_id').eq('id', tenantId).maybeSingle();
    if (!tenant || (space.association_id && tenant.association_id && tenant.association_id !== space.association_id)) {
      fail('That tenant is not in the same association as this parking space.');
    }
  }
  // Owner-side parking views (owner profile, owner portal vehicles) read
  // parking_assignments.owner_id. When the space goes to the unit itself (no
  // tenant), attach the unit's current owner.
  let ownerId: string | null = null;
  if (unitId && !tenantId) {
    const { data: occ, error: occErr } = await db.from('occupancies')
      .select('owner_id')
      .eq('unit_id', unitId)
      .eq('occupancy_type', 'owner')
      .eq('status', 'current')
      .not('owner_id', 'is', null)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (occErr) fail(`Could not look up the unit's owner: ${occErr.message}`);
    ownerId = occ?.owner_id ?? null;
  }
  const startDate = s(formData, 'start_date') ?? todayInZone();
  const monthlyFee = num(formData, 'monthly_fee') ?? Number(space.monthly_fee ?? 0);
  const billToUnit = formData.get('bill_to_unit') === 'on';

  const { data: assignment, error } = await db.from('parking_assignments').insert({
    portfolio_id: me.portfolio?.id,
    parking_space_id: spaceId,
    unit_id: unitId,
    owner_id: ownerId,
    tenant_id: tenantId,
    occupant_name: s(formData, 'occupant_name'),
    start_date: startDate,
    monthly_fee: monthlyFee,
    deposit_amount: num(formData, 'deposit_amount') ?? space.deposit_amount,
    deposit_paid: formData.get('deposit_paid') === 'on',
    deposit_paid_at: formData.get('deposit_paid') === 'on' ? todayInZone() : null,
    vehicle_make: s(formData, 'vehicle_make'),
    vehicle_model: s(formData, 'vehicle_model'),
    vehicle_color: s(formData, 'vehicle_color'),
    license_plate: s(formData, 'license_plate'),
    insurance_company: s(formData, 'insurance_company'),
    insurance_policy_number: s(formData, 'insurance_policy_number'),
    notes: s(formData, 'notes'),
    status: 'active',
    created_by: me.auth_user_id,
  }).select('id').single();
  // Unique partial index throws 23505 if the space already has an active assignment.
  if (error || !assignment) {
    if (error?.code === '23505') fail('That space already has an active assignment. Release it first.');
    fail(`Could not assign space: ${error?.message ?? 'unknown error'}`);
  }

  // Automate billing: add the monthly parking fee as a recurring charge on the unit.
  let warning: string | null = null;
  if (unitId && billToUnit && monthlyFee > 0) {
    const { data: cat } = await db.from('charge_categories')
      .select('id').eq('portfolio_id', me.portfolio?.id).eq('code', 'PARKING').eq('active', true).is('archived_at', null)
      .limit(1).maybeSingle();
    if (!cat) {
      warning = 'Space assigned, but no active "Parking Fee" category exists to bill the unit. Create one under Charge categories.';
    } else {
      const { data: charge, error: feeErr } = await db.rpc('subscribe_unit_to_charge', {
        p_unit_id: unitId,
        p_charge_category_id: cat.id,
        p_amount: monthlyFee,
        p_frequency: 'monthly',
        p_start_date: startDate,
        p_memo: `Parking space ${space.label}`,
        p_identifier: space.label,
      });
      if (feeErr) warning = `Space assigned, but the monthly charge could not be added: ${feeErr.message}`;
      else if (charge?.id) {
        // Without this link, releasing the space can't find the charge to stop it.
        const { error: linkErr } = await db.from('parking_assignments').update({ recurring_charge_id: charge.id }).eq('id', assignment.id);
        if (linkErr) warning = `Space assigned and billed, but the charge could not be linked to the assignment (${linkErr.message}). Stop the parking charge on the unit by hand when the space is released.`;
      }
    }
  }

  revalidatePath('/parking');
  redirect(`/parking?assigned=1${warning ? `&warning=${encodeURIComponent(warning)}` : ''}`);
}

export async function releaseParkingSpace(formData: FormData) {
  await requireStaff();
  const assignmentId = formData.get('assignment_id') as string;
  const depositReturned = formData.get('deposit_returned') === 'on';
  const today = todayInZone();

  const supabase = await createClient();
  const db = supabase as any;

  const { data: assignment } = await db.from('parking_assignments').select('recurring_charge_id').eq('id', assignmentId).maybeSingle();

  const { data: ended, error } = await db.from('parking_assignments').update({
    status: 'ended',
    end_date: today,
    deposit_returned: depositReturned,
    deposit_returned_at: depositReturned ? today : null,
    updated_at: new Date().toISOString(),
  }).eq('id', assignmentId).select('id');
  if (error) fail(`Could not release space: ${error.message}`);
  if (!ended || ended.length === 0) fail('Assignment not found or you do not have access to it.');

  // Stop the unit's monthly parking charge that this assignment created.
  let warning: string | null = null;
  if (assignment?.recurring_charge_id) {
    const { data: stopped, error: stopErr } = await db.from('unit_recurring_charges')
      .update({ active: false, end_date: today })
      .eq('id', assignment.recurring_charge_id)
      .select('id');
    if (stopErr || !stopped || stopped.length === 0) {
      warning = `Space released, but the unit's monthly parking charge could not be stopped${stopErr ? ` (${stopErr.message})` : ''}. End it under the unit's recurring charges so the owner is not billed again.`;
    }
  }

  revalidatePath('/parking');
  redirect(`/parking?released=1${warning ? `&warning=${encodeURIComponent(warning)}` : ''}`);
}

export async function updateVehicle(formData: FormData) {
  await requireStaff();
  const assignmentId = formData.get('assignment_id') as string;
  const supabase = await createClient();
  const { data: updatedRows, error } = await (supabase as any).from('parking_assignments').update({
    vehicle_make: s(formData, 'vehicle_make'),
    vehicle_model: s(formData, 'vehicle_model'),
    vehicle_color: s(formData, 'vehicle_color'),
    license_plate: s(formData, 'license_plate'),
    insurance_company: s(formData, 'insurance_company'),
    insurance_policy_number: s(formData, 'insurance_policy_number'),
    deposit_paid: formData.get('deposit_paid') === 'on',
    updated_at: new Date().toISOString(),
  }).eq('id', assignmentId).select('id');
  if (error) fail(`Could not update vehicle: ${error.message}`);
  if (!updatedRows || updatedRows.length === 0) fail('Assignment not found or you do not have access to it.');
  revalidatePath('/parking');
  redirect('/parking?vehicle_updated=1');
}
