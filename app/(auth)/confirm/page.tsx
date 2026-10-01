import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { safeInternalNext } from '@/lib/security/redirects';
import { CONFIRMABLE_OTP_TYPES, type ConfirmableOtpType } from '@/lib/auth/email-links';

export const dynamic = 'force-dynamic';

const COPY: Record<string, { title: string; body: string; button: string }> = {
  recovery: { title: 'Reset your password', body: 'Continue to choose a new password for your account.', button: 'Continue' },
  signup: { title: 'Verify your email', body: 'Continue to verify your email address and activate your account.', button: 'Verify and continue' },
};

// The token is used only when the person presses the button (POST), so email
// security scanners that open links cannot consume it.
async function confirmToken(formData: FormData) {
  'use server';
  const tokenHash = String(formData.get('token_hash') ?? '');
  const type = String(formData.get('type') ?? '') as ConfirmableOtpType;
  const next = safeInternalNext(String(formData.get('next') ?? '')) ?? (type === 'recovery' ? '/reset-password' : '/dashboard');
  if (!tokenHash || !(CONFIRMABLE_OTP_TYPES as readonly string[]).includes(type)) redirect('/login?error=link_invalid');
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
  if (error) redirect(`/login?error=${type === 'recovery' ? 'reset_link_expired' : 'link_expired'}`);
  redirect(next);
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const valid = !!sp.token_hash && (CONFIRMABLE_OTP_TYPES as readonly string[]).includes(sp.type ?? '');
  const copy = COPY[sp.type ?? ''] ?? { title: 'Confirm your sign-in', body: 'Continue to finish signing in.', button: 'Continue' };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-gray-950">
          {valid ? copy.title : 'This link is not valid'}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          {valid ? copy.body : 'The link is incomplete. Request a new email and use the latest link.'}
        </p>
      </header>
      {valid ? (
        <form action={confirmToken} className="space-y-4">
          <input type="hidden" name="token_hash" value={sp.token_hash} />
          <input type="hidden" name="type" value={sp.type} />
          {sp.next && <input type="hidden" name="next" value={sp.next} />}
          <Button type="submit" size="lg" className="w-full">{copy.button}</Button>
        </form>
      ) : (
        <Link href="/forgot-password" className="text-sm font-medium text-gray-900 underline">Request a new link</Link>
      )}
    </div>
  );
}
