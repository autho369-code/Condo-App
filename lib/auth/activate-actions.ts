'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function activateInvitation(formData: FormData) {
  const supabase = await createClient();
  const token = (formData.get('token') as string)?.trim();
  const password = (formData.get('password') as string)?.trim();
  const confirm = (formData.get('confirm') as string)?.trim();

  if (!token || !password) {
    redirect(`/accept-invitation?token=${encodeURIComponent(token!)}&error=${encodeURIComponent('Password is required.')}`);
  }
  if (password !== confirm) {
    redirect(`/accept-invitation?token=${encodeURIComponent(token)}&error=${encodeURIComponent('Passwords do not match.')}`);
  }
  if (password.length < 12) {
    redirect(`/accept-invitation?token=${encodeURIComponent(token)}&error=${encodeURIComponent('Password must be at least 12 characters.')}`);
  }

  // Step 1: Look up the invitation to get the email
  const { data: invite, error: inviteError } = await (supabase as any)
    .from('user_invitations')
    .select('email, full_name, portfolio_id, hoa_role')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (inviteError || !invite) {
    redirect(`/accept-invitation?token=${encodeURIComponent(token)}&error=${encodeURIComponent('Invitation not found or already used.')}`);
  }

  // Step 2: Create the auth user with a server-side signup
  const { data: signupData, error: signupError } = await supabase.auth.admin.createUser({
    email: invite.email,
    password: password,
    email_confirm: true,
    user_metadata: { full_name: invite.full_name },
  });

  if (signupError) {
    const msg = signupError.message.includes('already') 
      ? 'An account with this email already exists. Please sign in instead.' 
      : signupError.message;
    redirect(`/accept-invitation?token=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`);
  }

  // Step 3: Sign in as the new user
  const { error: signinError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: password,
  });

  if (signinError) {
    redirect(`/accept-invitation?token=${encodeURIComponent(token)}&error=${encodeURIComponent('Account created but sign-in failed. Please try signing in.')}`);
  }

  // Step 4: Accept the invitation (now authenticated)
  const { error: acceptError } = await (supabase as any).rpc('accept_invitation', { p_token: token });
  if (acceptError) {
    redirect(`/accept-invitation?token=${encodeURIComponent(token)}&error=${encodeURIComponent(acceptError.message)}`);
  }

  revalidatePath('/', 'layout');
  redirect('/portal');
}
