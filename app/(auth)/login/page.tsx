import Link from 'next/link';
import { headers } from 'next/headers';
import { Card } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loginWithPassword } from '@/lib/auth/actions';
import { getLoginModeConfig, getLoginNext, getVisibleLoginModes, type LoginModeId } from '@/lib/auth/login-modes';
import { tenantFromHeaders } from '@/lib/tenant/resolve';

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

  // Tenant branding from subdomain
  const h = await headers();
  const tenant = tenantFromHeaders(h);

  return (
    <div className="space-y-6">
      <header className="text-center">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.companyName} className="mx-auto h-10 object-contain" />
        ) : (
          <div className="text-xl font-semibold text-brand-600">{tenant?.companyName ?? 'Portier'}</div>
        )}
        {tenant ? (
          <>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-950">{tenant.companyName}</h1>
            <p className="mt-2 text-sm text-gray-500">Access your association&apos;s management portal.</p>
            <div className="mt-3 text-xs text-gray-400">
              Powered by <span className="font-semibold text-brand-600">Portier369</span>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-950">Sign In</h1>
            <p className="mt-2 text-sm text-gray-500">
              {isAdminMode ? 'Restricted platform access.' : 'Choose the workspace that matches your account.'}
            </p>
          </>
        )}
      </header>

      <Card className="overflow-hidden rounded-md shadow-sm">
        {modes.map((item, index) => {
          const isActive = item.id === mode.id;
          const href = `/login?mode=${item.id}`;

          return (
            <section
              key={item.id}
              className={
                'grid gap-4 px-6 py-6 md:grid-cols-[220px_1fr] ' +
                (index === modes.length - 1 ? '' : 'border-b border-gray-200')
              }
            >
              <div>
                <h2 className="text-base font-semibold text-gray-900">{item.title}</h2>
                {item.id === 'admin' && <p className="mt-1 text-xs font-medium text-brand-600">Restricted access</p>}
              </div>
              <div className="space-y-3">
                <p className="max-w-xl text-sm leading-6 text-gray-600">{item.description}</p>
                {!isActive ? (
                  <Link href={href} className="inline-flex items-center text-sm font-medium text-brand-600 hover:underline">
                    {item.title} Here
                  </Link>
                ) : (
                  <form action={loginWithPassword as any} className="max-w-md space-y-4 rounded-md border border-blue-200 bg-blue-50/40 p-4">
                    <input type="hidden" name="mode" value={mode.id} />
                    <input type="hidden" name="next" value={next} />
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required autoComplete="email" />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" name="password" type="password" required autoComplete="current-password" />
                    </div>
                    {params.error && <p className="text-sm text-red-600">{params.error}</p>}
                    <p className="text-xs leading-5 text-gray-600">{item.note}</p>
                    <Button type="submit" className="w-full">{item.submitLabel}</Button>
                    {item.id !== 'admin' && (
                      <div className="text-center text-sm text-gray-600">
                        Need a new account? <Link href="/signup" className="text-brand-600 hover:underline">Request access</Link>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </section>
          );
        })}
      </Card>

      {!isAdminMode && !tenant && (
        <div className="text-center">
          <Link href="/login?mode=admin" className="text-xs text-gray-400 hover:text-gray-600">Platform admin sign in</Link>
        </div>
      )}

      <div className="space-y-3 text-center">
        {localPreview && (
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded bg-gray-950 px-4 text-sm font-medium text-white hover:bg-gray-800"
          >
            Continue to local preview
          </Link>
        )}
        {isAdminMode && (
          <p className="text-xs leading-5 text-gray-500">
            Platform access requires an active platform operator record in Supabase.
          </p>
        )}
      </div>
    </div>
  );
}
