import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loginWithPassword } from '@/lib/auth/actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sign in to condo-app</CardTitle>
        <p className="text-sm text-gray-500">Enter your email and password.</p>
      </CardHeader>
      <CardBody>
        <form action={loginWithPassword as any} className="space-y-4">
          <input type="hidden" name="next" value={next ?? '/dashboard'} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">Sign in</Button>
          <div className="text-center text-sm text-gray-600">
            Don&apos;t have an account? <Link href="/signup" className="text-brand-600 hover:underline">Sign up</Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
