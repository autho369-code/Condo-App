import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portier369.com';
const FROM_ADDRESS = 'hello@portier369.com';
const FROM_NAME = 'Portier369';

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

    const { data: profile } = await svc
      .from('profiles')
      .select('id, email, full_name, portfolio_id')
      .ilike('email', email)
      .maybeSingle();
    if (!profile?.email) done();

    const { data: linkData, error } = await svc.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
      options: { redirectTo: `${SITE_URL}/api/auth/callback?next=/reset-password` },
    });
    if (error || !linkData?.properties?.action_link) done();

    await svc.from('email_queue').insert({
      to_email: profile.email,
      to_name: profile.full_name,
      subject: 'Reset your Portier369 password',
      body: `<p>Hello${profile.full_name ? ` ${profile.full_name}` : ''},</p><p>We received a request to reset the password for your Portier369 account. Click the link below to choose a new password:</p><p><a href="${linkData.properties.action_link}">Reset your password</a></p><p>This link expires after a short time. If you did not request a reset, you can safely ignore this email — your password has not been changed.</p>`,
      status: 'pending',
      from_address: FROM_ADDRESS,
      from_name: FROM_NAME,
      portfolio_id: profile.portfolio_id,
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
