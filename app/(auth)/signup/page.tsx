import Link from 'next/link';
import { Input, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { signupWithPassword } from '@/lib/auth/actions';

const TIER_LABEL: Record<string, string> = {
  core: 'Core — up to 5 associations',
  plus: 'Plus — for growing companies',
  max:  'Max — for enterprise operators',
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; next?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const tier = params.tier && TIER_LABEL[params.tier] ? params.tier : null;

  return (
    <div className="space-y-9">
      {/* Editorial header */}
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
          New account
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900 md:text-5xl">
          Begin with{' '}
          <span className="italic text-champagne-700">Portier.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-500">
          Create your account, then a concierge will reach out to walk you
          through importing your first association.
        </p>
      </header>

      {/* Tier badge if pre-selected from /pricing */}
      {tier && (
        <div className="flex items-start gap-3 rounded-lg border border-champagne-300 bg-champagne-50 px-4 py-3">
          <span className="mt-0.5 inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] bg-champagne-200 text-champagne-800">
            Selected
          </span>
          <div className="text-sm">
            <div className="font-medium text-ink-900">{TIER_LABEL[tier]}</div>
            <div className="text-xs text-ink-500 mt-0.5">
              Adjust this anytime —{' '}
              <Link href="/#pricing" className="underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 transition-colors">
                review pricing
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form
        action={signupWithPassword as any}
        className="space-y-5 rounded-lg border border-ink-100 bg-white p-7 shadow-soft-sm"
      >
        {tier && <input type="hidden" name="tier" value={tier} />}

        <Field
          label="Email address"
          hint="If you were invited, use the email that received the invitation."
        >
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Password" hint="Minimum 12 characters">
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

        {params.error && (
          <div className="rounded-md border border-bordeaux-300 bg-bordeaux-50 px-3.5 py-2.5 text-sm text-bordeaux-700">
            {params.error}
          </div>
        )}
        {params.success && (
          <div className="rounded-md border border-sage-300 bg-sage-50 px-3.5 py-2.5 text-sm text-sage-700">
            {params.success}
          </div>
        )}

        <Button type="submit" size="lg" variant="primary" className="w-full">
          Create account
        </Button>

        <p className="text-[11px] leading-relaxed text-ink-500">
          By creating an account you agree to our{' '}
          <Link href="/legal/terms" className="underline decoration-ink-200 underline-offset-2 hover:text-champagne-700 transition-colors">Terms</Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="underline decoration-ink-200 underline-offset-2 hover:text-champagne-700 transition-colors">Privacy notice</Link>.
        </p>
      </form>

      <div className="text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-champagne-700 underline decoration-champagne-300 decoration-1 underline-offset-4 hover:decoration-champagne-500 transition-colors"
        >
          Sign in to your workspace →
        </Link>
      </div>
    </div>
  );
}
