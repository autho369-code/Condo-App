'use server';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';
import type { Database } from '@/lib/types/database';

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

  const me = await getMe();
  if (!me.auth_user_id) { failTo('Not authenticated'); return; }
  if (!me.owner_id)     { failTo('Only owners can submit service requests'); return; }

  const unitId      = formData.get('unit_id') as string;
  const description = (formData.get('description') as string)?.trim();
  const priority    = parseServiceRequestPriority(formData.get('priority'));
  const permission  = formData.get('permission_to_enter') === 'on';
  const access      = (formData.get('access_notes') as string)?.trim() || null;

  if (!unitId)      { failTo('Unit is required'); return; }
  if (!description) { failTo('Please describe the issue'); return; }
  if (description.length < 10) { failTo('Please give us at least a sentence so we can help'); return; }

  const supabase = await createClient();

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

  const { data: sr, error } = await (supabase as any).from('service_requests').insert({
    portfolio_id:          portfolioId,
    association_id:        associationId,
    unit_id:               unitId,
    homeowner_id:          me.owner_id,
    owner_id:              me.owner_id,
    description:           fullDescription,
    priority,
    permission_to_enter:   permission,
    source:                'resident',
    status:                'open',
    created_by:            me.auth_user_id,
  }).select('id').single();

  if (error || !sr) { failTo(error?.message ?? 'Failed to submit request'); return; }

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
  await (await import('@/lib/auth/me')).requireAuth();  // in-action guard; RLS enforces ownership
  const supabase = await createClient();
  const { data: updated, error } = await (supabase as any)
    .from('service_requests')
    .update({ status: 'cancelled' })
    .eq('id', serviceRequestId)
    .select('id');
  if (error) { redirect(`/portal/service-requests?error=${encodeURIComponent(error.message)}`); return; }
  // Only notify when RLS let the update through (0 rows = not this owner's request)
  if (updated && updated.length > 0) {
    // Confirmation email to the owner — never fails the action (helper never throws)
    await notifyOwnerOfStatusChange({ kind: 'service_request', id: serviceRequestId, newStatus: 'cancelled' });
  }
  revalidatePath('/portal/service-requests');
}
