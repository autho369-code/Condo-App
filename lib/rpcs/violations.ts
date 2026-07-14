'use server';
// Server actions for the mobile field-capture violation flow.
//
// Create path mirrors app/(app)/violations/new/page.tsx handleSubmit (same
// required fields/defaults: status 'open', date_observed today, created_by).
// Photo uploads mirror lib/rpcs/architectural.ts createArchAttachmentUpload /
// recordArchAttachment: files travel browser→storage via signed URLs (Vercel
// caps server-action bodies at ~4.5 MB), then a second action records them in
// violations.attachments as [{ name, path, size, uploaded_at, ... }].
import { createClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';

const ATTACH_BUCKET = 'association-documents';
const MAX_VIOLATION_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

// Keep in sync with the violation_type enum (lib/types/database.ts).
const VIOLATION_TYPES = [
  'noise', 'parking', 'pets', 'exterior_modification', 'trash_debris',
  'landscaping', 'common_area_misuse', 'lease_violation', 'assessment_delinquency', 'other',
] as const;

export type FieldViolationInput = {
  association_id: string;
  unit_id?: string | null;
  violation_type: string;
  title: string;
  description?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy_m?: number | null;
};

/**
 * Create a violation from the phone field-capture flow. Called
 * programmatically from a client component (not a plain <form action>), so it
 * returns { error } for inline rendering. Staff-only — re-checked in the
 * action body; the insert runs on the caller's own RLS-scoped client so a
 * staffer can only file into associations they actually manage.
 */
export async function createFieldViolation(
  input: FieldViolationInput,
): Promise<{ error?: string; id?: string }> {
  const me = await getMe();
  if (!me.auth_user_id) return { error: 'Not signed in' };
  if (!me.is_staff && !me.is_platform_operator) return { error: 'Only staff can file field violations' };

  const associationId = input.association_id?.trim();
  const title = input.title?.trim();
  if (!associationId) return { error: 'Select an association' };
  if (!title) return { error: 'Enter a short title' };
  const violationType = (VIOLATION_TYPES as readonly string[]).includes(input.violation_type)
    ? input.violation_type
    : 'other';

  const supabase = await createClient();
  const db = supabase as any;

  // If a unit was picked, confirm (RLS-scoped) it belongs to the selected
  // association — never trust the client-side pairing.
  const unitId = input.unit_id?.trim() || null;
  if (unitId) {
    const { data: unit, error: unitErr } = await db
      .from('units')
      .select('id, buildings!inner(association_id)')
      .eq('id', unitId)
      .maybeSingle();
    if (unitErr || !unit) return { error: 'Unit not found or outside your portfolio' };
    if ((unit.buildings as any)?.association_id !== associationId) {
      return { error: 'That unit does not belong to the selected association' };
    }
  }

  const lat = Number.isFinite(input.location_lat) ? input.location_lat : null;
  const lng = Number.isFinite(input.location_lng) ? input.location_lng : null;

  const { data: row, error } = await db
    .from('violations')
    .insert({
      association_id: associationId,
      unit_id: unitId,
      violation_type: violationType,
      title,
      description: input.description?.trim() || null,
      date_observed: new Date().toISOString().slice(0, 10),
      status: 'open',
      created_by: me.auth_user_id,
      location_lat: lat,
      location_lng: lng,
      location_accuracy_m: lat !== null && lng !== null && Number.isFinite(input.location_accuracy_m)
        ? input.location_accuracy_m
        : null,
    })
    .select('id')
    .single();

  if (error || !row) return { error: error?.message ?? 'Failed to create violation' };
  revalidatePath('/violations');
  return { id: row.id as string };
}

/**
 * Shared access check for violation photo actions. The violation is fetched
 * with the CALLER'S RLS-scoped client, so staff can only touch violations
 * inside their own portfolio; the service client is used afterwards only for
 * storage signing and the attachments write.
 */
async function verifyViolationAttachmentAccess(violationId: string) {
  const me = await getMe();
  if (!me.auth_user_id) return { error: 'Not signed in' as string | null, violation: null as any, me };
  if (!me.is_staff && !me.is_platform_operator) return { error: 'Only staff can add violation photos', violation: null, me };

  const supabase = await createClient();
  const { data: violation } = await (supabase as any)
    .from('violations')
    .select('id, attachments')
    .eq('id', violationId)
    .maybeSingle();
  if (!violation) return { error: 'Violation not found', violation: null, me };
  return { error: null as string | null, violation, me };
}

/** Issue a signed upload URL for one photo (browser→storage direct upload). */
export async function createViolationAttachmentUpload(
  violationId: string,
  fileName: string,
  fileSize: number,
): Promise<{ error?: string; path?: string; token?: string }> {
  const { error, violation } = await verifyViolationAttachmentAccess(violationId);
  if (error) return { error };
  if (!fileName) return { error: 'Missing file name' };
  if (!fileSize || fileSize <= 0) return { error: 'Empty file' };
  if (fileSize > MAX_ATTACHMENT_BYTES) return { error: `"${fileName}" is over ${Math.round(MAX_ATTACHMENT_BYTES / 1048576)} MB` };
  const existing = Array.isArray(violation.attachments) ? violation.attachments : [];
  if (existing.length >= MAX_VIOLATION_ATTACHMENTS) return { error: `Limit of ${MAX_VIOLATION_ATTACHMENTS} photos reached` };

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `violations/${violationId}/${Date.now()}-${safeName}`;
  const { createServiceClient } = await import('@/lib/supabase/server');
  const svc = createServiceClient() as any;
  const { data, error: signErr } = await svc.storage.from(ATTACH_BUCKET).createSignedUploadUrl(path);
  if (signErr || !data?.token) return { error: signErr?.message ?? 'Could not authorize the upload' };
  return { path, token: data.token };
}

/** Record an uploaded photo into violations.attachments. */
export async function recordViolationAttachment(
  violationId: string,
  file: { path: string; name: string; size: number },
): Promise<{ error?: string; ok?: boolean }> {
  const access = await verifyViolationAttachmentAccess(violationId);
  if (access.error) return { error: access.error };
  const { violation, me } = access as any;
  // Only accept paths this flow issued for this violation.
  if (!file.path?.startsWith(`violations/${violationId}/`)) return { error: 'Invalid photo reference' };

  const existing = Array.isArray(violation.attachments) ? violation.attachments : [];
  if (existing.some((a: any) => a?.path === file.path)) return { ok: true };
  if (existing.length >= MAX_VIOLATION_ATTACHMENTS) return { error: `Limit of ${MAX_VIOLATION_ATTACHMENTS} photos reached` };

  const { createServiceClient } = await import('@/lib/supabase/server');
  const svc = createServiceClient() as any;
  const { error } = await svc
    .from('violations')
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
    .eq('id', violationId);
  if (error) return { error: error.message };
  revalidatePath(`/violations/${violationId}`);
  return { ok: true };
}
