'use server';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';
import type { Database } from '@/lib/types/database';
import { claimSubmission, completeSubmission, releaseSubmission } from '@/lib/forms/submission';
import { loadOwnPortalUnitIds, ownerRecordForUnit } from '@/lib/portal/own-units';

type ServiceRequestPriority = Database['public']['Enums']['service_request_priority'];

/**
 * Submit a new service request from the owner portal.
 *
 * The owner selects one of their units. We derive portfolio_id + association_id
 * from the unit (via building → association) rather than trusting form input.
 * RLS on service_requests prevents cross-portfolio / cross-association submission
 * regardless, but we validate here so errors are caught before hitting the DB.
 */
export async function submitServiceRequest(formData: FormData) {
  const failTo = (msg: string) => {
    redirect(`/portal/service-requests/new?error=${encodeURIComponent(msg)}`);
  };

  const me = await requireOwner();

  const unitId      = formData.get('unit_id') as string;
  const description = (formData.get('description') as string)?.trim();
  const priority    = parseServiceRequestPriority(formData.get('priority'));
  const permission  = formData.get('permission_to_enter') === 'on';
  const access      = (formData.get('access_notes') as string)?.trim() || null;

  if (!unitId)      { failTo('Unit is required'); return; }
  if (!description) { failTo('Please describe the issue'); return; }
  if (description.length < 10) { failTo('Please give us at least a sentence so we can help'); return; }

  const supabase = await createClient();

  // The unit must be one of the caller's own current units (RLS alone admits
  // board members to every unit in the association).
  const own = await loadOwnPortalUnitIds(supabase, me.owner_ids);
  if (own.error) { failTo(own.error); return; }
  if (!own.ids.includes(unitId)) { failTo('Unit not found or you no longer have access to it'); return; }
  // Filed under the login's owner record that holds this unit (one per association).
  const holder = await ownerRecordForUnit(supabase, me.owner_ids, unitId);
  if (holder.error || !holder.ownerId) { failTo(holder.error ?? 'Unit not found or you no longer have access to it'); return; }

  // Resolve association + portfolio from the unit — never trust the client for these
  const { data: unit, error: unitErr } = await (supabase as any)
    .from('units')
    .select('id, buildings!inner(association_id, associations!inner(portfolio_id))')
    .eq('id', unitId)
    .maybeSingle();
  if (unitErr || !unit) { failTo('Unit not found or you no longer have access to it'); return; }
  const associationId = (unit.buildings as any).association_id;
  const portfolioId   = (unit.buildings as any).associations.portfolio_id;

  const fullDescription = access ? `${description}\n\nAccess notes: ${access}` : description;

  // A double click or re-sent form must not file the same request twice.
  const claim = await claimSubmission(supabase, formData, 'portal_service_request');
  if (claim.status === 'error') { failTo(claim.message); return; }
  if (claim.status === 'duplicate') {
    redirect(claim.resultId
      ? `/portal/service-requests?submitted=${claim.resultId}&notice=already_submitted`
      : '/portal/service-requests?notice=already_submitted');
  }
  const token = (claim as { token: string }).token;

  const { data: sr, error } = await (supabase as any).from('service_requests').insert({
    portfolio_id:          portfolioId,
    association_id:        associationId,
    unit_id:               unitId,
    homeowner_id:          holder.ownerId,
    owner_id:              holder.ownerId,
    description:           fullDescription,
    priority,
    permission_to_enter:   permission,
    source:                'resident',
    status:                'open',
    created_by:            me.auth_user_id,
  }).select('id').single();

  if (error || !sr) {
    await releaseSubmission(supabase, token);
    failTo(error?.message ?? 'Failed to submit request');
    return;
  }
  await completeSubmission(supabase, token, sr.id);

  revalidatePath('/portal/service-requests');
  revalidatePath('/portal');
  redirect(`/portal/service-requests?submitted=${sr.id}`);
}

function parseServiceRequestPriority(value: FormDataEntryValue | null): ServiceRequestPriority {
  switch (value) {
    case 'low':
    case 'high':
    case 'emergency':
      return value;
    case 'normal':
    default:
      return 'normal';
  }
}

/** Resident cancels one of their own open requests. RLS enforces ownership. */
export async function cancelServiceRequest(serviceRequestId: string) {
  await requireOwner();  // in-action guard; RLS enforces ownership
  const supabase = await createClient();
  const { data: updated, error } = await (supabase as any)
    .from('service_requests')
    .update({ status: 'cancelled' })
    .eq('id', serviceRequestId)
    .select('id');
  if (error) { redirect(`/portal/service-requests?error=${encodeURIComponent(error.message)}`); return; }
  // 0 rows = RLS refused (not this owner's request, or no longer open).
  if (!updated || updated.length === 0) {
    redirect(`/portal/service-requests?error=${encodeURIComponent('That request can no longer be cancelled. Contact management if it still needs to stop.')}`);
    return;
  }
  // Confirmation email to the owner — never fails the action (helper never throws)
  await notifyOwnerOfStatusChange({ kind: 'service_request', id: serviceRequestId, newStatus: 'cancelled' });
  revalidatePath('/portal/service-requests');
  redirect('/portal/service-requests?cancelled=1');
}
