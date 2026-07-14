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

  const me = await getMe();
  if (!me.auth_user_id) { redirect('/login'); return; }
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
    .select('id, unit_id, owner_id, association_id, status, associations!occupancies_association_id_fkey(portfolio_id)')
    .eq('id', occupancyId)
    .maybeSingle();
  if (occErr || !occ) { failTo('That homeowner/unit was not found or is outside your portfolio'); return; }
  if (!occ.owner_id)  { failTo('That unit has no owner on file — link an owner first'); return; }

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

// Documents live in the association records bucket. Each document uploads in
// its own request (one file per submit, 10 MB cap) so large plan sets don't
// overload a single multipart POST. Cap of 10 documents per request.
const ATTACH_BUCKET = 'association-documents';
const MAX_ARCH_ATTACHMENTS = 10;
// Files go browser→storage via signed URLs (Vercel caps server-action bodies
// at ~4.5 MB), so large plan sets are fine.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const OPEN_STATUSES = ['submitted', 'under_review', 'more_info'];

/**
 * Attach one document (plans, drawings, quotes, photos) to a request.
 * Writes go through the service client after an explicit ownership/staff
 * check — residents have no UPDATE grant on attachments under RLS.
 */
export async function addArchitecturalAttachment(
  requestId: string,
  basePath: string,
  formData: FormData,
) {
  const me = await getMe();
  const back = `${basePath}/${requestId}`;
  const failTo = (msg: string) => redirect(`${back}?error=${encodeURIComponent(msg)}`);
  if (!me.auth_user_id) { redirect('/login'); return; }

  const { createServiceClient } = await import('@/lib/supabase/server');
  const svc = createServiceClient() as any;
  const { data: req } = await svc
    .from('architectural_requests')
    .select('id, owner_id, status, attachments')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) { failTo('Request not found'); return; }

  const isOwner = !!me.owner_id && me.owner_id === req.owner_id;
  const isStaff = me.is_staff || me.is_platform_operator;
  if (!isOwner && !isStaff) { failTo('Only the requesting owner or staff can add documents'); return; }
  if (!OPEN_STATUSES.includes(req.status)) { failTo('Documents can only be added while the request is open'); return; }

  const file = formData.get('document') as File | null;
  if (!file || file.size === 0) { failTo('Choose a document to upload'); return; }
  if (file.size > MAX_ATTACHMENT_BYTES) { failTo('Each document must be under 10 MB. Upload files one at a time.'); return; }

  const existing = Array.isArray(req.attachments) ? req.attachments : [];
  if (existing.length >= MAX_ARCH_ATTACHMENTS) { failTo(`This request already has ${MAX_ARCH_ATTACHMENTS} documents — remove one first.`); return; }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `architectural/${requestId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await svc.storage.from(ATTACH_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (upErr) { failTo(`Upload failed: ${upErr.message}`); return; }

  const { error } = await svc
    .from('architectural_requests')
    .update({
      attachments: [
        ...existing,
        {
          name: file.name,
          path,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          uploaded_by: me.auth_user_id,
          uploaded_by_name: me.profile?.full_name ?? me.email ?? null,
        },
      ],
    })
    .eq('id', requestId);
  if (error) { failTo(error.message); return; }
  revalidatePath(back);
}

/**
 * Direct-to-storage upload flow. Vercel caps request bodies at ~4.5 MB, so
 * files must NOT travel through server actions. The client asks for a signed
 * upload URL (small JSON), sends the file browser→Supabase Storage, then
 * records the attachment. Both steps re-verify ownership and open status.
 */
async function verifyArchAttachmentAccess(requestId: string) {
  const me = await getMe();
  if (!me.auth_user_id) return { error: 'Not signed in', req: null as any, svc: null as any };
  const { createServiceClient } = await import('@/lib/supabase/server');
  const svc = createServiceClient() as any;
  const { data: req } = await svc
    .from('architectural_requests')
    .select('id, owner_id, status, attachments')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return { error: 'Request not found', req: null, svc };
  const isOwner = !!me.owner_id && me.owner_id === req.owner_id;
  const isStaff = me.is_staff || me.is_platform_operator;
  if (!isOwner && !isStaff) return { error: 'Only the requesting owner or staff can add documents', req: null, svc };
  if (!OPEN_STATUSES.includes(req.status)) return { error: 'Documents can only be added while the request is open', req: null, svc };
  return { error: null as string | null, req, svc, me };
}

export async function createArchAttachmentUpload(
  requestId: string,
  fileName: string,
  fileSize: number,
): Promise<{ error?: string; path?: string; token?: string }> {
  const { error, req, svc } = await verifyArchAttachmentAccess(requestId);
  if (error) return { error };
  if (!fileName) return { error: 'Missing file name' };
  if (!fileSize || fileSize <= 0) return { error: 'Empty file' };
  if (fileSize > MAX_ATTACHMENT_BYTES) return { error: `"${fileName}" is over ${Math.round(MAX_ATTACHMENT_BYTES / 1048576)} MB` };
  const existing = Array.isArray(req.attachments) ? req.attachments : [];
  if (existing.length >= MAX_ARCH_ATTACHMENTS) return { error: `Limit of ${MAX_ARCH_ATTACHMENTS} documents reached` };

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `architectural/${requestId}/${Date.now()}-${safeName}`;
  const { data, error: signErr } = await svc.storage.from(ATTACH_BUCKET).createSignedUploadUrl(path);
  if (signErr || !data?.token) return { error: signErr?.message ?? 'Could not authorize the upload' };
  return { path, token: data.token };
}

export async function recordArchAttachment(
  requestId: string,
  basePath: string,
  file: { path: string; name: string; size: number },
): Promise<{ error?: string; ok?: boolean }> {
  const access = await verifyArchAttachmentAccess(requestId);
  if (access.error) return { error: access.error };
  const { req, svc, me } = access as any;
  // Only accept paths this flow issued for this request
  if (!file.path?.startsWith(`architectural/${requestId}/`)) return { error: 'Invalid document reference' };

  const existing = Array.isArray(req.attachments) ? req.attachments : [];
  if (existing.some((a: any) => a?.path === file.path)) return { ok: true };
  if (existing.length >= MAX_ARCH_ATTACHMENTS) return { error: `Limit of ${MAX_ARCH_ATTACHMENTS} documents reached` };

  const { error } = await svc
    .from('architectural_requests')
    .update({
      attachments: [
        ...existing,
        {
          name: file.name,
          path: file.path,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          uploaded_by: me.auth_user_id,
          uploaded_by_name: me.profile?.full_name ?? me.email ?? null,
        },
      ],
    })
    .eq('id', requestId);
  if (error) return { error: error.message };
  revalidatePath(`${basePath}/${requestId}`);
  return { ok: true };
}

/** Remove a previously uploaded document (owner while open, or staff). */
export async function removeArchitecturalAttachment(
  requestId: string,
  basePath: string,
  formData: FormData,
) {
  const me = await getMe();
  const back = `${basePath}/${requestId}`;
  const failTo = (msg: string) => redirect(`${back}?error=${encodeURIComponent(msg)}`);
  if (!me.auth_user_id) { redirect('/login'); return; }

  const path = formData.get('path') as string;
  if (!path) { failTo('Missing document reference'); return; }

  const { createServiceClient } = await import('@/lib/supabase/server');
  const svc = createServiceClient() as any;
  const { data: req } = await svc
    .from('architectural_requests')
    .select('id, owner_id, status, attachments')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) { failTo('Request not found'); return; }

  const isOwner = !!me.owner_id && me.owner_id === req.owner_id;
  const isStaff = me.is_staff || me.is_platform_operator;
  if (!isOwner && !isStaff) { failTo('Only the requesting owner or staff can remove documents'); return; }
  if (isOwner && !isStaff && !OPEN_STATUSES.includes(req.status)) { failTo('Documents can no longer be changed on a decided request'); return; }

  const existing = Array.isArray(req.attachments) ? req.attachments : [];
  if (!existing.some((a: any) => a?.path === path)) { failTo('Document not found on this request'); return; }

  const { error } = await svc
    .from('architectural_requests')
    .update({ attachments: existing.filter((a: any) => a?.path !== path) })
    .eq('id', requestId);
  if (error) { failTo(error.message); return; }
  try { await svc.storage.from(ATTACH_BUCKET).remove([path]); } catch {}
  revalidatePath(back);
}

/** Owner withdraws their own open request. RLS enforces ownership + status. */
export async function withdrawArchitecturalRequest(requestId: string) {
  await (await import('@/lib/auth/me')).requireAuth();  // in-action guard; RLS enforces ownership
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
  // Never trust the caller-supplied role label — derive it from the session
  // so a resident cannot post as "staff"/"board".
  authorRole = (me.is_staff || me.is_platform_operator) ? 'staff' : me.is_board ? 'board' : 'owner';
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
  // Decisions are a staff/board power — an owner must never decide their own request.
  if (!me.is_staff && !me.is_board && !me.is_platform_operator) {
    redirect(`${basePath}/${requestId}?error=${encodeURIComponent('Only staff or board members can record decisions.')}`);
    return;
  }

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
