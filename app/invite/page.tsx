import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

async function acceptInvite(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const token = formData.get('token') as string;
  const password = formData.get('password') as string;

  if (!token || !password) redirect(`/invite?token=${token}&error=${encodeURIComponent('Token and password required.')}`);
  if (password.length < 8) redirect(`/invite?token=${token}&error=${encodeURIComponent('Password must be at least 8 characters.')}`);

  // Get invitation details
  const { data: invite } = await (supabase as any)
    .from('user_invitations')
    .select('email, portfolio_id, hoa_role, expires_at, accepted_at')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (!invite) redirect(`/invite?token=${token}&error=${encodeURIComponent('Invitation not found or already used.')}`);
  if (new Date(invite.expires_at) < new Date()) redirect(`/invite?token=${token}&error=${encodeURIComponent('Invitation has expired.')}`);

  // Create auth user via admin API
  const adminClient = await createClient();
  const { data: authUser, error: createErr } = await (adminClient as any).auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { role: invite.hoa_role, portfolio_id: invite.portfolio_id },
  });

  if (createErr) redirect(`/invite?token=${token}&error=${encodeURIComponent(createErr.message)}`);

  // Sign them in
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (signInErr) redirect(`/invite?token=${token}&error=${encodeURIComponent(signInErr.message)}`);

  // Accept the invitation to link profile to portfolio
  const { error: acceptErr } = await (supabase as any).rpc('accept_invitation', { p_token: token });
  if (acceptErr) {
    console.error('accept_invitation error:', acceptErr);
    // User is still created and signed in — redirect to dashboard
  }

  redirect('/dashboard');
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Invalid invitation</h1>
          <p className="mt-2 text-sm text-gray-500">No invitation token provided. Please use the link from your invitation email.</p>
        </div>
      </div>
    );
  }

  // Validate the token exists and hasn't expired
  const supabase = await createClient();
  const { data: invite } = await (supabase as any)
    .from('user_invitations')
    .select('email, portfolio_id, hoa_role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.accepted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900">
            {invite?.accepted_at ? 'Invitation already accepted' : 'Invitation not found'}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {invite?.accepted_at ? 'This invitation has already been used. Please sign in.' : 'This invitation link is invalid or has expired.'}
          </p>
          <a href="/login" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">Go to sign in</a>
        </div>
      </div>
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Invitation expired</h1>
          <p className="mt-2 text-sm text-gray-500">This invitation expired on {new Date(invite.expires_at).toLocaleDateString()}. Please contact your platform administrator for a new invitation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8">
        <h1 className="text-xl font-semibold text-gray-900">Accept your invitation</h1>
        <p className="mt-1 text-sm text-gray-500">
          You've been invited to join as <strong>{invite.hoa_role || 'staff'}</strong>.
        </p>
        <p className="mt-1 text-sm text-gray-500">Set your password to activate your account.</p>

        <form action={acceptInvite as any} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={invite.email} disabled className="bg-gray-50" />
          </div>
          <div>
            <Label htmlFor="password">Create password</Label>
            <Input id="password" name="password" type="password" required minLength={8} placeholder="Minimum 8 characters" autoComplete="new-password" />
          </div>
          {sp.error && <p className="text-sm text-red-600">{sp.error}</p>}
          <Button type="submit" className="w-full">Create account</Button>
        </form>
      </div>
    </div>
  );
}
