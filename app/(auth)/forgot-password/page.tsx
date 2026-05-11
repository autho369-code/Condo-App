import Link from 'next/link';
import { Input, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { requestPasswordReset } from '@/lib/auth/actions';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent;

  // Confirmation state — shown after the action redirected here with ?sent=
  if (sent) {
    return (
      <div className="space-y-9">
        <header>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            Reset link sent
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
            Check your{' '}
            <span className="italic text-champagne-700">inbox.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-500">
            If an account exists for <span className="text-ink-900 font-medium">{sent}</span>,
            we’ve sent a password-reset link. It will be valid for one hour.
          </p>
        </header>

        <div className="rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-champagne-shimmer text-ink-900">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </div>
            <div className="text-sm leading-relaxed text-ink-700">
              <p>Open the email from <span className="font-medium text-ink-900">Portier</span> and follow the secure link to choose a new password.</p>
              <p className="mt-3 text-ink-500">
                Didn’t receive it? Check your spam folder, or{' '}
                <Link
                  href="/forgot-password"
                  className="font-medium text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 transition-colors"
                >
                  request another link
                </Link>.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-ink-600">
          Remembered it?{' '}
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

  // Request state — initial form
  return (
    <div className="space-y-9">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
          Forgot your password?
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
          We’ll send a{' '}
          <span className="italic text-champagne-700">reset link.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-500">
          Enter the email address on your Portier account. If we recognise it,
          we’ll send a secure link valid for one hour.
        </p>
      </header>

      <form
        action={requestPasswordReset as any}
        className="space-y-5 rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm"
      >
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

        {params.error && (
          <div className="rounded-md border border-bordeaux-300 bg-bordeaux-50 px-3.5 py-2.5 text-sm text-bordeaux-700">
            {params.error}
          </div>
        )}

        <Button type="submit" size="lg" variant="primary" className="w-full">
          Send reset link
        </Button>

        <p className="text-[11px] leading-relaxed text-ink-500">
          For your protection, we don’t reveal whether an address is registered.
          You’ll see the same confirmation either way.
        </p>
      </form>

      <div className="text-center text-sm text-ink-600">
        Remembered it?{' '}
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
