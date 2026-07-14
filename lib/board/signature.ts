// Server-side helpers for board-member e-signatures.
//
// Board seats can be linked to a login two ways (see
// supabase/migrations/20260714010000_board_owner_dual_role_single_login.sql):
// by auth_user_id, or — for seats created after the user's login existed —
// by a case-insensitive email match while auth_user_id is still null.
// Both resolution paths are handled here so reads and writes agree.
//
// The service client is used because board_members has no verified self-access
// RLS policy in supabase/migrations/ — every caller MUST be identity-checked
// (getMe()/requireBoard()) before these helpers run, and every filter is
// scoped to that verified identity.
import { createServiceClient } from '@/lib/supabase/server';
import type { MeResult } from '@/lib/auth/me';

const BUCKET = 'association-documents';

export interface BoardSeatSignature {
  id: string;
  signature_url: string | null;
  signature_on_file: boolean;
}

/** Escape LIKE/ILIKE pattern characters so an email compares literally. */
function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

/**
 * The caller's own active board seats (auth_user_id match first, then
 * email-matched seats that have not been auto-linked yet).
 */
export async function findMyBoardSeats(me: Pick<MeResult, 'auth_user_id' | 'email'>): Promise<BoardSeatSignature[]> {
  const svc = createServiceClient() as any;
  const seats: BoardSeatSignature[] = [];

  if (me.auth_user_id) {
    const { data } = await svc
      .from('board_members')
      .select('id, signature_url, signature_on_file')
      .eq('active', true)
      .eq('auth_user_id', me.auth_user_id);
    seats.push(...((data ?? []) as BoardSeatSignature[]));
  }

  if (me.email) {
    const { data } = await svc
      .from('board_members')
      .select('id, signature_url, signature_on_file')
      .eq('active', true)
      .is('auth_user_id', null)
      .ilike('email', escapeLike(me.email));
    seats.push(...((data ?? []) as BoardSeatSignature[]));
  }

  return seats;
}

/**
 * Turn stored signature references into browser-viewable URLs.
 * Storage paths are signed (private bucket); absolute http(s) URLs pass through.
 * Returns a map of original reference → display URL.
 */
export async function signSignaturePaths(refs: Array<string | null | undefined>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const toSign: string[] = [];

  for (const ref of refs) {
    const r = ref?.trim();
    if (!r || out.has(r)) continue;
    if (/^https?:\/\//i.test(r)) out.set(r, r);
    else if (!toSign.includes(r)) toSign.push(r);
  }

  if (toSign.length > 0) {
    const svc = createServiceClient() as any;
    const { data: signed } = await svc.storage.from(BUCKET).createSignedUrls(toSign, 3600);
    for (const s of signed ?? []) {
      if (s?.path && s?.signedUrl) out.set(s.path, s.signedUrl);
    }
  }

  return out;
}
