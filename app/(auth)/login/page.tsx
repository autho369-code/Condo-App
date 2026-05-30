import Link from 'next/link';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loginWithPassword } from '@/lib/auth/actions';
import { getLoginModeConfig, getLoginNext, getVisibleLoginModes, type LoginModeId } from '@/lib/auth/login-modes';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: LoginModeId }>;
}) {
  const params = await searchParams;
  const mode = getLoginModeConfig(params.mode);
  const next = getLoginNext(params);
  const localPreview = process.env.LOCAL_PREVIEW_MODE === 'true';
  const modes = getVisibleLoginModes(params.mode);
  const isSuperadmin = mode.id === 'superadmin';

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-2xl font-light tracking-tight text-white">
          Portier
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isSuperadmin ? 'Platform operator access' : 'Select your workspace'}
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0B1121]">
        {modes.map((item, index) => {
          const isActive = item.id === mode.id;
          const href = `/login?mode=${item.id}`;
          const isLast = index === modes.length - 1;

          return (
            <section
              key={item.id}
              className={
                'flex flex-col gap-4 px-7 py-6 md:flex-row md:gap-8 ' +
                (isLast ? '' : 'border-b border-slate-800/50')
              }
            >
              <div className="md:w-[160px] shrink-0">
                <h2 className="text-base font-semibold text-white">{item.title}</h2>
                {item.id === 'superadmin' && (
                  <span className="mt-2 inline-block rounded border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-[11px] font-medium text-amber-400">
                    Restricted
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-4">
                <p className="text-sm leading-relaxed text-slate-400">{item.description}</p>

                {!isActive ? (
                  <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 transition-colors hover:text-emerald-300">
                    {item.title} Here <span>&rarr;</span>
                  </Link>
                ) : (
                  <form action={loginWithPassword as any} className="max-w-[380px] space-y-4 rounded-xl border border-slate-700/50 bg-[#0A1628] p-5">
                    <input type="hidden" name="mode" value={mode.id} />
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

                    <p className="text-xs leading-relaxed text-slate-500">{item.note}</p>

                    <Button type="submit" className="h-11 w-full rounded-lg bg-emerald-500 text-sm font-semibold text-black hover:bg-emerald-400">
                      {item.submitLabel}
                    </Button>

                    <div className="text-center">
                      <Link href="/signup" className="text-sm font-medium text-slate-400 transition-colors hover:text-white">
                        Request access &rarr;
                      </Link>
                    </div>
                  </form>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="space-y-3 text-center">
        {localPreview && (
          <Link href="/dashboard" className="inline-flex h-10 items-center rounded-lg border border-slate-700 bg-transparent px-5 text-sm font-medium text-white hover:border-slate-500">
            Continue to local preview
          </Link>
        )}
        {isSuperadmin && (
          <p className="text-xs text-slate-500">Requires an active platform operator record in Supabase.</p>
        )}
      </div>
    </div>
  );
}
