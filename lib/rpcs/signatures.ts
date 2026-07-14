'use server';

// Board-member e-signature capture. The signature PNG goes browser→Supabase
// Storage via a signed upload URL (same pattern as createInsuranceCertUpload —
// consistent with the Vercel body-cap rule even though signatures are tiny),
// then saveSignature records the path on the caller's OWN board seats.
// These actions return { error } for the client component to render — they are
// not <form action> posts.
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/auth/me';
import { findMyBoardSeats } from '@/lib/board/signature';

const BUCKET = 'association-documents';
const MAX_SIGNATURE_BYTES = 1024 * 1024; // a signature PNG should never exceed 1 MB

export async function createSignatureUpload(
  fileSize: number,
): Promise<{ error?: string; path?: string; token?: string }> {
  const me = await getMe();
  if (!me.auth_user_id || !me.is_board) return { error: 'Not signed in as a board member' };
  if (!fileSize || fileSize <= 0) return { error: 'Empty signature image' };
  if (fileSize > MAX_SIGNATURE_BYTES) return { error: 'Signature image must be under 1 MB' };

  const path = `signatures/${me.auth_user_id}/${Date.now()}.png`;
  const svc = createServiceClient() as any;
  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) return { error: error?.message ?? 'Could not authorize the upload' };
  return { path, token: data.token };
}

export async function saveSignature(path: string): Promise<{ error?: string; ok?: boolean }> {
  const me = await getMe();
  if (!me.auth_user_id || !me.is_board) return { error: 'Not signed in as a board member' };

  // The path must be one this caller was issued: scoped to their own auth uid.
  const cleaned = (path ?? '').trim();
  if (!cleaned.startsWith(`signatures/${me.auth_user_id}/`) || !cleaned.endsWith('.png') || cleaned.includes('..')) {
    return { error: 'Invalid signature reference.' };
  }

  // Resolve the caller's own active seats (verified identity), then update
  // exactly those rows. Service client is required: board_members has no
  // verified self-update RLS policy in supabase/migrations/.
  const seats = await findMyBoardSeats(me);
  if (seats.length === 0) return { error: 'No active board membership found for your login.' };

  const svc = createServiceClient() as any;
  const { error } = await svc
    .from('board_members')
    .update({ signature_url: cleaned, signature_on_file: true })
    .in('id', seats.map((s) => s.id));
  if (error) return { error: error.message };

  revalidatePath('/board');
  revalidatePath('/board/approvals');
  return { ok: true };
}
