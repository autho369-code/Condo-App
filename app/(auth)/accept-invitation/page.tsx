import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { acceptInvitation } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AcceptInvitationPage({
  searchParams,
}: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <Card className="mx-auto max-w-sm"><CardBody>No invitation token provided.</CardBody></Card>;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in: a brand-new invitee has no account yet, so send them to the
  // /invite flow, which validates the token, lets them set a password, creates
  // the account, and applies the invitation in one step.
  if (!user) {
    redirect(`/invite?token=${encodeURIComponent(token)}`);
  }

  // Logged in: accept
  const result = await acceptInvitation(token);

  if (result.error) {
    return (
      <Card className="mx-auto max-w-sm">
        <CardHeader><CardTitle>Invitation problem</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-red-600">{result.error}</p>
          <div className="mt-4"><Link href="/dashboard"><Button variant="secondary">Continue</Button></Link></div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader><CardTitle>You&apos;re in</CardTitle></CardHeader>
      <CardBody>
        <p className="mb-4 text-sm text-gray-700">Your invitation was accepted and your account is ready.</p>
        <Link href="/dashboard"><Button>Go to dashboard</Button></Link>
      </CardBody>
    </Card>
  );
}
