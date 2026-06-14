import Link from 'next/link';
import { headers } from 'next/headers';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loginWithPassword } from '@/lib/auth/actions';
import { getLoginModeConfig, getVisibleLoginModes, safeInternalNext, type LoginModeId } from '@/lib/auth/login-modes';
import { tenantFromHeaders } from '@/lib/tenant/resolve';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: LoginModeId }>;
}) {
  const params = await searchParams;
  const mode = getLoginModeConfig(params.mode);
  // Only forward an EXPLICIT deep-link (e.g. bounced from a protected page).
  // When absent, leave next empty so the server resolves the destination from
  // the account's actual role instead of the login tab's default.
  const next = safeInternalNext(params.next) ?? '';
  const localPreview = process.env.LOCAL_PREVIEW_MODE === 'true';
  const modes = getVisibleLoginModes(params.mode);
  const isAdminMode = mode.id === 'admin';

  // Tenant branding from subdomain
  const h = await headers();
  const tenant = tenantFromHeaders(h);

  return (
    <div className="space-y-6">
      <header>
        {tenant ? (
          <>
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.companyName} className="h-10 object-contain" />
            ) : (
              <div className="text-lg font-semibold tracking-tight text-gray-950">{tenant.companyName}</div>
            )}
            <h1 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-gray-950">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-gray-500">
              Access your association&apos;s management portal.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-gray-950">
              {isAdminMode ? 'Platform sign in' : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-gray-500">
              {isAdminMode ? 'Restricted platform access.' : 'Sign in to your workspace.'}
            </p>
          </>
        )}
      </header>

      {/* Role switcher */}
      {!isAdminMode && (
        <nav
          aria-label="Account type"
          className="grid grid-cols-3 gap-1 rounded-xl border border-gray-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        >
          {modes.map((item) => {
            const isActive = item.id === mode.id;
            return (
              <Link
                key={item.id}
                href={`/login?mode=${item.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'flex h-9 items-center justify-center rounded-lg text-[13px] font-medium transition-colors ' +
                  (isActive
                    ? 'bg-gray-950 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900')
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Sign-in card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        <p className="text-[13px] leading-6 text-gray-500">{mode.description}</p>

        <form action={loginWithPassword as any} className="mt-5 space-y-4">
          <input type="hidden" name="mode" value={mode.id} />
          <input type="hidden" name="next" value={next} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {params.error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700"
            >
              {params.error}
            </p>
          )}

          <Button type="submit" className="h-11 w-full rounded-xl bg-gray-950 text-[14px] hover:bg-gray-800">
            {mode.submitLabel}
          </Button>
        </form>

        <p className="mt-4 text-[12px] leading-5 text-gray-400">{mode.note}</p>
      </div>

      {/* Below-card actions */}
      <div className="space-y-3 text-center">
        {mode.id !== 'admin' && (
          <p className="text-sm text-gray-500">
            Need a new account?{' '}
            <Link href="/signup" className="font-medium text-gray-900 underline-offset-4 hover:underline">
              Request access
            </Link>
          </p>
        )}
        {isAdminMode && (
          <p className="text-xs leading-5 text-gray-400">
            Platform access requires an active platform operator record in Supabase.
          </p>
        )}
        {localPreview && (
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gray-950 px-4 text-sm font-medium text-white hover:bg-gray-800"
          >
            Continue to local preview
          </Link>
        )}
        {tenant && (
          <p className="text-[11px] text-gray-400">
            Powered by <span className="font-medium text-gray-500">Portier369</span>
          </p>
        )}
      </div>
    </div>
  );
}
