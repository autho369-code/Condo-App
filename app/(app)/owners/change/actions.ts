'use server';

// Change homeowner (a unit sale): the buyer becomes the unit's current owner and
// the seller's ownership ends on the transfer date. The unit's balance stays
// with the unit. The buyer can be an existing owner record or a new one.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { todayInZone } from '@/lib/time/zoned';

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
    const { data: owner } = await db.from('owners').select('id, portfolio_id').eq('id', existingOwnerId).is('archived_at', null).maybeSingle();
    if (!owner || owner.portfolio_id !== portfolioId) fail('That owner is not in this unit\'s portfolio.');
    newOwnerId = owner.id;
  } else {
    const firstName = s(formData, 'first_name');
    const lastName = s(formData, 'last_name');
    const email = s(formData, 'email');
    if (!firstName || !lastName) fail('Choose an existing owner, or enter the new owner\'s first and last name.');
    if (!email) fail('Enter the new owner\'s email.');
    const { data: owner, error } = await db.from('owners').insert({
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

  revalidatePath('/owners');
  revalidatePath(`/owners/${newOwnerId!}`);
  redirect(`/owners/${newOwnerId!}?saved=ownership_changed`);
}
