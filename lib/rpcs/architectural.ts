'use server';
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const CATEGORIES = [
  'exterior_paint', 'fence', 'landscaping', 'roof', 'addition',
  'deck_patio', 'windows_doors', 'solar', 'pool', 'other',
] as const;
type Category = (typeof CATEGORIES)[number];

function parseCategory(value: FormDataEntryValue | null): Category {
  const v = String(value ?? '');
  return (CATEGORIES as readonly string[]).includes(v) ? (v as Category) : 'other';
}

/**
 * Submit a new architectural review request from the owner portal.
 *
 * Like submitServiceRequest, we derive association_id + portfolio_id from the
 * selected unit rather than trusting form input. RLS (arch_req_resident_insert)
 * enforces self + own-association regardless, but we validate here so errors
 * surface before hitting the DB.
 */
export async function submitArchitecturalRequest(formData: FormData) {
  const failTo = (msg: string) =>
    redirect(`/portal/architectural/new?error=${encodeURIComponent(msg)}`);

  const me = await getMe();
  if (!me.auth_user_id) { failTo('Not authenticated'); return; }
  if (!me.owner_id)     { failTo('Only owners can submit architectural requests'); return; }

  const unitId      = formData.get('unit_id') as string;
  const title       = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const category    = parseCategory(formData.get('category'));

  if (!unitId)                  { failTo('Unit is required'); return; }
  if (!title)                   { failTo('Please give your request a short title'); return; }
  if (!description)             { failTo('Please describe the modification'); return; }
  if (description.length < 10)  { failTo('Please give us at least a sentence describing the work'); return; }

  const supabase = await createClient();

  const { data: unit, error: unitErr } = await (supabase as any)
    .from('units')
    .select('id, buildings!inner(association_id, associations!inner(portfolio_id))')
    .eq('id', unitId)
    .maybeSingle();
  if (unitErr || !unit) { failTo('Unit not found or you no longer have access to it'); return; }
  const associationId = (unit.buildings as any).association_id;
  const portfolioId   = (unit.buildings as any).associations.portfolio_id;

  const { data: req, error } = await (supabase as any).from('architectural_requests').insert({
    association_id: associationId,
    portfolio_id:   portfolioId,
    unit_id:        unitId,
    owner_id:       me.owner_id,
    submitted_by:   me.auth_user_id,
    title,
    description,
    category,
    status:         'submitted',
  }).select('id').single();

  if (error || !req) { failTo(error?.message ?? 'Failed to submit request'); return; }

  revalidatePath('/portal/architectural');
  revalidatePath('/portal');
  redirect(`/portal/architectural/${req.id}?submitted=1`);
}

/** Owner withdraws their own open request. RLS enforces ownership + status. */
export async function withdrawArchitecturalRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('architectural_requests')
    .update({ status: 'withdrawn' })
    .eq('id', requestId);
  if (error) { redirect(`/portal/architectural/${requestId}?error=${encodeURIComponent(error.message)}`); return; }
  revalidatePath(`/portal/architectural/${requestId}`);
  revalidatePath('/portal/architectural');
}

/**
 * Post a message to a request's discussion thread. Works for owner, staff, and
 * board — the caller passes the basePath so we redirect back to the right place,
 * and author_role gates which RLS insert policy applies.
 */
export async function postArchitecturalMessage(
  requestId: string,
  authorRole: 'owner' | 'staff' | 'board',
  basePath: string,
  formData: FormData,
) {
  const me = await getMe();
  const body = (formData.get('body') as string)?.trim();
  const back = `${basePath}/${requestId}`;
  if (!me.auth_user_id) { redirect('/login'); return; }
  if (!body) { redirect(`${back}?error=${encodeURIComponent('Message cannot be empty')}`); return; }

  const supabase = await createClient();
  const { error } = await (supabase as any).from('architectural_request_messages').insert({
    request_id:  requestId,
    author_id:   me.auth_user_id,
    author_name: me.profile?.full_name ?? me.email ?? null,
    author_role: authorRole,
    body,
  });
  if (error) { redirect(`${back}?error=${encodeURIComponent(error.message)}`); return; }
  revalidatePath(back);
}

/** Staff/board record a decision (approve / deny / request more info). */
export async function decideArchitecturalRequest(
  requestId: string,
  basePath: string,
  formData: FormData,
) {
  const me = await getMe();
  if (!me.auth_user_id) { redirect('/login'); return; }

  const decision = String(formData.get('decision') ?? '');
  const notes    = (formData.get('decision_notes') as string)?.trim() || null;
  const back     = `${basePath}/${requestId}`;

  const statusMap: Record<string, string> = {
    approve:   'approved',
    deny:      'denied',
    more_info: 'more_info',
    review:    'under_review',
  };
  const status = statusMap[decision];
  if (!status) { redirect(`${back}?error=${encodeURIComponent('Invalid decision')}`); return; }

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'approved' || status === 'denied') {
    patch.decided_by = me.auth_user_id;
    patch.decided_at = new Date().toISOString();
    patch.decision_notes = notes;
  } else if (notes) {
    patch.decision_notes = notes;
  }

  const { error } = await (supabase as any)
    .from('architectural_requests')
    .update(patch)
    .eq('id', requestId);
  if (error) { redirect(`${back}?error=${encodeURIComponent(error.message)}`); return; }
  revalidatePath(back);
}
