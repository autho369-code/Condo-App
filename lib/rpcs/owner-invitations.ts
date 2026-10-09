'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { queueOwnerPortalInvitation } from '@/lib/auth/owner-invitation';
import { claimSubmission, releaseSubmission } from '@/lib/forms/submission';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_PER_SEND = 200;
const BATCH = 100;

function backTo(formData: FormData) {
  const raw = String(formData.get('return_to') ?? '/owners/activations');
  return raw.startsWith('/owners/activations') ? raw : '/owners/activations';
}

function withParams(path: string, params: Record<string, string>) {
  const url = new URL(path, 'http://x');
  for (const k of ['error', 'sent', 'skipped', 'failed', 'remaining']) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

/**
 * Send (or resend) owner portal invitations to the selected owners. Each owner
 * must be in the staffer's company and visible to them (RLS); owners already
 * active, with an account, or without a valid email are skipped. A resend
 * revokes the owner's older pending invitation so only the newest link works.
 */
export async function sendOwnerPortalInvitations(formData: FormData) {
  const me = await requireStaff();
  const back = backTo(formData);
  const fail = (message: string): never => redirect(withParams(back, { error: message }));
  const portfolioId = me.portfolio?.id;
  if (!portfolioId) fail('Sign in to a company to send invitations.');

  const ids = [...new Set(formData.getAll('owner_id').map(String).filter((id) => UUID.test(id)))];
  if (ids.length === 0) fail('Select at least one owner.');
  // A large selection is sent in batches: this send takes the first
  // MAX_PER_SEND, and the page reports how many are left for the next one.
  const remaining = Math.max(0, ids.length - MAX_PER_SEND);
  ids.splice(MAX_PER_SEND);

  const db = (await createClient()) as any;
  // One-time token: a double click or a re-sent form sends once.
  const claim = await claimSubmission(db, formData, 'owner_portal_invites');
  if (claim.status === 'duplicate') redirect(withParams(back, { error: 'These invitations were already sent.' }));
  if (claim.status === 'error') fail(claim.message);

  // RLS limits this to owners the staffer can see.
  const owners: any[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const { data, error } = await db.from('owners')
      .select('id, full_name, email, portfolio_id, association_id, portal_activated, auth_user_id, archived_at')
      .in('id', ids.slice(i, i + BATCH));
    if (error) {
      if (claim.status === 'claimed') await releaseSubmission(db, claim.token);
      fail(error.message);
    }
    owners.push(...(data ?? []));
  }

  const svc = createServiceClient() as any;
  let sent = 0;
  let skipped = ids.length - owners.length;
  const failures: string[] = [];
  for (const o of owners) {
    const email = String(o.email ?? '').trim().toLowerCase();
    if (o.archived_at || o.portfolio_id !== portfolioId || o.portal_activated || o.auth_user_id || !EMAIL.test(email)) {
      skipped += 1;
      continue;
    }
    // Create and email the new link first; only once it is on its way are the
    // owner's older pending links revoked, so a failed resend never leaves the
    // owner without a working link.
    const result = await queueOwnerPortalInvitation(svc, {
      email,
      fullName: o.full_name ?? email,
      portfolioId,
      invitedBy: me.auth_user_id,
      ownerId: o.id,
      associationId: o.association_id ?? null,
    });
    if (result.error || !result.invitationId) {
      failures.push(`${o.full_name ?? email}: ${result.error ?? 'Could not create the invitation'}`);
      continue;
    }
    sent += 1;
    const { error: revokeError } = await svc.from('user_invitations')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('portfolio_id', portfolioId)
      .eq('hoa_role', 'owner')
      .eq('status', 'pending')
      .eq('email', email)
      // Only this record's older links (and older ones naming no record): the
      // same person's invitations for their other associations stay live.
      .or(`metadata->>owner_id.eq.${o.id},metadata->>owner_id.is.null`)
      .neq('id', result.invitationId);
    if (revokeError) failures.push(`${o.full_name ?? email}: new link sent, but an older link could not be cancelled (${revokeError.message})`);
  }

  revalidatePath('/owners/activations');
  redirect(withParams(back, {
    sent: String(sent),
    skipped: skipped ? String(skipped) : '',
    remaining: remaining ? String(remaining) : '',
    failed: failures.length ? failures.slice(0, 5).join('; ') + (failures.length > 5 ? ` (+${failures.length - 5} more)` : '') : '',
  }));
}
