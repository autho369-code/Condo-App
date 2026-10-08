import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { acceptInvitation } from '@/lib/auth/actions';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { hasVisibleText } from '@/lib/company-admin/settings';
import { NEUTRAL_COMPANY_NAME } from '@/lib/tenant/resolve';
import { tokenMatchesAddress } from '@/lib/tenant/token-company';

export const dynamic = 'force-dynamic';

export default async function AcceptInvitationPage({
  searchParams,
}: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token) {
    return (
      <Card className="mx-auto max-w-sm">
        <CardHeader><CardTitle>Invitation link incomplete</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600">This link has no invitation code. Open the link from your invitation email again.</p>
          <div className="mt-4"><Link href="/login"><Button variant="secondary">Go to sign in</Button></Link></div>
        </CardBody>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not signed in: /invite validates the token, lets a new invitee set a
  // password, creates the account and applies the invitation in one step.
  if (!user) redirect(`/invite?token=${encodeURIComponent(token)}`);

  // The invitation belongs to its company: on another company's address it
  // isn't valid here (as /invite, /sign and /vendor-upload). The platform
  // address is allowed: /invite sends someone whose account belongs to
  // another company there to sign in and accept.
  const { data: invite } = await (createServiceClient() as any)
    .from('user_invitations')
    .select('portfolio_id, email, expires_at, portfolios(company_name)')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();
  if (!invite || !tokenMatchesAddress(await headers(), invite.portfolio_id)) {
    return (
      <Card className="mx-auto max-w-sm">
        <CardHeader><CardTitle>This invitation isn&apos;t valid here</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600">It may have been used or replaced, or it belongs to a different company. Open the link from your most recent invitation email.</p>
          <div className="mt-4"><Link href="/login"><Button variant="secondary">Go to sign in</Button></Link></div>
        </CardBody>
      </Card>
    );
  }
  // Expired, or sent to another email address: say so before offering a
  // button the RPC would refuse (the invitee's address is never shown).
  const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
  const otherAccount = String(invite.email ?? '').toLowerCase() !== String(user.email ?? '').toLowerCase();
  if (expired || otherAccount) {
    return (
      <Card className="mx-auto max-w-sm">
        <CardHeader><CardTitle>{expired ? 'This invitation has expired' : 'This invitation is for another account'}</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600">
            {expired
              ? 'Ask the person who invited you to send a new invitation.'
              : <>You&apos;re signed in as <span className="font-medium text-gray-950">{user.email}</span>, but the invitation was sent to a different email address. Sign in with that account to accept it.</>}
          </p>
          <div className="mt-4">
            {/* Signing in with the invited account comes back here to accept. */}
            <Link href={expired ? '/login' : `/login?next=${encodeURIComponent(`/accept-invitation?token=${encodeURIComponent(token)}`)}`}>
              <Button variant="secondary">{expired ? 'Go to sign in' : 'Sign in with that account'}</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }
  const companyName = hasVisibleText(invite.portfolios?.company_name) ? invite.portfolios.company_name.trim() : NEUTRAL_COMPANY_NAME;

  // Signed in: accepting moves this account to the inviting company and role,
  // so it needs an explicit confirmation (never on page load).
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader><CardTitle>Accept invitation</CardTitle></CardHeader>
      <CardBody>
        {error && <Alert className="mb-4" title="Invitation problem.">{error}</Alert>}
        <p className="text-sm text-gray-700">
          You&apos;re signed in as <span className="font-medium text-gray-950">{user.email}</span>. Accepting
          gives this account the access described in your invitation from{' '}
          <span className="font-medium text-gray-950">{companyName}</span> and replaces its current company access.
        </p>
        <form action={acceptInvitation} className="mt-5 flex flex-wrap gap-2">
          <input type="hidden" name="token" value={token} />
          <Button type="submit">Accept invitation</Button>
          <Link href="/login"><Button type="button" variant="secondary">Not now</Button></Link>
        </form>
      </CardBody>
    </Card>
  );
}
