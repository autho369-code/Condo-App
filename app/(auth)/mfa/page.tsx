import { redirect } from 'next/navigation';
import { MfaVerification } from '@/components/auth/mfa-verification';
import { getMe, requireMatchingTenantWorkspace, roleHome } from '@/lib/auth/me';
import { requiresMfa } from '@/lib/auth/mfa-policy';
import { safeInternalNext } from '@/lib/security/redirects';

export const dynamic = 'force-dynamic';

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; manage?: string }>;
}) {
  const me = await getMe({ enforceMfa: false });
  if (!me.auth_user_id) redirect('/login?next=/mfa');
  await requireMatchingTenantWorkspace(me);

  const params = await searchParams;
  const home = roleHome(me);
  const destination = safeInternalNext(params.next) ?? (home === '/login' ? '/account' : home);
  const required = requiresMfa(me);
  const recoveryCopy = me.is_platform_operator
    ? 'Ask another Portier369 platform administrator to reset MFA. If no other administrator is available, contact hello@portier369.com.'
    : me.is_company_admin
      ? 'Ask a Portier369 platform administrator to reset MFA, or contact hello@portier369.com.'
      : 'Ask your management company administrator to reset MFA. For additional help, contact hello@portier369.com.';

  return (
    <div className="space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">Account security</div>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-gray-950">
          Two-step verification
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          {required && params.manage !== '1'
            ? 'Your role requires an authenticator check before you can access this workspace.'
            : 'Add an authenticator check to protect your Portier369 account.'}
        </p>
      </header>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        <MfaVerification
          next={destination}
          required={required}
          manage={params.manage === '1'}
          initialError={params.error}
        />
      </div>

      <p className="text-center text-xs leading-5 text-gray-400">
        Lost access? {recoveryCopy}
      </p>
    </div>
  );
}
