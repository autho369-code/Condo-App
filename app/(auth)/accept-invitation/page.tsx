import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { acceptInvitation } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AcceptInvitationPage({
  searchParams,
}: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <Card className="mx-auto max-w-sm"><CardBody>No invitation token provided.</CardBody></Card>;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If not logged in, send them to signup/login first — they need an auth user to accept
  if (!user) {
    return (
      <Card className="mx-auto max-w-sm">
        <CardHeader><CardTitle>Accept invitation</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-4 text-sm text-gray-700">You need to sign in first so we can attach the invitation to your account.</p>
          <div className="flex gap-2">
            <Link href={`/login?mode=owner&next=/accept-invitation?token=${encodeURIComponent(token)}`}>
              <Button variant="secondary">Sign in</Button>
            </Link>
            <Link href={`/signup?next=/accept-invitation?token=${encodeURIComponent(token)}`}>
              <Button>Sign up</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    );
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
        <Link href="/portal"><Button>Go to portal</Button></Link>
      </CardBody>
    </Card>
  );
}
