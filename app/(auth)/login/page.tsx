import Link from 'next/link';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loginWithPassword } from '@/lib/auth/actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : '';

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-2xl font-light tracking-tight text-white">
          Portier
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          The operating system for condominium &amp; HOA management
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0B1121]">
        <section className="flex flex-col gap-4 px-7 py-6 md:flex-row md:gap-8">
          <div className="md:w-[160px] shrink-0">
            <h2 className="text-base font-semibold text-white">Sign In</h2>
          </div>

          <div className="flex-1 space-y-4">
            <p className="text-sm leading-relaxed text-slate-400">
              Sign in to access your dashboard, portal, or command center. You&apos;ll be routed automatically based on your account.
            </p>

            <form action={loginWithPassword as any} className="max-w-[380px] space-y-4 rounded-xl border border-slate-700/50 bg-[#0A1628] p-5">
              <input type="hidden" name="next" value={next} />

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-slate-300">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email"
                  className="mt-1.5 h-10 w-full rounded-lg border-slate-700 bg-[#060B18] text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium text-slate-300">Password</Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password"
                  className="mt-1.5 h-10 w-full rounded-lg border-slate-700 bg-[#060B18] text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </div>

              {params.error && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{params.error}</p>
              )}

              <Button type="submit" className="h-11 w-full rounded-lg bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400">
                Sign in
              </Button>
            </form>
          </div>
        </section>
      </div>

      <p className="text-center text-xs text-slate-600">
        Access is by invitation only. Contact your administrator if you need an account.
      </p>
    </div>
  );
}
