import { createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { queueEmails } from '@/lib/email/queue';
import { consumePublicRateLimit, consumeScopedRateLimit } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';

// The invitation token is the credential here: visitors are anonymous (no
// session, no RLS access), so reads and account creation go through the
// service client after validating the token.

const MIN_PASSWORD = 12;

const ROLE_LABELS: Record<string, string> = {
  company_admin: 'Company Admin',
  manager: 'Manager',
  board: 'Board Member',
  owner: 'Owner',
  tenant: 'Tenant',
};

async function acceptInvite(formData: FormData) {
  'use server';
  const token = formData.get('token') as string;
  const password = formData.get('password') as string;
  const failTo = (message: string) =>
    redirect(`/invite?token=${encodeURIComponent(token ?? '')}&error=${encodeURIComponent(message)}`);

  if (!token || !password) failTo('Token and password required.');
  if (password.length < MIN_PASSWORD) failTo(`Password must be at least ${MIN_PASSWORD} characters.`);

  const svc = createServiceClient() as any;
  const requestHeaders = await headers();
  const [sourceLimit, tokenLimit] = await Promise.all([
    consumePublicRateLimit(svc, requestHeaders, { scope: 'invitation_accept_ip', windowSeconds: 3600, maxRequests: 20 }),
    consumeScopedRateLimit(svc, token, { scope: 'invitation_accept_token', windowSeconds: 3600, maxRequests: 10 }),
  ]);
  if (!sourceLimit.allowed || !tokenLimit.allowed) failTo('Too many invitation attempts. Please try again later.');

  // Validate the invitation
  const { data: invite } = await svc
    .from('user_invitations')
    .select('id, email, portfolio_id, hoa_role, expires_at, accepted_at, status')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (!invite) failTo('Invitation not found or already used.');
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) failTo('Invitation has expired.');

  // Create the auth user (service role — admin API)
  const siteUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portier369.com';
  const { data: linkData, error: createErr } = await svc.auth.admin.generateLink({
    type: 'signup',
    email: invite.email,
    password,
    options: {
      redirectTo: `${siteUrl}/api/auth/callback`,
      data: { role: invite.hoa_role, portfolio_id: invite.portfolio_id },
    },
  });
  if (createErr || !linkData?.properties?.action_link || !linkData.user?.id) failTo(createErr?.message ?? 'Could not create the verification link.');

  const queued = await queueEmails(svc, [{
    to: invite.email,
    subject: 'Verify your Portier369 account',
    text: [
      'Your password was saved, but your account is not active yet.',
      '',
      'Verify this email address to activate your account:',
      linkData.properties.action_link,
      '',
      'If you did not request this account, contact your management office.',
    ].join('\n'),
    portfolioId: invite.portfolio_id,
    idempotencyKey: `invitation-verification:${invite.id}`,
  }]);
  if (queued.error || queued.count !== 1) {
    // generateLink(type=signup) creates the Auth user, and the database trigger
    // accepts the invitation immediately. If queueing fails, remove that new
    // unverified identity first, then restore this invitation for a clean retry.
    const { error: deleteError } = await svc.auth.admin.deleteUser(linkData.user.id);
    if (deleteError) failTo('Account setup could not be completed safely. Contact support before trying again.');
    const { data: restoredInvite, error: restoreError } = await svc.from('user_invitations').update({
      status: 'pending',
      used_at: null,
      used_by: null,
      accepted_at: null,
    }).eq('id', invite.id).select('id').single();
    if (restoreError || !restoredInvite) failTo('Account setup was rolled back, but the invitation could not be restored. Contact support.');
    failTo(queued.error ?? 'Could not queue the verification email. Please try again.');
  }
  redirect('/login?message=' + encodeURIComponent('Check your email to verify and activate your account.'));

}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white p-8 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-950 text-sm font-bold text-white">P</div>
          <span className="text-lg font-semibold text-gray-950">Portier369</span>
        </div>
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-gray-950">{title}</h1>
        {children}
      </div>
    </div>
  );
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
      <Shell title="Invalid invitation">
        <p className="mt-2 text-sm leading-6 text-gray-500">No invitation token provided. Please use the link from your invitation email.</p>
      </Shell>
    );
  }

  // Anonymous visitors can't read invitations under RLS — validate via service
  // role using the token itself as the credential.
  const svc = createServiceClient() as any;
  const { data: invite } = await svc
    .from('user_invitations')
    .select('email, portfolio_id, hoa_role, expires_at, accepted_at, status, portfolios(company_name)')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.accepted_at || invite.status === 'accepted' || invite.status === 'revoked') {
    const used = invite?.accepted_at || invite?.status === 'accepted';
    return (
      <Shell title={used ? 'Invitation already accepted' : 'Invitation not found'}>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          {used ? 'This invitation has already been used. Please sign in.' : 'This invitation link is invalid or has been cancelled.'}
        </p>
        <a href="/login" className="mt-4 inline-block text-sm font-medium text-gray-900 underline-offset-4 hover:underline">Go to sign in →</a>
      </Shell>
    );
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return (
      <Shell title="Invitation expired">
        <p className="mt-2 text-sm leading-6 text-gray-500">
          This invitation expired on {new Date(invite.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. Contact your administrator for a new invitation.
        </p>
      </Shell>
    );
  }

  const companyName = invite.portfolios?.company_name;
  const roleLabel = ROLE_LABELS[invite.hoa_role] ?? invite.hoa_role ?? 'staff';

  return (
    <Shell title="Accept your invitation">
      <p className="mt-1.5 text-sm leading-6 text-gray-500">
        You&apos;ve been invited to join{companyName ? <> <strong className="text-gray-900">{companyName}</strong></> : null} as <strong className="text-gray-900">{roleLabel}</strong>.
      </p>
      <p className="mt-1 text-sm leading-6 text-gray-500">Set your password to activate your account.</p>

      <form action={acceptInvite as any} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={invite.email} disabled className="bg-gray-50" />
        </div>
        <div>
          <Label htmlFor="password">Create password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            placeholder={`Minimum ${MIN_PASSWORD} characters`}
            autoComplete="new-password"
          />
        </div>
        {sp.error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
            {sp.error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full rounded-xl bg-gray-950 text-[14px] hover:bg-gray-800">
          Create account
        </Button>
      </form>
      <p className="mt-4 text-[11px] text-gray-400">Powered by <span className="font-medium text-gray-500">Portier369</span></p>
    </Shell>
  );
}
