import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Input, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { setNewPassword } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const params = await searchParams;

  // Success state — shown after setNewPassword redirected here with ?done=1
  if (params.done === '1') {
    return (
      <div className="space-y-9">
        <header>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            Password updated
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
            All set —{' '}
            <span className="italic text-champagne-700">welcome back.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-500">
            Your new password is in place. We’ve also signed out any other
            devices that were open under your account, just to be sure.
          </p>
        </header>

        <div className="rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-sage-100 text-sage-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <div className="text-sm leading-relaxed text-ink-700">
              <p>
                Step into your workspace whenever you’d like. The next time
                you sign in, use the new password.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/dashboard">
                  <Button size="md" variant="primary">Open your workspace →</Button>
                </Link>
                <Link href="/login">
                  <Button size="md" variant="outline">Back to sign in</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Gate the form — without a valid session (set by /api/auth/callback during
  // the reset email click-through), there's nothing to update. Send the user
  // back to /forgot-password to start over.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/forgot-password?error=' + encodeURIComponent('Your reset link is invalid or has expired. Please request a new one.'));
  }

  // Form state
  return (
    <div className="space-y-9">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
          Set a new password
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
          Choose your{' '}
          <span className="italic text-champagne-700">new credential.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-500">
          Updating the password for{' '}
          <span className="font-medium text-ink-900">{user.email}</span>.
          Pick something at least 12 characters long — a passphrase is easier
          to remember and harder to guess.
        </p>
      </header>

      <form
        action={setNewPassword as any}
        className="space-y-5 rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm"
      >
        <Field label="New password" hint="Minimum 12 characters">
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            placeholder="••••••••••••"
          />
        </Field>

        <Field label="Confirm new password">
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            placeholder="••••••••••••"
          />
        </Field>

        {/* Tasteful, non-prescriptive password tips */}
        <ul className="grid gap-1.5 rounded-md border border-ink-100 bg-cream-50 px-4 py-3 text-[12px] leading-relaxed text-ink-600">
          <li className="flex items-start gap-2">
            <Dot /> A passphrase of three or four words you’d remember is hard to crack and easy to type.
          </li>
          <li className="flex items-start gap-2">
            <Dot /> We never store your password in clear text — only a salted hash you can’t reverse.
          </li>
          <li className="flex items-start gap-2">
            <Dot /> Updating here signs you out of any other open sessions.
          </li>
        </ul>

        {params.error && (
          <div className="rounded-md border border-bordeaux-300 bg-bordeaux-50 px-3.5 py-2.5 text-sm text-bordeaux-700">
            {params.error}
          </div>
        )}

        <Button type="submit" size="lg" variant="primary" className="w-full">
          Update password
        </Button>
      </form>

      <div className="text-center text-sm text-ink-600">
        Changed your mind?{' '}
        <Link
          href="/login"
          className="font-medium text-champagne-700 underline decoration-champagne-300 decoration-1 underline-offset-4 hover:decoration-champagne-500 transition-colors"
        >
          Back to sign in →
        </Link>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="mt-1.5 inline-block h-1 w-1 flex-none rounded-full bg-champagne-500"
    />
  );
}
