import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { acceptInvitation } from '@/lib/auth/actions';
import { activateInvitation } from '@/lib/auth/activate-actions';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AcceptInvitationPage({
  searchParams,
}: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token) return <Card className="mx-auto max-w-sm"><CardBody><p className="text-sm text-gray-600">No invitation token provided.</p></CardBody></Card>;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Already logged in — accept immediately
  if (user) {
    const result = await acceptInvitation(token);
    if (result.error) {
      return (
        <Card className="mx-auto max-w-sm">
          <CardHeader><CardTitle>Invitation problem</CardTitle></CardHeader>
          <CardBody>
            <p className="text-sm text-red-600">{result.error}</p>
            <div className="mt-4"><Link href="/portal"><Button variant="secondary">Go to portal</Button></Link></div>
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

  // Not logged in — show password setup form (no redirect to login)
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Activate your account</CardTitle>
        <p className="text-sm text-gray-500">You&apos;ve been invited to Portier. Create a password to access your owner portal.</p>
      </CardHeader>
      <CardBody>
        {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <form action={activateInvitation} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-500">Minimum 12 characters</p>
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full">Activate account</Button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-600">
          Already have an account? <Link href={`/login?mode=owner&next=/accept-invitation?token=${encodeURIComponent(token)}`} className="text-brand-600 hover:underline">Sign in instead</Link>
        </div>
      </CardBody>
    </Card>
  );
}
