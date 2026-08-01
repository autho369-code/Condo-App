'use server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getLoginModeConfig, normalizeLoginMode, safeInternalNext } from '@/lib/auth/login-modes';
import { getMe, roleHome } from '@/lib/auth/me';
import { siteUrl } from '@/lib/url/site-url';
import { tenantAccessDecision } from '@/lib/tenant/host';
import { tenantFromHeaders } from '@/lib/tenant/resolve';

export async function loginWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const mode = normalizeLoginMode(formData.get('mode'));

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?mode=${mode}&error=${encodeURIComponent(error.message)}`);

  // The system determines the destination from the account's ACTUAL role,
  // not the login tab that was clicked. An explicit ?next= (deep link) wins.
  const explicitNext = safeInternalNext(formData.get('next'));
  const me = await getMe();
  revalidatePath('/', 'layout');

  // Tenant identity comes from trusted headers injected by middleware, never
  // from a form field. A credential for Company A cannot establish a usable
  // session on Company B's branded hostname.
  const tenant = tenantFromHeaders(await headers());
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

  // Single source of truth for role precedence â€” the same roleHome() every
  // guard uses, so login never lands somewhere a guard would bounce from.
  const home = me ? roleHome(me) : '/login';
  if (home !== '/login') redirect(home);

  // Fallback to the tab's default if role couldn't be resolved
  redirect(getLoginModeConfig(mode).defaultNext);
}

export async function signupWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/api/auth/callback` },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect('/signup?notice=' + encodeURIComponent('Check your email for the confirmation link.'));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function acceptInvitation(token: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('accept_invitation', { p_token: token });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { success: true, result: data };
}

