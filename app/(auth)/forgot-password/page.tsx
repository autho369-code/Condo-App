import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { headers } from 'next/headers';
import { consumePublicRateLimit, consumeScopedRateLimit } from '@/lib/server/rate-limit';
import { siteUrl } from '@/lib/url/site-url';
import { verifiedAuthLink } from '@/lib/auth/email-links';
import { resolvedTenantUrl, tenantWorkspaceUrl } from '@/lib/tenant/host';
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { escapeHtml } from '@/lib/letters/merge';

export const dynamic = 'force-dynamic';

const FROM_ADDRESS = 'hello@portier369.com';
const PLATFORM_NAME = 'Portier369';

async function requestPasswordReset(formData: FormData) {
  'use server';
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  // Always land on the same confirmation regardless of outcome so this
  // public endpoint can't be used to probe which emails have accounts.
  const done = () => redirect('/forgot-password?sent=1');
  if (!email || !email.includes('@')) done();

  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const svc = createServiceClient() as any;
    const requestHeaders = await headers();
    const tenant = tenantFromHeaders(requestHeaders);
    const [sourceLimit, emailLimit] = await Promise.all([
      consumePublicRateLimit(svc, requestHeaders, { scope: 'password_reset_ip', windowSeconds: 3600, maxRequests: 10 }),
      consumeScopedRateLimit(svc, email, { scope: 'password_reset_email', windowSeconds: 3600, maxRequests: 3 }),
    ]);
    if (!sourceLimit.allowed || !emailLimit.allowed) done();

    // Generate the link FIRST — this works for every auth user regardless of
    // role. Vendors have no profiles row, so a profiles-based lookup would
    // silently exclude them; profile/owner/vendor lookups below are only
    // best-effort metadata for the email.
    const resetRedirect = tenant
      ? resolvedTenantUrl(tenant, '/api/auth/callback?next=/reset-password')
      : `${siteUrl()}/api/auth/callback?next=/reset-password`;
    const { data: linkData, error } = await svc.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: resetRedirect },
    });
    if (error || !linkData?.properties?.action_link) done();

    const userId = linkData.user?.id
    let toName: string | null = null
    let portfolioId: string | null = null
    if (userId) {
      const { data: profile } = await svc.from('profiles').select('full_name, portfolio_id').eq('id', userId).maybeSingle();
      if (profile) {
        toName = profile.full_name ?? null
        portfolioId = profile.portfolio_id ?? null
      } else {
        const { data: vendor } = await svc.from('vendors').select('name, portfolio_id').eq('auth_user_id', userId).maybeSingle();
        if (vendor) {
          toName = vendor.name ?? null
          portfolioId = vendor.portfolio_id ?? null
        }
      }
      if (!toName) {
        const { data: owner } = await svc.from('owners').select('full_name, portfolio_id').eq('auth_user_id', userId).maybeSingle();
        if (owner) {
          toName = owner.full_name ?? null
          portfolioId = portfolioId ?? owner.portfolio_id ?? null
        }
      }
    }

    // A tenant-branded reset form may only send mail for that tenant. Keep the
    // outward response identical so this cannot be used for account discovery.
    if (tenant && portfolioId !== tenant.portfolioId) done();

    // White label: a company's people get the reset under the company's name.
    // No sender name lets the mail worker apply the company's name and, once
    // verified, its own sending domain. Platform staff keep Portier369.
    // If the company's name can't be read, the email stays neutral ("your
    // account") rather than naming the platform.
    let company: string | null = null;
    // The emailed link opens where the person signs in: requested on the
    // platform address, a company's people still go to their company's own
    // workspace (sign-in is on <slug>.<apex>), not the platform's.
    let linkRedirect = resetRedirect;
    if (portfolioId) {
      const { data: portfolio, error: portfolioError } = await svc.from('portfolios').select('company_name, slug, archived_at').eq('id', portfolioId).maybeSingle();
      if (portfolioError) console.error('Password reset: could not load company name:', portfolioError.message);
      company = String(portfolio?.company_name ?? '').trim() || null;
      if (!tenant && portfolio?.slug && !portfolio.archived_at) {
        linkRedirect = tenantWorkspaceUrl(portfolio.slug, '/api/auth/callback?next=/reset-password');
      }
    }
    const brand = company ?? (portfolioId ? null : PLATFORM_NAME);

    await svc.from('email_queue').insert({
      to_email: email,
      to_name: toName,
      subject: brand ? `Reset your ${brand} password` : 'Reset your password',
      body: `<p>Hello${toName ? ` ${escapeHtml(toName)}` : ''},</p><p>We received a request to reset the password for your ${brand ? `${escapeHtml(brand)} ` : ''}account. Click the link below to choose a new password:</p><p><a href="${verifiedAuthLink(linkData, linkRedirect, 'recovery')}">Reset your password</a></p><p>This link expires after a short time. If you did not request a reset, you can safely ignore this email — your password has not been changed.</p>`,
      status: 'pending',
      from_address: FROM_ADDRESS,
      from_name: portfolioId ? null : PLATFORM_NAME,
      portfolio_id: portfolioId,
    });
  } catch {
    // Swallow everything — same confirmation either way.
  }
  done();
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-gray-950">
          Reset your password
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Enter the email you sign in with and we&apos;ll send you a reset link.
        </p>
      </header>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.12)]">
        {sp.sent ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] leading-5 text-emerald-800" role="status">
              If an account exists for that email, a password reset link is on its way. Check your inbox
              (and spam folder) — the link expires after a short time.
            </p>
            <Link href="/login" className="block text-center text-sm font-medium text-gray-900 underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form action={requestPasswordReset as any} className="space-y-4">
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
            <Button type="submit" className="h-11 w-full rounded-xl bg-gray-950 text-[14px] hover:bg-gray-800">
              Send reset link
            </Button>
          </form>
        )}
      </div>

      {!sp.sent && (
        <p className="text-center text-sm text-gray-500">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-gray-900 underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      )}
    </div>
  );
}
