import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { signupWithPassword } from '@/lib/auth/actions';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">Create your account</CardTitle>
        <p className="text-sm text-gray-500">If you were invited, use the email address that received the invitation.</p>
      </CardHeader>
      <CardBody>
        {sp.notice && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            {sp.notice}
          </div>
        )}
        {sp.error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span className="font-semibold">Could not create account:</span> {sp.error}
          </div>
        )}
        <form action={signupWithPassword as any} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={12} />
            <p className="mt-1 text-xs text-gray-500">Minimum 12 characters</p>
          </div>
          <Button type="submit" className="w-full">Create account</Button>
          <div className="text-center text-sm text-gray-600">
            Already have an account? <Link href="/login" className="font-medium text-gray-900 underline-offset-4 hover:underline">Sign in</Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
