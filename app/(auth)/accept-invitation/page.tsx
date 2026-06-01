import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { acceptInvitation } from '@/lib/auth/actions';
import { activateInvitation } from '@/lib/auth/activate-actions';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-slate-800 bg-[#0B1121] p-7">
      {children}
    </div>
  );
}

export default async function AcceptInvitationPage({
  searchParams,
}: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token) return <Card><p className="text-sm text-slate-400">No invitation token provided.</p></Card>;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const result = await acceptInvitation(token);
    if (result.error) {
      return (
        <Card>
          <h2 className="text-lg font-semibold text-white">Invitation problem</h2>
          <p className="mt-2 text-sm text-red-400">{result.error}</p>
          <div className="mt-4"><Link href="/portal"><Button className="h-10 rounded-lg border border-slate-700 bg-transparent text-sm font-medium text-white hover:border-slate-500">Go to portal</Button></Link></div>
        </Card>
      );
    }
    return (
      <Card>
        <h2 className="text-lg font-semibold text-white">You&apos;re in</h2>
        <p className="mt-2 text-sm text-slate-400">Your invitation was accepted and your account is ready.</p>
        <div className="mt-4"><Link href="/portal"><Button className="h-10 rounded-lg bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400">Go to portal</Button></Link></div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white">Activate your account</h2>
      <p className="mt-1 text-sm text-slate-400">You&apos;ve been invited to Portier. Create a password to access your owner portal.</p>
      {error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/20 px-3 py-2 text-sm text-red-400">{error}</p>}
      <form action={activateInvitation} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <Label htmlFor="password" className="text-sm font-medium text-slate-300">Password</Label>
          <Input id="password" name="password" type="password" required minLength={12} autoComplete="new-password"
            className="mt-1.5 h-10 w-full rounded-lg border-slate-700 bg-[#0A1628] text-sm text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
          <p className="mt-1 text-xs text-slate-400">Minimum 12 characters</p>
        </div>
        <div>
          <Label htmlFor="confirm" className="text-sm font-medium text-slate-300">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password"
            className="mt-1.5 h-10 w-full rounded-lg border-slate-700 bg-[#0A1628] text-sm text-white placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
        </div>
        <Button type="submit" className="h-11 w-full rounded-lg bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400">Activate account</Button>
      </form>
      <div className="mt-4 text-center">
        <Link href={`/login?mode=owner&next=/accept-invitation?token=${encodeURIComponent(token)}`} className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
          Already have an account? Sign in instead &rarr;
        </Link>
      </div>
    </Card>
  );
}
