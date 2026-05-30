import Link from 'next/link';
import { Card } from '@/components/ui/card';
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
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-16">
      <div className="w-full max-w-[640px] space-y-8">
        {/* Brand */}
        <header className="text-center">
          <h1 className="text-[28px] font-light tracking-[-0.02em] text-navy-600">
            Portier
          </h1>
          <p className="mt-1 text-[14px] font-normal text-slate-400">
            {isSuperadmin ? 'Platform operator access' : 'Select your workspace'}
          </p>
        </header>

        {/* Login modes */}
        <Card className="card-premium overflow-hidden">
          {modes.map((item, index) => {
            const isActive = item.id === mode.id;
            const href = `/login?mode=${item.id}`;
            const isLast = index === modes.length - 1;

            return (
              <section
                key={item.id}
                className={
                  'flex flex-col gap-4 px-7 py-6 md:flex-row md:gap-8 ' +
                  (isLast ? '' : 'border-b border-border')
                }
              >
                {/* Label column */}
                <div className="md:w-[160px] shrink-0">
                  <h2 className="text-[16px] font-semibold text-navy-600">{item.title}</h2>
                  {item.id === 'superadmin' && (
                    <span className="mt-2 inline-block rounded-[4px] border border-amber-200 bg-amber-50 px-3 py-0.5 text-[11px] font-medium text-amber-700">
                      Restricted
                    </span>
                  )}
                </div>

                {/* Content column */}
                <div className="flex-1 space-y-4">
                  <p className="text-[14px] leading-relaxed text-slate-400">{item.description}</p>

                  {!isActive ? (
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-500 transition-colors hover:text-brand-600"
                    >
                      {item.title} Here
                      <span>&rarr;</span>
                    </Link>
                  ) : (
                    <form action={loginWithPassword as any} className="max-w-[380px] space-y-4 rounded-[6px] border border-border-purple bg-brand-50/40 p-5">
                      <input type="hidden" name="mode" value={mode.id} />
                      <input type="hidden" name="next" value={next} />

                      <div>
                        <Label htmlFor="email" className="text-[14px] font-medium text-navy-500">Email</Label>
                        <Input
                          id="email" name="email" type="email" required autoComplete="email"
                          className="mt-1.5 h-10 w-full rounded-[4px] border-border bg-white text-[15px] text-navy-600 placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        />
                      </div>

                      <div>
                        <Label htmlFor="password" className="text-[14px] font-medium text-navy-500">Password</Label>
                        <Input
                          id="password" name="password" type="password" required autoComplete="current-password"
                          className="mt-1.5 h-10 w-full rounded-[4px] border-border bg-white text-[15px] text-navy-600 placeholder:text-slate-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        />
                      </div>

                      {params.error && (
                        <p className="rounded-[4px] bg-red-50 px-3 py-2 text-[13px] text-red-700">{params.error}</p>
                      )}

                      <p className="text-[12px] leading-relaxed text-slate-400">{item.note}</p>

                      <Button type="submit" className="btn-primary w-full">
                        {item.submitLabel}
                      </Button>

                      <div className="text-center">
                        <Link href="/signup" className="text-[13px] font-semibold text-brand-500 hover:text-brand-600">
                          Request access &rarr;
                        </Link>
                      </div>
                    </form>
                  )}
                </div>
              </section>
            );
          })}
        </Card>

        {/* Footer */}
        <div className="space-y-3 text-center">
          {localPreview && (
            <Link href="/dashboard" className="btn-secondary">
              Continue to local preview
            </Link>
          )}
          {isSuperadmin && (
            <p className="text-[12px] text-slate-400">
              Requires an active platform operator record in Supabase.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
