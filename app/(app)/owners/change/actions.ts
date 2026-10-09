'use server';

// Change homeowner (a unit sale): the buyer becomes the unit's current owner and
// the seller's ownership ends on the transfer date. The unit's balance stays
// with the unit. The buyer can be an existing owner record or a new one.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { todayInZone } from '@/lib/time/zoned';
import { scheduleOwnerDues } from '@/lib/billing/dues-subscription';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

export async function changeHomeowner(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const unitId = s(formData, 'unit_id');
  const fail = (message: string): never =>
    redirect(`/owners/change?${unitId && UUID_RE.test(unitId) ? `unit=${unitId}&` : ''}error=${encodeURIComponent(message)}`);

  if (!unitId || !UUID_RE.test(unitId)) fail('Choose the unit that changed hands.');
  const transferDate = s(formData, 'transfer_date') ?? todayInZone();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transferDate)) fail('Enter a valid transfer date.');

  // Resolve the unit through the caller's own (RLS-scoped) session.
  const { data: unit } = await db.from('units')
    .select('id, unit_number, buildings!inner(association_id, associations!inner(id, portfolio_id))')
    .eq('id', unitId).is('archived_at', null).maybeSingle();
  const associationId: string | undefined = unit?.buildings?.association_id;
  const portfolioId: string | undefined = unit?.buildings?.associations?.portfolio_id;
  if (!unit || !associationId || !portfolioId) fail('That unit was not found in your workspace.');
  if (!me.is_platform_operator && portfolioId !== me.portfolio?.id) fail('That unit is outside your portfolio.');

  // Buyer: an existing owner record, or a new one from the form.
  const existingOwnerId = s(formData, 'existing_owner_id');
  let newOwnerId: string;
  let createdOwner = false;
  if (existingOwnerId) {
    if (!UUID_RE.test(existingOwnerId)) fail('Choose a valid owner.');
    const { data: owner } = await db.from('owners').select('id, association_id, portfolio_id').eq('id', existingOwnerId).is('archived_at', null).maybeSingle();
    if (!owner || owner.portfolio_id !== portfolioId) fail('That owner is not in this unit\'s portfolio.');
    // A homeowner record belongs to exactly one association: a buyer from
    // another association is added as a new homeowner of this one.
    if (owner.association_id !== associationId) {
      fail('That homeowner belongs to another association. Add the buyer as a new homeowner of this association.');
    }
    newOwnerId = owner.id;
  } else {
    const firstName = s(formData, 'first_name');
    const lastName = s(formData, 'last_name');
    const email = s(formData, 'email');
    if (!firstName || !lastName) fail('Choose an existing owner, or enter the new owner\'s first and last name.');
    if (!email) fail('Enter the new owner\'s email.');
    const { data: owner, error } = await db.from('owners').insert({
      association_id: associationId,
      portfolio_id: portfolioId,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      email,
      phone: s(formData, 'phone'),
      preferred_comm: 'email',
      portal_activated: false,
      created_by: me.auth_user_id,
    }).select('id').single();
    if (error || !owner) fail(`Could not create the new owner: ${error?.message ?? 'unknown error'}`);
    newOwnerId = owner.id;
    createdOwner = true;
  }

  // One locked transaction: moves the buyer in (with the seller's dues, or 0
  // when the unit had no owner) and ends the seller's ownership.
  const { error: transferErr } = await db.rpc('change_unit_homeowner', {
    p_unit_id: unitId,
    p_new_owner_id: newOwnerId!,
    p_transfer_date: transferDate,
  });
  if (transferErr) {
    if (createdOwner) await db.from('owners').update({ archived_at: new Date().toISOString() }).eq('id', newOwnerId!);
    fail(transferErr.message);
  }

  // Bill the buyer's dues from the transfer date. A matching schedule already
  // billing the unit is kept; otherwise the seller's dues stop and the buyer's
  // start fresh.
  let duesWarning: string | null = null;
  const { data: buyerOcc } = await db.from('occupancies')
    .select('id, dues_amount')
    .eq('unit_id', unitId).eq('owner_id', newOwnerId!)
    .eq('occupancy_type', 'owner').neq('status', 'past')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (buyerOcc?.id) {
    // A buyer who was already a co-owner keeps their own occupancy, often with
    // dues left at 0: they take over the seller's dues.
    let buyerDues = Number(buyerOcc.dues_amount ?? 0);
    if (buyerDues <= 0) {
      const { data: seller } = await db.from('occupancies')
        .select('dues_amount, dues_frequency')
        .eq('unit_id', unitId).eq('occupancy_type', 'owner').eq('status', 'past')
        .neq('owner_id', newOwnerId!)
        .order('move_out_date', { ascending: false, nullsFirst: false })
        // Sellers ended together: take the one carrying the unit's dues.
        .order('dues_amount', { ascending: false })
        .limit(1).maybeSingle();
      const sellerDues = Number(seller?.dues_amount ?? 0);
      if (sellerDues > 0) {
        const { error: copyErr } = await db.from('occupancies')
          .update({ dues_amount: sellerDues, dues_frequency: seller.dues_frequency ?? 'monthly' })
          .eq('id', buyerOcc.id);
        if (copyErr) duesWarning = `dues: ${copyErr.message}`;
        else buyerDues = sellerDues;
      }
    }
    if (!duesWarning && buyerDues > 0) {
      duesWarning = await scheduleOwnerDues(db, buyerOcc.id, transferDate);
    }
  } else {
    duesWarning = 'dues: the new ownership record was not found, so dues were not scheduled';
  }

  revalidatePath('/owners');
  revalidatePath(`/owners/${newOwnerId!}`);
  redirect(`/owners/${newOwnerId!}?saved=ownership_changed${duesWarning ? `&warning=${encodeURIComponent(duesWarning)}` : ''}`);
}
