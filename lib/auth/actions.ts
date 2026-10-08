'use server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getLoginModeConfig, normalizeLoginMode, safeInternalNext } from '@/lib/auth/login-modes';
import { getMe, roleHome } from '@/lib/auth/me';
import { tenantAccessDecision } from '@/lib/tenant/host';
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { tokenMatchesAddress } from '@/lib/tenant/token-company';
import { clientAddress, consumePublicRateLimit, consumeScopedRateLimit } from '@/lib/server/rate-limit';

function loginFailureAuditCode(message: string | undefined) {
  const normalized = (message ?? '').toLowerCase();
  if (normalized.includes('email not confirmed')) return 'email_not_confirmed';
  if (normalized.includes('invalid login credentials')) return 'invalid_credentials';
  return 'sign_in_failed';
}

async function recordLoginAttempt(
  service: ReturnType<typeof createServiceClient>,
  details: {
    email: string;
    authUserId: string | null;
    success: boolean;
    requestHeaders: Headers;
    failureReason?: string | null;
  },
): Promise<boolean> {
  try {
    const { error } = await (service as any).rpc('record_login_attempt', {
      p_email: details.email,
      p_auth_user_id: details.authUserId,
      p_success: details.success,
      p_ip_address: clientAddress(details.requestHeaders),
      p_user_agent: details.requestHeaders.get('user-agent')?.slice(0, 512) ?? null,
      p_failure_reason: details.failureReason ?? null,
      p_mfa_used: false,
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Unable to record sign-in audit event:', error instanceof Error ? error.message : 'request failed');
    return false;
  }
}

export async function loginWithPassword(formData: FormData) {
  const supabase = await createClient();
  const service = createServiceClient();
  const requestHeaders = await headers();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const mode = normalizeLoginMode(formData.get('mode'));
  const sourceAddress = clientAddress(requestHeaders);

  const [sourceLimit, accountLimit] = await Promise.all([
    consumePublicRateLimit(service, requestHeaders, {
      scope: 'password_login_ip', windowSeconds: 900, maxRequests: 30,
    }),
    consumeScopedRateLimit(service, `${email || 'invalid'}:${sourceAddress}`, {
      scope: 'password_login_account_source', windowSeconds: 900, maxRequests: 10,
    }),
  ]);
  if (sourceLimit.unavailable || accountLimit.unavailable) {
    redirect(`/login?mode=${mode}&error=login_temporarily_unavailable`);
  }
  if (!sourceLimit.allowed || !accountLimit.allowed) {
    redirect(`/login?mode=${mode}&error=too_many_attempts`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const auditCode = loginFailureAuditCode(error.message);
    const audited = await recordLoginAttempt(service, {
      email,
      authUserId: null,
      success: false,
      requestHeaders,
      failureReason: auditCode,
    });
    if (!audited) redirect(`/login?mode=${mode}&error=login_temporarily_unavailable`);
    redirect(`/login?mode=${mode}&error=invalid_credentials`);
  }

  const audited = await recordLoginAttempt(service, {
    email,
    authUserId: data.user?.id ?? null,
    success: true,
    requestHeaders,
  });
  if (!audited) {
    await supabase.auth.signOut();
    redirect(`/login?mode=${mode}&error=login_temporarily_unavailable`);
  }

  // The system determines the destination from the account's ACTUAL role,
  // not the login tab that was clicked. An explicit ?next= (deep link) wins.
  const explicitNext = safeInternalNext(formData.get('next'));
  const me = await getMe({ enforceMfa: false, operatorActionRoles: ['admin', 'support', 'readonly'] });
  revalidatePath('/', 'layout');

  // Tenant identity comes from trusted headers injected by middleware, never
  // from a form field. A credential for Company A cannot establish a usable
  // session on Company B's branded hostname.
  const tenant = tenantFromHeaders(requestHeaders);
  if (tenant && me?.auth_user_id) {
    const decision = tenantAccessDecision(tenant.portfolioId, me);
    if (!decision.allowed) {
      await supabase.auth.signOut();
      const code = decision.reason === 'platform_operator_on_tenant'
        ? 'platform_workspace_only'
        : 'workspace_access_denied';
      redirect(`/login?mode=${mode}&error=${code}`);
    }
  }

  if (explicitNext) redirect(explicitNext);

  // Single source of truth for role precedence — the same roleHome() every
  // guard uses, so login never lands somewhere a guard would bounce from.
  const home = me ? roleHome(me) : '/login';
  if (home !== '/login') redirect(home);

  // Fallback to the tab's default if role couldn't be resolved
  redirect(getLoginModeConfig(mode).defaultNext);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/** Plain words for accept_invitation's refusals (raw RPC text otherwise). */
function acceptInvitationMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('expired')) return 'This invitation has expired. Ask for a new one.';
  if (m.includes('confirm your email')) return 'Confirm your email address first, then accept the invitation.';
  if (m.includes('tenant record')) return 'This resident invitation no longer matches an active tenancy. Ask your management company for a new one.';
  if (m.includes('email')) return 'This invitation was sent to a different email address. Sign in with that account.';
  if (m.includes('not found') || m.includes('already')) return 'This invitation has already been used or replaced.';
  return 'The invitation could not be accepted. Please try again or ask for a new invitation.';
}

/**
 * Accept an invitation as the signed-in user (form action — never on page
 * render: accepting changes the account's company and role). Fails loudly
 * back to the confirmation page.
 */
export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim();
  const back = (msg: string): never =>
    redirect(`/accept-invitation?token=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`);
  if (!token || token.length > 200) redirect('/login?error=link_invalid');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/invite?token=${encodeURIComponent(token)}`);
  // On a company's address only that company's invitations are accepted
  // (the platform address is allowed; see the page).
  const { data: invite } = await (createServiceClient() as any)
    .from('user_invitations').select('portfolio_id').eq('token', token).eq('status', 'pending').maybeSingle();
  if (!invite || !tokenMatchesAddress(await headers(), invite.portfolio_id)) {
    back('This invitation is not valid on this address. Open the link from your most recent invitation email.');
  }
  const limit = await consumeScopedRateLimit(createServiceClient() as any, token, { scope: 'invitation_accept_token', windowSeconds: 3600, maxRequests: 10 });
  if (!limit.allowed) back('Too many attempts. Please wait a while and try again.');
  const { error } = await (supabase as any).rpc('accept_invitation', { p_token: token });
  if (error) back(acceptInvitationMessage(error.message));
  revalidatePath('/', 'layout');
  const me = await getMe({ enforceMfa: false, operatorActionRoles: ['admin', 'support', 'readonly'] });
  redirect(roleHome(me));
}

