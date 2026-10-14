'use server';
import { randomUUID } from 'node:crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getMe, requireOwner, requireStaff } from '@/lib/auth/me';
import {
  MAX_ARCHITECTURAL_ATTACHMENT_BYTES,
  architecturalAttachmentBasePath,
  architecturalSurfaceAccessRole,
  isArchitecturalAttachmentPath,
  isCanonicalUuid,
  validateArchitecturalAttachmentFile,
} from '@/lib/security/tenant-boundaries';
import { revalidatePath } from 'next/cache';
import { loadOwnPortalUnitIds, ownerRecordForUnit } from '@/lib/portal/own-units';
import { notifyOwnerOfStatusChange } from '@/lib/notifications/status-change';
import { redirect } from 'next/navigation';
import { todayInZone } from '@/lib/time/zoned';
import { ARC_OPEN_STATUSES, decisionInputError, isCurrentOwnerOccupancy } from '@/lib/architectural/rules';

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
 * Submit a new architectural review request from the owner portal. RETURNS
 * the new request id — the owner's one-screen form continues uploading the
 * attached documents after creation. association_id + portfolio_id come from
 * the selected unit, never from form input (RLS arch_req_resident_insert also
 * enforces self + own association).
 */
export async function createArchitecturalRequest(input: {
  unitId: string;
  title: string;
  description: string;
  category: string;
}): Promise<{ error?: string; id?: string }> {
  const me = await requireOwner();

  const unitId = input.unitId;
  const title = (input.title ?? '').trim();
  const description = (input.description ?? '').trim();
  const category = parseCategory(input.category);

  if (!unitId) return { error: 'Unit is required' };
  if (!title) return { error: 'Please give your request a short title' };
  if (!description || description.length < 10) return { error: 'Please give us at least a sentence describing the work' };

  const supabase = await createClient();
  const own = await loadOwnPortalUnitIds(supabase, me.owner_ids);
  if (own.error) return { error: own.error };
  if (!own.ids.includes(unitId)) return { error: 'You can only submit requests for your own unit' };
  // Filed under the login's owner record that holds this unit (one per association).
  const holder = await ownerRecordForUnit(supabase, me.owner_ids, unitId);
  if (holder.error || !holder.ownerId) return { error: holder.error ?? 'You can only submit requests for your own unit' };

  const { data: unit, error: unitErr } = await (supabase as any)
    .from('units')
    .select('id, buildings!inner(association_id, associations!inner(portfolio_id))')
    .eq('id', unitId)
    .maybeSingle();
  if (unitErr || !unit) return { error: 'Unit not found or you no longer have access to it' };

  const { data: req, error } = await (supabase as any).from('architectural_requests').insert({
    association_id: (unit.buildings as any).association_id,
    portfolio_id:   (unit.buildings as any).associations.portfolio_id,
    unit_id:        unitId,
    owner_id:       holder.ownerId,
    submitted_by:   me.auth_user_id,
    title,
    description,
    category,
    status:         'submitted',
  }).select('id').single();
  if (error || !req) return { error: error?.message ?? 'Failed to submit request' };

  revalidatePath('/portal/architectural');
  revalidatePath('/portal');
  return { id: req.id };
}

/**
 * Staff submits an architectural request ON BEHALF OF a homeowner (phone/walk-in
 * requests). The form posts an occupancy id — we resolve unit/owner/association
 * server-side from that single row so a forged unit+owner pairing is impossible.
 * The staff member's own client performs both the lookup and the insert, so RLS
 * (arch_req_staff_all → can_access_association) scopes everything to
 * associations this staffer actually manages.
 */
export async function submitArchitecturalRequestOnBehalf(formData: FormData) {
  const failTo = (msg: string) =>
    redirect(`/architectural-reviews/new?error=${encodeURIComponent(msg)}`);

  const me = await requireStaff();
  // In-action guard: submitting for another owner is a staff-only power.
  if (!me.is_staff && !me.is_platform_operator) { failTo('Only staff can submit a request on an owner’s behalf'); return; }

  const occupancyId = (formData.get('occupancy_id') as string)?.trim();
  const title       = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const category    = parseCategory(formData.get('category'));

  if (!occupancyId)             { failTo('Choose the homeowner and unit this request is for'); return; }
  if (!title)                   { failTo('Please give the request a short title'); return; }
  if (!description)             { failTo('Please describe the modification'); return; }
  if (description.length < 10)  { failTo('Please give at least a sentence describing the work'); return; }

  const supabase = await createClient();

  // Resolve owner + unit + association from the occupancy row (RLS-scoped).
  const { data: occ, error: occErr } = await (supabase as any)
    .from('occupancies')
    .select('id, unit_id, owner_id, association_id, status, occupancy_type, move_out_date, associations!occupancies_association_id_fkey(portfolio_id)')
    .eq('id', occupancyId)
    .maybeSingle();
  if (occErr || !occ) { failTo('That homeowner/unit was not found or is outside your portfolio'); return; }
  if (!occ.owner_id)  { failTo('That unit has no owner on file — link an owner first'); return; }
  // Only the unit's current owner can have a request filed for them.
  if (!isCurrentOwnerOccupancy(occ, todayInZone())) {
    failTo('That homeowner no longer owns this unit. Choose the current owner.');
    return;
  }

  const { data: req, error } = await (supabase as any).from('architectural_requests').insert({
    association_id: occ.association_id,
    portfolio_id:   (occ.associations as any)?.portfolio_id ?? null,
    unit_id:        occ.unit_id,
    owner_id:       occ.owner_id,          // the homeowner the request belongs to
    submitted_by:   me.auth_user_id,       // the staffer who keyed it in
    title,
    description,
    category,
    status:         'submitted',
  }).select('id').single();

  if (error || !req) { failTo(error?.message ?? 'Failed to submit request'); return; }

  revalidatePath('/architectural-reviews');
  redirect(`/architectural-reviews/${req.id}`);
}

// Documents live in the association records bucket. Files go browser→storage
// via signed URLs (Vercel caps server-action bodies at ~4.5 MB), so large plan
// sets are fine. Cap of 10 documents per request.
const ATTACH_BUCKET = 'association-documents';
const MAX_ARCH_ATTACHMENTS = 10;
const OPEN_STATUSES: readonly string[] = ARC_OPEN_STATUSES;

type ArchAttachmentRequest = {
  id: string;
  association_id: string;
  owner_id: string | null;
  status: string;
  attachments: unknown;
};

function requestBackPath(basePath: string, requestId: string): string | null {
  const allowedBase = architecturalAttachmentBasePath(basePath);
  return allowedBase && isCanonicalUuid(requestId) ? `${allowedBase}/${requestId}` : null;
}

async function removeStoredAttachment(svc: any, path: string) {
  try { await svc.storage.from(ATTACH_BUCKET).remove([path]); } catch {}
}

/**
 * Prove access with the caller's RLS client first. A global staff/board flag is
 * never sufficient: staff must also pass can_access_association for this row,
 * and board users must hold a seat for this exact association.
 */
async function verifyArchAttachmentAccess(requestId: string, basePath: string) {
  const me = await getMe();
  if (!me.auth_user_id) {
    return { error: 'Not signed in', req: null as ArchAttachmentRequest | null, svc: null as any, me, role: null };
  }
  if (!isCanonicalUuid(requestId)) {
    return { error: 'Invalid request reference', req: null as ArchAttachmentRequest | null, svc: null as any, me, role: null };
  }

  const session = await createClient();
  const { data, error: requestError } = await (session as any)
    .from('architectural_requests')
    .select('id, association_id, owner_id, status, attachments')
    .eq('id', requestId)
    .maybeSingle();
  const req = data as ArchAttachmentRequest | null;
  if (requestError || !req) {
    return { error: 'Request not found or you do not have access', req: null, svc: null as any, me, role: null };
  }

  const safeBasePath = architecturalAttachmentBasePath(basePath);
  if (!safeBasePath) {
    return { error: 'Invalid action surface', req: null as ArchAttachmentRequest | null, svc: null as any, me, role: null };
  }

  let ownerPortalActive = false;
  // The request's own owner record, which must be one of this login's.
  if (safeBasePath === '/portal/architectural' && req.owner_id && me.owner_ids.includes(req.owner_id)) {
    const { data: owner, error: ownerError } = await (session as any)
      .from('owners')
      .select('id, portal_activated')
      .eq('id', req.owner_id)
      .maybeSingle();
    ownerPortalActive = !ownerError && owner?.portal_activated === true;
  }

  let staffCanAccessAssociation = false;
  if (safeBasePath === '/architectural-reviews' && !me.is_platform_operator && (me.is_staff || me.is_company_admin)) {
    // can_manage_association also honours association-scoped managers
    // (can_access_association alone only checks the company).
    const { data: canAccess, error: accessError } = await (session as any)
      .rpc('can_manage_association', { p_association_id: req.association_id });
    staffCanAccessAssociation = !accessError && canAccess === true;
  }
  const role = architecturalSurfaceAccessRole({
    basePath: safeBasePath,
    me,
    request: req,
    ownerPortalActive,
    staffCanAccessAssociation,
  });
  if (!role) {
    return { error: 'Request not found or you do not have access', req: null, svc: null as any, me, role: null };
  }

  // Construct the bypass client only after tenant access has been proven.
  const svc = createServiceClient() as any;
  return { error: null as string | null, req, svc, me, role };
}

/**
 * Direct-to-storage upload flow. Vercel caps request bodies at ~4.5 MB, so
 * files must NOT travel through server actions. The client asks for a signed
 * upload URL (small JSON), sends the file browser→Supabase Storage, then
 * records the attachment. Both steps re-verify ownership and open status.
 */
export async function createArchAttachmentUpload(
  requestId: string,
  basePath: string,
  fileName: string,
  fileSize: number,
): Promise<{ error?: string; path?: string; token?: string }> {
  const { error, req, svc } = await verifyArchAttachmentAccess(requestId, basePath);
  if (error || !req) return { error: error ?? 'Request not found' };
  if (!OPEN_STATUSES.includes(req.status)) return { error: 'Documents can only be added while the request is open' };
  const validatedFile = validateArchitecturalAttachmentFile(fileName, fileSize);
  if (validatedFile.error || !validatedFile.safeName) return { error: validatedFile.error ?? 'Invalid document' };
  const existing = Array.isArray(req.attachments) ? req.attachments : [];
  if (existing.length >= MAX_ARCH_ATTACHMENTS) return { error: `Limit of ${MAX_ARCH_ATTACHMENTS} documents reached` };

  const path = `architectural/${requestId}/${randomUUID()}-${validatedFile.safeName}`;
  const { data, error: signErr } = await svc.storage.from(ATTACH_BUCKET).createSignedUploadUrl(path);
  if (signErr || !data?.token) return { error: signErr?.message ?? 'Could not authorize the upload' };
  return { path, token: data.token };
}

export async function recordArchAttachment(
  requestId: string,
  basePath: string,
  file: { path: string; name: string; size: number },
): Promise<{ error?: string; ok?: boolean }> {
  const access = await verifyArchAttachmentAccess(requestId, basePath);
  if (access.error || !access.req) return { error: access.error ?? 'Request not found' };
  const { req, svc, me } = access as any;
  const safeBasePath = architecturalAttachmentBasePath(basePath);
  if (!safeBasePath) return { error: 'Invalid return path' };
  if (!OPEN_STATUSES.includes(req.status)) return { error: 'Documents can only be added while the request is open' };

  const validatedFile = validateArchitecturalAttachmentFile(file.name, file.size);
  if (validatedFile.error || !validatedFile.safeName) {
    if (isArchitecturalAttachmentPath(requestId, file.path)) await removeStoredAttachment(svc, file.path);
    return { error: validatedFile.error ?? 'Invalid document' };
  }
  // Only accept a single object in this request's directory whose server-issued
  // name matches the recorded display name.
  if (!isArchitecturalAttachmentPath(requestId, file.path, validatedFile.safeName)) {
    return { error: 'Invalid document reference' };
  }

  const { data: stored, error: infoError } = await svc.storage.from(ATTACH_BUCKET).info(file.path);
  const storedSize = Number(stored?.size);
  if (infoError || !Number.isSafeInteger(storedSize) || storedSize <= 0) {
    return { error: 'Uploaded document could not be verified' };
  }
  if (storedSize !== file.size || storedSize > MAX_ARCHITECTURAL_ATTACHMENT_BYTES) {
    await removeStoredAttachment(svc, file.path);
    return { error: 'Uploaded document size does not match the authorized file' };
  }

  // Appended in one locked statement, so two uploads at once can't drop
  // each other's document (arc_append_attachment rechecks open + the cap).
  const { data: outcome, error } = await svc.rpc('arc_append_attachment', {
    p_request_id: req.id,
    p_association_id: req.association_id,
    p_attachment: {
      name: file.name,
      path: file.path,
      size: file.size,
      uploaded_at: new Date().toISOString(),
      uploaded_by: me.auth_user_id,
      uploaded_by_name: me.profile?.full_name ?? me.email ?? null,
    },
    p_max: MAX_ARCH_ATTACHMENTS,
  });
  if (error || (outcome !== 'added' && outcome !== 'exists')) {
    await removeStoredAttachment(svc, file.path);
    return { error: error?.message ?? 'Request changed before the document could be recorded' };
  }
  revalidatePath(`${safeBasePath}/${requestId}`);
  return { ok: true };
}

/** Remove a previously uploaded document while the request is open (owner or staff). */
export async function removeArchitecturalAttachment(
  requestId: string,
  basePath: string,
  formData: FormData,
) {
  const me = await getMe();
  if (!me.auth_user_id) { redirect('/login'); return; }
  const back = requestBackPath(basePath, requestId);
  if (!back) { redirect('/?error=' + encodeURIComponent('Invalid return path')); return; }
  const failTo = (msg: string) => redirect(`${back}?error=${encodeURIComponent(msg)}`);

  const path = formData.get('path') as string;
  if (!path) { failTo('Missing document reference'); return; }

  const access = await verifyArchAttachmentAccess(requestId, basePath);
  if (access.error || !access.req || !access.role) { failTo(access.error ?? 'Request not found'); return; }
  const { req, svc } = access;
  // Documents are part of the record: nobody changes them once decided.
  if (!OPEN_STATUSES.includes(req.status)) {
    failTo('Documents can no longer be changed on a decided request');
    return;
  }
  if (!isArchitecturalAttachmentPath(requestId, path)) { failTo('Invalid document reference'); return; }

  // Removed in one locked statement (the database refuses a decided request).
  const { data: removed, error } = await svc.rpc('arc_remove_attachment', {
    p_request_id: req.id,
    p_association_id: req.association_id,
    p_path: path,
  });
  if (error) { failTo(error.message); return; }
  if (removed !== true) { failTo('Document not found on this request'); return; }
  await removeStoredAttachment(svc, path);
  revalidatePath(back);
}

/** Owner withdraws their own open request. RLS enforces ownership + status. */
export async function withdrawArchitecturalRequest(requestId: string) {
  const me = await requireOwner();
  const supabase = await createClient();
  const { data: updated, error } = await (supabase as any)
    .from('architectural_requests')
    .update({ status: 'withdrawn' })
    .eq('id', requestId)
    .in('owner_id', me.owner_ids)
    .in('status', OPEN_STATUSES)
    .select('id')
    .maybeSingle();
  if (error || !updated) {
    redirect(`/portal/architectural/${requestId}?error=${encodeURIComponent(error?.message ?? 'Request not found, not accessible, or no longer open')}`);
    return;
  }
  revalidatePath(`/portal/architectural/${requestId}`);
  revalidatePath('/portal/architectural');
}

/**
 * Post a message to a request's discussion thread, from the owner portal or
 * the staff workspace (the board portal is read-only). The basePath decides
 * where to return and which sign-in is required; the database stamps the
 * author (arch_msg_set_author), so a caller can't post as someone else.
 */
export async function postArchitecturalMessage(
  requestId: string,
  _claimedAuthorRole: 'owner' | 'staff',
  basePath: string,
  formData: FormData,
) {
  const context = basePath === '/portal/architectural'
    ? { me: await requireOwner(), authorRole: 'owner' as const }
    : basePath === '/architectural-reviews'
      ? { me: await requireStaff(), authorRole: 'staff' as const }
      : null;
  if (!context) { redirect('/?error=' + encodeURIComponent('Invalid architectural return path')); return; }
  const { me, authorRole } = context;
  const body = (formData.get('body') as string)?.trim();
  if (!isCanonicalUuid(requestId)) { redirect(`${basePath}?error=${encodeURIComponent('Request not found')}`); return; }
  const back = `${basePath}/${requestId}`;
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

/** Staff record a decision (approve / deny / request more info / under review). */
export async function decideArchitecturalRequest(
  requestId: string,
  basePath: string,
  formData: FormData,
) {
  if (basePath !== '/architectural-reviews') {
    redirect('/?error=' + encodeURIComponent('Invalid architectural decision path'));
    return;
  }
  const me = await requireStaff();
  if (!me.auth_user_id) { redirect('/login'); return; }
  // Decisions are a staff power — an owner must never decide their own request.
  if (!me.is_staff && !me.is_company_admin && !me.is_platform_operator) {
    redirect(`${basePath}/${requestId}?error=${encodeURIComponent('Only staff can record decisions.')}`);
    return;
  }
  if (!isCanonicalUuid(requestId)) { redirect(`${basePath}?error=${encodeURIComponent('Request not found')}`); return; }

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
  const inputError = decisionInputError(decision, notes);
  if (inputError) { redirect(`${back}?error=${encodeURIComponent(inputError)}`); return; }

  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'approved' || status === 'denied') {
    patch.decided_by = me.auth_user_id;
    patch.decided_at = new Date().toISOString();
    patch.decision_notes = notes;
  } else if (notes) {
    patch.decision_notes = notes;
  }

  // Only an open request can be decided (the database also refuses changes
  // to a decided one).
  const { data: updated, error } = await (supabase as any)
    .from('architectural_requests')
    .update(patch)
    .eq('id', requestId)
    .in('status', OPEN_STATUSES)
    .select('id');
  if (error) { redirect(`${back}?error=${encodeURIComponent(error.message)}`); return; }
  if (!updated || updated.length === 0) {
    redirect(`${back}?error=${encodeURIComponent('This request is no longer open, or you do not have access to it.')}`);
    return;
  }

  // Tell the homeowner (never fails the decision); say only what happened.
  const emailed = status !== 'under_review'
    ? await notifyOwnerOfStatusChange({ kind: 'architectural_request', id: requestId, newStatus: status, message: notes })
    : false;
  revalidatePath(back);
  revalidatePath(basePath);
  if (emailed) redirect(`${back}?decided=${status}&emailed=1`);
  redirect(`${back}?decided=${status}`);
}
