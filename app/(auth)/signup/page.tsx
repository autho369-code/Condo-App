import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { signupWithPassword } from '@/lib/auth/actions';

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create your account</CardTitle>
        <p className="text-sm text-gray-500">If you were invited, use the email address that received the invitation.</p>
      </CardHeader>
      <CardBody>
        <form action={signupWithPassword} className="space-y-4">
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
            Already have an account? <Link href="/login" className="text-brand-600 hover:underline">Sign in</Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
