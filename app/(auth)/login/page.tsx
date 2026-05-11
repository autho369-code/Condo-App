import Link from 'next/link';
import { Input, Label, Field } from '@/components/ui/input';
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
    <div className="space-y-9">
      {/* Editorial header */}
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
          {isAdminMode ? 'Restricted · Platform' : 'Welcome back'}
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
          Sign in to{' '}
          <span className="italic text-champagne-700">your workspace.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-500">
          {isAdminMode
            ? 'Platform access for Portier operators only.'
            : 'Choose the workspace that matches your account, then enter your credentials.'}
        </p>
      </header>

      {/* Mode picker — pill row */}
      {!isAdminMode && (
        <div role="tablist" aria-label="Login mode" className="flex flex-wrap gap-2">
          {modes
            .filter((m) => m.id !== 'admin')
            .map((item) => {
              const isActive = item.id === mode.id;
              return (
                <Link
                  key={item.id}
                  href={`/login?mode=${item.id}`}
                  role="tab"
                  aria-selected={isActive}
                  className={
                    'inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-all ' +
                    (isActive
                      ? 'border-ink-900 bg-ink-900 text-cream-50 shadow-soft-sm'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-cream-50')
                  }
                >
                  {item.title}
                </Link>
              );
            })}
        </div>
      )}

      {/* Mode description */}
      <p className="text-sm leading-relaxed text-ink-600">{mode.description}</p>

      {/* Form */}
      <form
        action={loginWithPassword as any}
        className="space-y-5 rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm"
      >
        <input type="hidden" name="mode" value={mode.id} />
        <input type="hidden" name="next" value={next} />

        <Field label="Email address">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
        </Field>

        <Field
          label={
            <span className="flex items-baseline justify-between gap-2">
              <span>Password</span>
              <Link
                href="/forgot-password"
                className="text-[11px] font-medium normal-case tracking-normal text-champagne-700 hover:text-champagne-600 transition-colors"
              >
                Forgot password?
              </Link>
            </span>
          }
        >
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </Field>

        {params.error && (
          <div className="rounded-md border border-bordeaux-300 bg-bordeaux-50 px-3.5 py-2.5 text-sm text-bordeaux-700">
            {params.error}
          </div>
        )}

        <p className="text-xs leading-relaxed text-ink-500">{mode.note}</p>

        <Button type="submit" size="lg" variant="primary" className="w-full">
          {mode.submitLabel}
        </Button>
      </form>

      {/* Below-form actions */}
      <div className="space-y-4 text-center">
        <div className="text-sm text-ink-600">
          New to Portier?{' '}
          <Link
            href="/request-access"
            className="font-medium text-champagne-700 underline decoration-champagne-300 decoration-1 underline-offset-4 hover:decoration-champagne-500 transition-colors"
          >
            Request access →
          </Link>
        </div>

        {localPreview && (
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-md bg-ink-900 px-4 text-sm font-medium text-cream-50 hover:bg-ink-800 transition-colors"
          >
            Continue to local preview
          </Link>
        )}

        {isAdminMode && (
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-500">
            Platform access requires an active operator record.
          </p>
        )}
      </div>
    </div>
  );
}
