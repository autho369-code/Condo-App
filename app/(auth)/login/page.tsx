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
  const isAdminMode = mode.id === 'admin';

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="font-serif text-4xl font-light tracking-tightest text-ink-900">
          Portier
        </h1>
        <p className="mt-3 text-sm font-medium uppercase tracking-widest text-cream-600">
          Property Management Platform
        </p>
      </header>

      <Card className="card-premium overflow-hidden">
        {modes.map((item, index) => {
          const isActive = item.id === mode.id;
          const href = `/login?mode=${item.id}`;

          return (
            <section
              key={item.id}
              className={
                'grid gap-6 px-8 py-8 md:grid-cols-[200px_1fr] ' +
                (index === modes.length - 1 ? '' : 'border-b border-cream-100')
              }
            >
              <div>
                <h2 className="font-serif text-xl font-medium text-ink-800">{item.title}</h2>
                {item.id === 'admin' && (
                  <span className="mt-2 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-[11px] font-medium uppercase tracking-wider text-amber-700">
                    Restricted
                  </span>
                )}
              </div>
              <div className="space-y-4">
                <p className="max-w-xl text-[15px] leading-relaxed text-ink-500">{item.description}</p>
                {!isActive ? (
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1 text-[15px] font-medium text-ink-800 transition-colors hover:text-ink-600"
                  >
                    {item.title} Here
                    <span className="text-lg leading-none">&rarr;</span>
                  </Link>
                ) : (
                  <form action={loginWithPassword as any} className="max-w-md space-y-5 rounded-xl border border-cream-100 bg-cream-50/80 p-6">
                    <input type="hidden" name="mode" value={mode.id} />
                    <input type="hidden" name="next" value={next} />
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-ink-600">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        className="mt-1.5 h-11 w-full rounded-lg border-cream-200 bg-white text-[15px] text-ink-800 placeholder:text-ink-300 focus:border-ink-400 focus:ring-1 focus:ring-ink-400"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-sm font-medium text-ink-600">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        className="mt-1.5 h-11 w-full rounded-lg border-cream-200 bg-white text-[15px] text-ink-800 placeholder:text-ink-300 focus:border-ink-400 focus:ring-1 focus:ring-ink-400"
                      />
                    </div>
                    {params.error && (
                      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{params.error}</p>
                    )}
                    <p className="text-[13px] leading-relaxed text-ink-400">{item.note}</p>
                    <Button type="submit" className="btn-primary w-full">
                      {item.submitLabel}
                    </Button>
                    <div className="text-center">
                      <Link href="/signup" className="text-[13px] font-medium text-ink-600 transition-colors hover:text-ink-800">
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

      <div className="space-y-3 text-center">
        {localPreview && (
          <Link
            href="/dashboard"
            className="btn-secondary"
          >
            Continue to local preview
          </Link>
        )}
        {isAdminMode && (
          <p className="text-[13px] leading-5 text-ink-400">
            Platform access requires an active platform operator record in Supabase.
          </p>
        )}
      </div>
    </div>
  );
}
