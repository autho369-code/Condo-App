import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { acceptInvitation } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/server';

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

  // Signed in: accepting moves this account to the inviting company and role,
  // so it needs an explicit confirmation (never on page load).
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader><CardTitle>Accept invitation</CardTitle></CardHeader>
      <CardBody>
        {error && <Alert className="mb-4" title="Invitation problem.">{error}</Alert>}
        <p className="text-sm text-gray-700">
          You&apos;re signed in as <span className="font-medium text-gray-950">{user.email}</span>. Accepting
          gives this account the access described in your invitation and replaces its current company access.
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
