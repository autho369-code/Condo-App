'use server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { normalizeLoginMode, safeInternalNext } from '@/lib/auth/login-modes';

export async function loginWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const mode = normalizeLoginMode(formData.get('mode'));
  const next = safeInternalNext(formData.get('next'));

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?mode=${mode}&error=${encodeURIComponent(error.message)}`);

  // Get the user's ID directly from the auth session
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Check platform_operators using service client (bypasses RLS)
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: opCheck } = await (adminClient as any)
      .from('platform_operators')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .limit(1);
    
    if (opCheck && opCheck.length > 0) {
      revalidatePath('/', 'layout');
      redirect('/platform');
    }
  }
  
  // Fall back to me() RPC for role routing
  const { data: me } = await (supabase as any).rpc('me');
  
  let destination = next;
  if (!destination) {
    if (me?.is_staff) {
      destination = '/dashboard';
    } else {
      destination = '/portal';
    }
  }

  revalidatePath('/', 'layout');
  redirect(destination);
}

export async function signupWithPassword(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  // Use admin API to create user with email pre-confirmed
  // This avoids Supabase's free-tier email rate limit (4/hour)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // If user already exists, fall back to regular signUp
    if (error.message.includes('already') || error.status === 422) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_PORTAL_URL}/api/auth/callback` },
      });
      if (signUpError) return { error: signUpError.message };
      return { success: 'Account exists. Check your email for the confirmation link.' };
    }
    return { error: error.message };
  }

  // Auto sign in the new user
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: signInError.message };

  // Send welcome email through our reliable Resend pipeline
  await (supabase as any).from('email_queue').insert({
    to_email: email,
    to_name: email.split('@')[0],
    subject: 'Welcome to Portier',
    body: `<p>Your account has been created and is ready to use.</p><p><a href="${process.env.NEXT_PUBLIC_PORTAL_URL}/portal">Go to portal</a></p>`,
    from_address: 'noreply@portier369.com',
    from_name: 'Portier',
    status: 'pending',
  });

  return { success: 'Account created! Redirecting...', userId: data.user?.id };
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
