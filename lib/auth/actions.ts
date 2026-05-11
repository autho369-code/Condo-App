'use server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { normalizeLoginMode, safeInternalNext } from '@/lib/auth/login-modes';

export async function loginWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const mode = normalizeLoginMode(formData.get('mode'));
  const next = safeInternalNext(formData.get('next')) ?? '/dashboard';

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?mode=${mode}&error=${encodeURIComponent(error.message)}`);

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signupWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_PORTAL_URL}/api/auth/callback` },
  });
  if (error) return { error: error.message };
  return { success: 'Check your email for the confirmation link.' };
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

/**
 * Send a password-reset email via Supabase. The redirect target is the
 * Next.js auth callback, which will land the user on /reset-password where
 * they can set a new credential.
 */
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  if (!email) {
    redirect('/forgot-password?error=' + encodeURIComponent('Please enter your email address.'));
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_PORTAL_URL ?? ''}/api/auth/callback?next=/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // We always show "sent" to avoid leaking which emails are registered.
  if (error) {
    // Log silently; surface a friendly message all the same.
    console.warn('[requestPasswordReset]', error.message);
  }
  redirect('/forgot-password?sent=' + encodeURIComponent(email));
}

/**
 * Finalise a password reset. Requires the user to already have a valid
 * Supabase session (set during the callback redirect from the reset email).
 * Hardens against accidental brute-force by re-reading the user beforehand.
 */
export async function setNewPassword(formData: FormData) {
  const supabase = await createClient();
  const password = (formData.get('password') as string) ?? '';
  const confirm  = (formData.get('confirm') as string)  ?? '';

  if (password.length < 12) {
    redirect('/reset-password?error=' + encodeURIComponent('Password must be at least 12 characters.'));
  }
  if (password !== confirm) {
    redirect('/reset-password?error=' + encodeURIComponent('Passwords do not match. Please re-enter both fields.'));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?error=' + encodeURIComponent('Your reset link has expired. Please request a new one.'));
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect('/reset-password?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/', 'layout');
  redirect('/reset-password?done=1');
}

/**
 * Capture a sales lead from the public /request-access form. Writes to
 * `marketing_leads` (RLS allows anon insert) so the concierge can qualify
 * the lead from /platform/leads.
 *
 * Returns by redirect: ?ok=1 on success, ?error= on failure.
 */
export async function submitAccessRequest(formData: FormData) {
  const supabase = await createClient();

  // Trim + normalize the inputs
  const fields = {
    contact_name:     ((formData.get('contact_name')     as string) ?? '').trim(),
    contact_email:    ((formData.get('contact_email')    as string) ?? '').trim().toLowerCase(),
    contact_phone:    ((formData.get('contact_phone')    as string) ?? '').trim() || null,
    company_name:     ((formData.get('company_name')     as string) ?? '').trim(),
    portfolio_size:   ((formData.get('portfolio_size')   as string) ?? '').trim() || null,
    current_platform: ((formData.get('current_platform') as string) ?? '').trim() || null,
    message:          ((formData.get('message')          as string) ?? '').trim() || null,
    source_url:       ((formData.get('source_url')       as string) ?? '').trim() || null,
    utm_source:       ((formData.get('utm_source')       as string) ?? '').trim() || null,
    utm_medium:       ((formData.get('utm_medium')       as string) ?? '').trim() || null,
    utm_campaign:     ((formData.get('utm_campaign')     as string) ?? '').trim() || null,
  };

  if (!fields.contact_name || !fields.contact_email || !fields.company_name) {
    redirect('/request-access?error=' +
      encodeURIComponent('Please share your name, email, and management company.'));
  }
  // Light email shape check — server-side validation only catches the obvious
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contact_email)) {
    redirect('/request-access?error=' +
      encodeURIComponent('That email address looks incomplete. Please re-enter it.'));
  }

  const { error } = await (supabase as any).from('marketing_leads').insert(fields);
  if (error) {
    console.warn('[submitAccessRequest]', error.message);
    redirect('/request-access?error=' +
      encodeURIComponent('We couldn\'t record your request. Please email hello@portier369.com and we\'ll respond personally.'));
  }

  redirect('/request-access?ok=1');
}
