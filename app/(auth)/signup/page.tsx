import Link from 'next/link';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { signupWithPassword } from '@/lib/auth/actions';

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-light tracking-tight text-white">
          Portier
        </h1>
        <p className="mt-1 text-sm text-slate-400">The operating system for condominium &amp; HOA management</p>
      </header>

      <div className="mx-auto max-w-sm rounded-xl border border-slate-800 bg-[#0B1121] p-7">
        <h2 className="text-lg font-semibold text-white">Create your account</h2>
        <p className="mt-1 text-sm text-slate-400">If you were invited, use the email address that received the invitation.</p>

        <form action={signupWithPassword as any} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium text-slate-300">Email</Label>
            <Input id="email" name="email" type="email" required
              className="mt-1.5 h-10 w-full rounded-lg border-slate-700 bg-[#0A1628] text-sm text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm font-medium text-slate-300">Password</Label>
            <Input id="password" name="password" type="password" required minLength={12}
              className="mt-1.5 h-10 w-full rounded-lg border-slate-700 bg-[#0A1628] text-sm text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
            <p className="mt-1 text-xs text-slate-400">Minimum 12 characters</p>
          </div>
          <Button type="submit" className="h-11 w-full rounded-lg bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400">
            Create account
          </Button>
          <div className="text-center">
            <Link href="/login" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
              Already have an account? Sign in &rarr;
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
