import { queueEmails } from '@/lib/email/queue';
import { tenantWorkspaceUrl } from '@/lib/tenant/host';

/** Queue an owner-controlled activation flow; staff never create a password. */
export async function queueOwnerPortalInvitation(db: any, input: {
  email: string;
  fullName: string;
  portfolioId: string;
  invitedBy: string | null;
}): Promise<{ error: string | null }> {
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const { data: invitation, error: inviteError } = await db
    .from('user_invitations')
    .insert({
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName,
      portfolio_id: input.portfolioId,
      hoa_role: 'owner',
      invited_by: input.invitedBy,
      expires_at: expiresAt,
      message: 'Activate your owner portal account.',
    })
    .select('id, token')
    .single();
  if (inviteError || !invitation?.token) return { error: inviteError?.message ?? 'Could not create portal invitation' };

  const { data: portfolio } = await db.from('portfolios')
    .select('slug')
    .eq('id', input.portfolioId)
    .maybeSingle();
  const inviteUrl = tenantWorkspaceUrl(
    portfolio?.slug,
    `/invite?token=${encodeURIComponent(invitation.token)}`,
  );
  const queued = await queueEmails(db, [{
    to: input.email,
    toName: input.fullName,
    subject: 'Activate your owner portal',
    text: [
      `Hello ${input.fullName},`,
      '',
      'Use this private invitation link to verify your email and choose your own password:',
      inviteUrl,
      '',
      'This link expires in 30 days. If you did not expect it, contact your management office.',
    ].join('\n'),
    portfolioId: input.portfolioId,
    sentBy: input.invitedBy,
  }]);
  if (queued.error || queued.count !== 1) {
    await db.from('user_invitations').update({ status: 'revoked' }).eq('id', invitation.id);
    return { error: queued.error ?? 'Could not queue portal invitation' };
  }
  return { error: null };
}
